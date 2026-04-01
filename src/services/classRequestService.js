import { getFirebaseClients } from '../firebase/config';
import { MEETING_PROVIDERS } from '../constants/meetingProviders';
import { REQUEST_STATUS, SESSION_STATUS, canTransitionRequest } from '../constants/lifecycle';
import { BILLING_RULES, PLATFORM_FEE_RATE, TUTOR_PAYOUT_RATE } from '../utils/onboarding';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { getTutorCandidatesForRequest } from './userService';

const MOCK_REQUESTS_KEY = 'claxi_mock_requests';
const MOCK_SESSIONS_KEY = 'claxi_mock_sessions';

let isUpdatingRequests = false;
let isUpdatingSessions = false;

function getMockRequests() {
  return JSON.parse(localStorage.getItem(MOCK_REQUESTS_KEY) || '[]');
}

function setMockRequests(items) {
  if (isUpdatingRequests) return;
  isUpdatingRequests = true;
  localStorage.setItem(MOCK_REQUESTS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
  isUpdatingRequests = false;
}

function getMockSessions() {
  return JSON.parse(localStorage.getItem(MOCK_SESSIONS_KEY) || '[]');
}

function setMockSessions(items) {
  if (isUpdatingSessions) return;
  isUpdatingSessions = true;
  localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
  isUpdatingSessions = false;
}

function withMockSnapshot(filterFn, callback) {
  const emit = () => callback(getMockRequests().filter(filterFn));
  emit();
  window.addEventListener('storage', emit);
  return () => window.removeEventListener('storage', emit);
}

function computeTutorQueue(tutors = []) {
  return tutors.map((tutor) => tutor.uid);
}

function updateRequestStatusSafe(request, nextStatus) {
  if (!canTransitionRequest(request.status, nextStatus)) {
    return request;
  }
  return {
    ...request,
    status: nextStatus,
  };
}

async function assignNextTutorOffer(requestId) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const existing = getMockRequests().find((request) => request.id === requestId);
    if (!existing) return null;

    const queue = existing.tutorQueue || [];
    const nextTutorId = queue[0] || null;

    if (!nextTutorId) {
      const next = getMockRequests().map((request) =>
        request.id === requestId
          ? {
              ...updateRequestStatusSafe(request, REQUEST_STATUS.NO_TUTOR_AVAILABLE),
              currentOfferTutorId: null,
              offerExpiresAt: null,
              updatedAt: new Date().toISOString(),
            }
          : request,
      );
      setMockRequests(next);
      return null;
    }

    const next = getMockRequests().map((request) =>
      request.id === requestId
        ? {
            ...updateRequestStatusSafe(request, REQUEST_STATUS.OFFERED),
            currentOfferTutorId: nextTutorId,
            tutorQueue: queue,
            offerExpiresAt: Date.now() + 10000,
            updatedAt: new Date().toISOString(),
          }
        : request,
    );
    setMockRequests(next);
    return nextTutorId;
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc, updateDoc, serverTimestamp } = firestoreModule;
  const requestRef = doc(db, 'classRequests', requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) return null;

  const requestData = requestSnap.data();
  const queue = requestData.tutorQueue || [];
  const nextTutorId = queue[0] || null;

  if (!nextTutorId) {
    if (canTransitionRequest(requestData.status, REQUEST_STATUS.NO_TUTOR_AVAILABLE)) {
      await updateDoc(requestRef, {
        status: REQUEST_STATUS.NO_TUTOR_AVAILABLE,
        currentOfferTutorId: null,
        offerExpiresAt: null,
        updatedAt: serverTimestamp(),
      });
    }

    await createNotification({
      userId: requestData.studentId,
      title: 'No tutor available',
      message: 'No tutor accepted in time. Please retry your request.',
      type: 'matching_update',
      requestId,
    });

    return null;
  }

  if (canTransitionRequest(requestData.status, REQUEST_STATUS.OFFERED)) {
    await updateDoc(requestRef, {
      status: REQUEST_STATUS.OFFERED,
      currentOfferTutorId: nextTutorId,
      offerExpiresAt: Date.now() + 10000,
      updatedAt: serverTimestamp(),
    });
  }

  await createNotification({
    userId: nextTutorId,
    title: 'New live request',
    message: `New math request: ${requestData.topic}. Accept within 10 seconds.`,
    type: 'tutor_offer',
    requestId,
  });

  return nextTutorId;
}

async function initializeTutorMatching(requestId, payload) {
  const candidates = await getTutorCandidatesForRequest({ topic: payload.topic });
  const queue = computeTutorQueue(candidates);
  const clients = await getFirebaseClients();

  if (!clients) {
    const next = getMockRequests().map((request) =>
      request.id === requestId
        ? {
            ...updateRequestStatusSafe(request, REQUEST_STATUS.MATCHING),
            tutorQueue: queue,
            updatedAt: new Date().toISOString(),
          }
        : request,
    );
    setMockRequests(next);
    await assignNextTutorOffer(requestId);
    return;
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc, updateDoc, serverTimestamp } = firestoreModule;
  const requestRef = doc(db, 'classRequests', requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) return;

  if (canTransitionRequest(snap.data().status, REQUEST_STATUS.MATCHING)) {
    await updateDoc(requestRef, {
      status: REQUEST_STATUS.MATCHING,
      tutorQueue: queue,
      updatedAt: serverTimestamp(),
    });
  }

  await createNotification({
    userId: payload.studentId,
    title: 'Finding a tutor',
    message: 'We are notifying online tutors now.',
    type: 'matching_update',
    requestId,
  });

  await assignNextTutorOffer(requestId);
}

export async function createClassRequest(payload) {
  const clients = await getFirebaseClients();
  const requestBody = {
    ...payload,
    subject: 'Mathematics',
    mode: 'online',
    meetingProviderPreference: payload.meetingProviderPreference || MEETING_PROVIDERS.ANY,
    status: REQUEST_STATUS.PENDING,
    tutorId: null,
    tutorName: null,
    tutorEmail: null,
    tutorQueue: [],
    currentOfferTutorId: null,
    offerExpiresAt: null,
    imageAttachment: payload.imageAttachment || '',
    attachment: payload.attachment || null,
  };

  if (!clients) {
    const request = {
      id: crypto.randomUUID(),
      ...requestBody,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMockRequests([request, ...getMockRequests()]);

    await createNotification({
      userId: payload.studentId,
      title: 'Class request submitted',
      message: `Your ${payload.topic || payload.subject} request is now matching tutors.`,
      type: 'class_request',
      requestId: request.id,
    });

    await initializeTutorMatching(request.id, payload);
    return request.id;
  }

  const { db, firestoreModule } = clients;
  const { addDoc, collection, serverTimestamp } = firestoreModule;

  const docRef = await addDoc(collection(db, 'classRequests'), {
    ...requestBody,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: payload.studentId,
    title: 'Class request submitted',
    message: `Your ${payload.topic || payload.subject} request is now matching tutors.`,
    type: 'class_request',
    requestId: docRef.id,
  });

  await queueEmailEvent(EMAIL_EVENT_TYPES.REQUEST_CREATED, {
    requestId: docRef.id,
    studentId: payload.studentId,
    studentName: payload.studentName,
    studentEmail: payload.studentEmail,
    subject: 'Mathematics',
    topic: payload.topic,
  });

  await initializeTutorMatching(docRef.id, payload);
  return docRef.id;
}

export function subscribeToStudentRequests(studentId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.studentId === studentId, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'classRequests'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, async (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub();
}

export function subscribeToTutorAvailableRequests(tutorId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      const emit = async () => {
        const now = Date.now();
        const current = getMockRequests();

        const updated = current.map((request) => {
          if (request.status === REQUEST_STATUS.OFFERED && request.offerExpiresAt && request.offerExpiresAt <= now) {
            const queue = (request.tutorQueue || []).filter((id) => id !== request.currentOfferTutorId);
            return {
              ...updateRequestStatusSafe(request, REQUEST_STATUS.MATCHING),
              tutorQueue: queue,
              currentOfferTutorId: null,
              offerExpiresAt: null,
              updatedAt: new Date().toISOString(),
            };
          }
          return request;
        });

        setMockRequests(updated);

        callback(
          updated.filter(
            (request) => request.status === REQUEST_STATUS.OFFERED && request.currentOfferTutorId === tutorId,
          ),
        );
      };

      emit();
      const interval = setInterval(emit, 1000);
      window.addEventListener('storage', emit);
      unsub = () => {
        clearInterval(interval);
        window.removeEventListener('storage', emit);
      };
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'classRequests'),
      where('status', '==', REQUEST_STATUS.OFFERED),
      where('currentOfferTutorId', '==', tutorId),
    );

    unsub = onSnapshot(queryRef, async (snapshot) => {
      const now = Date.now();
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

      for (const item of items) {
        if (item.offerExpiresAt && item.offerExpiresAt <= now) {
          await handleTutorOfferResponse({ requestId: item.id, tutorId, response: 'timeout' });
        }
      }

      callback(items.filter((item) => !item.offerExpiresAt || item.offerExpiresAt > now));
    });
  });

  return () => unsub();
}

export function subscribeToTutorAcceptedRequests(tutorId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.tutorId === tutorId, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'classRequests'),
      where('tutorId', '==', tutorId),
      orderBy('updatedAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub();
}

export async function handleTutorOfferResponse({ requestId, tutorId, tutorName, tutorEmail, response }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const existing = getMockRequests().find((item) => item.id === requestId);
    if (!existing || existing.currentOfferTutorId !== tutorId) return;

    if (response === 'accept') {
      const next = getMockRequests().map((item) =>
        item.id === requestId
          ? {
              ...updateRequestStatusSafe(item, REQUEST_STATUS.ACCEPTED),
              tutorId,
              tutorName: tutorName || existing.tutorName || 'Tutor',
              tutorEmail: tutorEmail || existing.tutorEmail || '',
              currentOfferTutorId: null,
              offerExpiresAt: null,
              updatedAt: new Date().toISOString(),
            }
          : item,
      );
      setMockRequests(next);

      const session = {
        id: crypto.randomUUID(),
        requestId,
        studentId: existing.studentId,
        studentName: existing.studentName,
        studentEmail: existing.studentEmail,
        tutorId,
        tutorName: tutorName || existing.tutorName || 'Tutor',
        tutorEmail: tutorEmail || existing.tutorEmail || '',
        subject: 'Mathematics',
        topic: existing.topic,
        scheduledDate: existing.preferredDate,
        scheduledTime: existing.preferredTime,
        duration: existing.duration,
        meetingProvider: existing.meetingProviderPreference || MEETING_PROVIDERS.ANY,
        meetingLink: '',
        notes: '',
        status: SESSION_STATUS.WAITING_STUDENT,
        joinGraceEndsAt: Date.now() + 2 * 60 * 1000,
        callStartedAt: Date.now(),
        studentJoinedAt: null,
        billingStartedAt: null,
        billedSeconds: 0,
        totalAmount: 0,
        payoutBreakdown: {
          platformFeeRate: PLATFORM_FEE_RATE,
          tutorRate: TUTOR_PAYOUT_RATE,
          tutorAmount: 0,
          platformAmount: 0,
        },
        ratings: {
          student: null,
          tutor: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMockSessions([session, ...getMockSessions()]);
      return;
    }

    const queue = (existing.tutorQueue || []).filter((id) => id !== tutorId);
    const updated = getMockRequests().map((item) =>
      item.id === requestId
        ? {
            ...updateRequestStatusSafe(item, REQUEST_STATUS.MATCHING),
            tutorQueue: queue,
            currentOfferTutorId: null,
            offerExpiresAt: null,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    setMockRequests(updated);
    await assignNextTutorOffer(requestId);
    return;
  }

  const { db, firestoreModule } = clients;
  const { doc, runTransaction, collection, serverTimestamp } = firestoreModule;

  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'classRequests', requestId);
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) throw new Error('Request not found.');

    const requestData = requestSnap.data();
    if (requestData.currentOfferTutorId !== tutorId) return;

    if (response === 'accept') {
      if (canTransitionRequest(requestData.status, REQUEST_STATUS.ACCEPTED)) {
        transaction.update(requestRef, {
          tutorId,
          tutorName: tutorName || 'Tutor',
          tutorEmail: tutorEmail || '',
          status: REQUEST_STATUS.ACCEPTED,
          currentOfferTutorId: null,
          offerExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
      }

      const sessionRef = doc(collection(db, 'sessions'));
      transaction.set(sessionRef, {
        requestId,
        studentId: requestData.studentId,
        studentName: requestData.studentName,
        studentEmail: requestData.studentEmail,
        tutorId,
        tutorName: tutorName || requestData.tutorName || 'Tutor',
        tutorEmail: tutorEmail || requestData.tutorEmail || '',
        subject: 'Mathematics',
        topic: requestData.topic,
        scheduledDate: requestData.preferredDate,
        scheduledTime: requestData.preferredTime,
        duration: requestData.duration,
        meetingProvider: requestData.meetingProviderPreference || MEETING_PROVIDERS.ANY,
        meetingLink: '',
        notes: '',
        status: SESSION_STATUS.WAITING_STUDENT,
        joinGraceEndsAt: Date.now() + 2 * 60 * 1000,
        callStartedAt: Date.now(),
        studentJoinedAt: null,
        billingStartedAt: null,
        billedSeconds: 0,
        totalAmount: 0,
        payoutBreakdown: {
          platformFeeRate: PLATFORM_FEE_RATE,
          tutorRate: TUTOR_PAYOUT_RATE,
          tutorAmount: 0,
          platformAmount: 0,
        },
        ratings: {
          student: null,
          tutor: null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const queue = (requestData.tutorQueue || []).filter((id) => id !== tutorId);
      if (canTransitionRequest(requestData.status, REQUEST_STATUS.MATCHING)) {
        transaction.update(requestRef, {
          tutorQueue: queue,
          status: REQUEST_STATUS.MATCHING,
          currentOfferTutorId: null,
          offerExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
      }
    }
  });

  if (response === 'accept') {
    await Promise.all([
      createNotification({
        userId: tutorId,
        title: 'Call ready',
        message: 'You accepted the request. Start the call now.',
        type: 'request_accepted',
        requestId,
      }),
      queueEmailEvent(EMAIL_EVENT_TYPES.REQUEST_ACCEPTED, {
        requestId,
        tutorId,
      }),
    ]);
    return;
  }

  await assignNextTutorOffer(requestId);
}

export async function acceptClassRequest({ requestId, tutorId, tutorName, tutorEmail }) {
  return handleTutorOfferResponse({ requestId, tutorId, tutorName, tutorEmail, response: 'accept' });
}

export async function declineClassRequest({ requestId, tutorId }) {
  return handleTutorOfferResponse({ requestId, tutorId, response: 'decline' });
}

export async function settleSessionBilling(session) {
  const billedSeconds = Math.max(0, Math.floor((Date.now() - (session.billingStartedAt || Date.now())) / 1000));
  const totalAmount = Number(((billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE).toFixed(2));
  const tutorAmount = Number((totalAmount * TUTOR_PAYOUT_RATE).toFixed(2));
  const platformAmount = Number((totalAmount * PLATFORM_FEE_RATE).toFixed(2));

  return {
    billedSeconds,
    totalAmount,
    payoutBreakdown: {
      platformFeeRate: PLATFORM_FEE_RATE,
      tutorRate: TUTOR_PAYOUT_RATE,
      tutorAmount,
      platformAmount,
    },
    chargedCardLast4: session.selectedCardLast4 || null,
  };
}
