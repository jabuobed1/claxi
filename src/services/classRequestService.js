import { getFirebaseClients } from '../firebase/config';
import { MEETING_PROVIDERS } from '../constants/meetingProviders';
import { REQUEST_STATUS, SESSION_STATUS, canTransitionRequest } from '../constants/lifecycle';
import { BILLING_RULES, PLATFORM_FEE_RATE, TUTOR_PAYOUT_RATE } from '../utils/onboarding';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { getTutorCandidatesForRequest } from './userService';
import { debugError, debugLog } from '../utils/devLogger';

const MOCK_REQUESTS_KEY = 'claxi_mock_requests';
const MOCK_SESSIONS_KEY = 'claxi_mock_sessions';
const MATCHING_TIMEOUT_MS = 3 * 60 * 1000;
const OFFER_TIMEOUT_MS = 30000;
const MATCHING_STATUS_DELAY_MS = 3000;
const NO_TUTOR_STATUS_DELAY_MS = 3000;

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

function normalizeTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStatusDelayElapsed(request, delayMs) {
  if (!request) return true;
  const updatedAtMs = normalizeTimestamp(request.updatedAt);
  if (!updatedAtMs) return true;
  return Date.now() - updatedAtMs >= delayMs;
}

function isRequestExpired(request) {
  const createdAtMs = normalizeTimestamp(request.createdAt);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs >= MATCHING_TIMEOUT_MS;
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
    if (isRequestExpired(existing)) {
      const next = getMockRequests().map((request) =>
        request.id === requestId
          ? {
              ...updateRequestStatusSafe(request, REQUEST_STATUS.EXPIRED),
              currentOfferTutorId: null,
              offerExpiresAt: null,
              statusDetail: 'Request expired because no tutor accepted in time.',
              updatedAt: new Date().toISOString(),
            }
          : request,
      );
      setMockRequests(next);
      return null;
    }

    const queue = existing.tutorQueue || [];
    const nextTutorId = queue[0] || null;
    const isNoTutorReady = getStatusDelayElapsed(existing, MATCHING_STATUS_DELAY_MS);
    const isRetryReady = getStatusDelayElapsed(existing, NO_TUTOR_STATUS_DELAY_MS);

    if (!nextTutorId) {
      if (existing.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
        if (!isRetryReady) {
          return null;
        }

        const goMatching = getMockRequests().map((request) =>
          request.id === requestId
            ? {
                ...updateRequestStatusSafe(request, REQUEST_STATUS.MATCHING),
                tutorQueue: queue,
                currentOfferTutorId: null,
                offerExpiresAt: null,
                statusDetail: 'Retrying tutor matching.',
                updatedAt: new Date().toISOString(),
              }
            : request,
        );
        setMockRequests(goMatching);
        return null;
      }

      if (!isNoTutorReady) {
        return null;
      }

      const noTutor = getMockRequests().map((request) =>
        request.id === requestId
          ? {
              ...updateRequestStatusSafe(request, REQUEST_STATUS.NO_TUTOR_AVAILABLE),
              tutorQueue: queue,
              currentOfferTutorId: null,
              offerExpiresAt: null,
              statusDetail: 'No tutor accepted. Looking for another tutor.',
              updatedAt: new Date().toISOString(),
            }
          : request,
      );
      setMockRequests(noTutor);
      return null;
    }

    if (existing.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
      const promote = getMockRequests().map((request) =>
        request.id === requestId
          ? {
              ...updateRequestStatusSafe(request, REQUEST_STATUS.MATCHING),
              tutorQueue: queue,
              statusDetail: 'Tutor found; moving to matching.',
              updatedAt: new Date().toISOString(),
            }
          : request,
      );
      setMockRequests(promote);
    }

    const next = getMockRequests().map((request) =>
      request.id === requestId
        ? {
            ...updateRequestStatusSafe(request, REQUEST_STATUS.OFFERED),
            currentOfferTutorId: nextTutorId,
            tutorQueue: queue,
            offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
            retryOfferGranted: false,
            statusDetail: 'Tutor notified. Waiting for acceptance.',
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
  if (isRequestExpired(requestData)) {
    if (canTransitionRequest(requestData.status, REQUEST_STATUS.EXPIRED)) {
      await updateDoc(requestRef, {
        status: REQUEST_STATUS.EXPIRED,
        currentOfferTutorId: null,
        offerExpiresAt: null,
        updatedAt: serverTimestamp(),
      });
    }
    return null;
  }
  const queue = requestData.tutorQueue || [];
  const nextTutorId = queue[0] || null;
  const isNoTutorReady = getStatusDelayElapsed(requestData, MATCHING_STATUS_DELAY_MS);
  const isRetryReady = getStatusDelayElapsed(requestData, NO_TUTOR_STATUS_DELAY_MS);

  if (!nextTutorId) {
    if (requestData.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
      if (!isRetryReady) {
        return null;
      }

      if (canTransitionRequest(requestData.status, REQUEST_STATUS.MATCHING)) {
        await updateDoc(requestRef, {
          status: REQUEST_STATUS.MATCHING,
          tutorQueue: queue,
          currentOfferTutorId: null,
          offerExpiresAt: null,
          statusDetail: 'Retrying tutor matching.',
          updatedAt: serverTimestamp(),
        });
      }

      return null;
    }

    if (!isNoTutorReady) {
      if (canTransitionRequest(requestData.status, REQUEST_STATUS.MATCHING)) {
        await updateDoc(requestRef, {
          status: REQUEST_STATUS.MATCHING,
          tutorQueue: queue,
          currentOfferTutorId: null,
          offerExpiresAt: null,
          statusDetail: 'Matching tutors currently online.',
          updatedAt: serverTimestamp(),
        });
      }
      return null;
    }

    if (canTransitionRequest(requestData.status, REQUEST_STATUS.NO_TUTOR_AVAILABLE)) {
      await updateDoc(requestRef, {
        status: REQUEST_STATUS.NO_TUTOR_AVAILABLE,
        currentOfferTutorId: null,
        offerExpiresAt: null,
        statusDetail: 'No tutor available. Showing this for a short delay.',
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

  if (requestData.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE && canTransitionRequest(requestData.status, REQUEST_STATUS.MATCHING)) {
    await updateDoc(requestRef, {
      status: REQUEST_STATUS.MATCHING,
      tutorQueue: queue,
      statusDetail: 'Tutor found; moving to matching.',
      updatedAt: serverTimestamp(),
    });
    requestData.status = REQUEST_STATUS.MATCHING;
  }

  if (canTransitionRequest(requestData.status, REQUEST_STATUS.OFFERED)) {
    await updateDoc(requestRef, {
      status: REQUEST_STATUS.OFFERED,
      currentOfferTutorId: nextTutorId,
      offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
      retryOfferGranted: false,
      statusDetail: 'Tutor notified. Waiting for acceptance.',
      updatedAt: serverTimestamp(),
    });
  }

  await createNotification({
    userId: nextTutorId,
    title: 'New live request',
    message: `New math request: ${requestData.topic}. Accept within 30 seconds.`,
    type: 'tutor_offer',
    requestId,
  });

  return nextTutorId;
}

async function initializeTutorMatching(requestId, payload) {
  const candidates = await getTutorCandidatesForRequest({ subject: payload.subject || 'Mathematics' });
  const queue = computeTutorQueue(candidates);
  const clients = await getFirebaseClients();

  if (!clients) {
    const next = getMockRequests().map((request) =>
      request.id === requestId
        ? {
            ...updateRequestStatusSafe(request, REQUEST_STATUS.MATCHING),
            tutorQueue: queue,
            statusDetail: 'Matching tutors currently online.',
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
      statusDetail: 'Matching tutors currently online.',
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

async function refreshActiveMatchingRequests(studentId) {
  const clients = await getFirebaseClients();
  if (!clients) {
    const requests = getMockRequests();
    const updates = [];
    const mutable = [...requests];
    for (const request of requests) {
      if (studentId && request.studentId !== studentId) continue;
      if (request.tutorId) continue;
      if (![REQUEST_STATUS.PENDING, REQUEST_STATUS.MATCHING, REQUEST_STATUS.OFFERED, REQUEST_STATUS.NO_TUTOR_AVAILABLE].includes(request.status)) continue;

      if (isRequestExpired(request)) {
        updates.push({
          id: request.id,
          status: REQUEST_STATUS.EXPIRED,
          statusDetail: 'Request expired because no tutor accepted in time.',
          tutorQueue: [],
          currentOfferTutorId: null,
          offerExpiresAt: null,
          updatedAt: new Date().toISOString(),
        });
        continue;
      }

      const candidates = await getTutorCandidatesForRequest({ subject: request.subject || 'Mathematics' });
      const queue = computeTutorQueue(candidates);
      const currentOfferTutorId = request.currentOfferTutorId && queue.includes(request.currentOfferTutorId)
        ? request.currentOfferTutorId
        : null;

    let nextStatus = request.status;
    let nextStatusDetail = request.statusDetail;
    const hasTutors = queue.length > 0;
    const isNoTutorReady = getStatusDelayElapsed(request, MATCHING_STATUS_DELAY_MS);
    const isRetryReady = getStatusDelayElapsed(request, NO_TUTOR_STATUS_DELAY_MS);

    if (hasTutors) {
      if (request.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
        if (isRetryReady) {
          nextStatus = REQUEST_STATUS.MATCHING;
          nextStatusDetail = 'Retrying tutor matching.';
        }
      } else if (request.status === REQUEST_STATUS.PENDING) {
        nextStatus = REQUEST_STATUS.MATCHING;
        nextStatusDetail = 'Matching tutors currently online.';
      }
    } else {
      if (request.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
        if (isRetryReady) {
          nextStatus = REQUEST_STATUS.MATCHING;
          nextStatusDetail = 'Retrying tutor matching.';
        } else {
          nextStatus = REQUEST_STATUS.NO_TUTOR_AVAILABLE;
          nextStatusDetail = 'No tutor available. Showing this for a short delay.';
        }
      } else {
        if (isNoTutorReady) {
          nextStatus = REQUEST_STATUS.NO_TUTOR_AVAILABLE;
          nextStatusDetail = 'No tutor available. Showing this for a short delay.';
        } else {
          nextStatus = REQUEST_STATUS.MATCHING;
          nextStatusDetail = 'Matching tutors currently online.';
        }
      }
    }

    updates.push({
      id: request.id,
      status: nextStatus,
      statusDetail: nextStatusDetail,
      tutorQueue: queue,
      currentOfferTutorId,
      offerExpiresAt: currentOfferTutorId ? request.offerExpiresAt : null,
      updatedAt: new Date().toISOString(),
    });
  }

  if (!updates.length) return;
  const byId = new Map(updates.map((item) => [item.id, item]));
  const next = mutable.map((request) => (byId.has(request.id) ? { ...request, ...byId.get(request.id) } : request));
  setMockRequests(next);
  await Promise.all(
    updates
      .filter((item) => item.status === REQUEST_STATUS.MATCHING && !item.currentOfferTutorId)
      .map((item) => assignNextTutorOffer(item.id)),
  );
  return;
}
  const { db, firestoreModule } = clients;
  const { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } = firestoreModule;
  const baseQuery = query(
    collection(db, 'classRequests'),
    where('status', 'in', [REQUEST_STATUS.PENDING, REQUEST_STATUS.MATCHING, REQUEST_STATUS.OFFERED, REQUEST_STATUS.NO_TUTOR_AVAILABLE]),
  );
  const snapshot = await getDocs(baseQuery);
  for (const requestDoc of snapshot.docs) {
    const request = { id: requestDoc.id, ...requestDoc.data() };
    if (studentId && request.studentId !== studentId) continue;
    if (request.tutorId) continue;
    const requestRef = doc(db, 'classRequests', request.id);

    if (isRequestExpired(request)) {
      if (canTransitionRequest(request.status, REQUEST_STATUS.EXPIRED)) {
        await updateDoc(requestRef, {
          status: REQUEST_STATUS.EXPIRED,
          statusDetail: 'Request expired because no tutor accepted in time.',
          tutorQueue: [],
          currentOfferTutorId: null,
          offerExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
      }
      continue;
    }

    const candidates = await getTutorCandidatesForRequest({ subject: request.subject || 'Mathematics' });
    const queue = computeTutorQueue(candidates);
    const currentOfferTutorId = request.currentOfferTutorId && queue.includes(request.currentOfferTutorId)
      ? request.currentOfferTutorId
      : null;

    let nextStatus = request.status;
    let nextStatusDetail = request.statusDetail;
    const hasTutors = queue.length > 0;
    const isNoTutorReady = getStatusDelayElapsed(request, MATCHING_STATUS_DELAY_MS);
    const isRetryReady = getStatusDelayElapsed(request, NO_TUTOR_STATUS_DELAY_MS);

    if (hasTutors) {
      if (request.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
        if (isRetryReady) {
          nextStatus = REQUEST_STATUS.MATCHING;
          nextStatusDetail = 'Retrying tutor matching.';
        } else {
          nextStatus = REQUEST_STATUS.NO_TUTOR_AVAILABLE;
          nextStatusDetail = 'No tutor available. Showing this for a short delay.';
        }
      } else if (request.status === REQUEST_STATUS.PENDING) {
        nextStatus = REQUEST_STATUS.MATCHING;
        nextStatusDetail = 'Matching tutors currently online.';
      }
    } else {
      if (request.status === REQUEST_STATUS.NO_TUTOR_AVAILABLE) {
        if (isRetryReady) {
          nextStatus = REQUEST_STATUS.MATCHING;
          nextStatusDetail = 'Retrying tutor matching.';
        } else {
          nextStatus = REQUEST_STATUS.NO_TUTOR_AVAILABLE;
          nextStatusDetail = 'No tutor available. Showing this for a short delay.';
        }
      } else {
        if (isNoTutorReady) {
          nextStatus = REQUEST_STATUS.NO_TUTOR_AVAILABLE;
          nextStatusDetail = 'No tutor available. Showing this for a short delay.';
        } else {
          nextStatus = REQUEST_STATUS.MATCHING;
          nextStatusDetail = 'Matching tutors currently online.';
        }
      }
    }

    await updateDoc(requestRef, {
      tutorQueue: queue,
      currentOfferTutorId,
      offerExpiresAt: currentOfferTutorId ? request.offerExpiresAt || null : null,
      status: nextStatus,
      statusDetail: nextStatusDetail,
      updatedAt: serverTimestamp(),
    });

    if (!currentOfferTutorId && nextStatus === REQUEST_STATUS.MATCHING) {
      await assignNextTutorOffer(request.id);
    }
  }
}

export async function createClassRequest(payload) {
  debugLog('classRequestService', 'Creating class request.', {
    studentId: payload?.studentId,
    topic: payload?.topic,
    durationMinutes: payload?.durationMinutes || payload?.duration,
  });
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
    statusDetail: 'Request submitted. Initializing tutor matching.',
  };

  if (!clients) {
    const nowIso = new Date().toISOString();
    const expirableStatuses = [REQUEST_STATUS.PENDING, REQUEST_STATUS.MATCHING, REQUEST_STATUS.OFFERED, REQUEST_STATUS.NO_TUTOR_AVAILABLE];
    const expired = getMockRequests().map((item) =>
      item.studentId === payload.studentId && expirableStatuses.includes(item.status)
        ? {
            ...updateRequestStatusSafe(item, REQUEST_STATUS.EXPIRED),
            currentOfferTutorId: null,
            offerExpiresAt: null,
            updatedAt: nowIso,
          }
        : item,
    );

    const request = {
      id: crypto.randomUUID(),
      ...requestBody,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setMockRequests([request, ...expired]);

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
  const { addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc } = firestoreModule;

  const existingSnap = await getDocs(
    query(
      collection(db, 'classRequests'),
      where('studentId', '==', payload.studentId),
      where('status', 'in', [REQUEST_STATUS.PENDING, REQUEST_STATUS.MATCHING, REQUEST_STATUS.OFFERED, REQUEST_STATUS.NO_TUTOR_AVAILABLE]),
    ),
  );

  await Promise.all(existingSnap.docs.map((item) => updateDoc(item.ref, {
    status: REQUEST_STATUS.EXPIRED,
    statusDetail: 'Previous request auto-expired by new request.',
    currentOfferTutorId: null,
    offerExpiresAt: null,
    updatedAt: serverTimestamp(),
  })));

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
  debugLog('classRequestService', 'Class request created and matching initialized.', { requestId: docRef.id });
  return docRef.id;
}

export function subscribeToStudentRequests(studentId, callback) {
  let unsub = () => {};
  let refreshInterval = null;

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.studentId === studentId, callback);
      refreshInterval = setInterval(() => {
        refreshActiveMatchingRequests(studentId);
      }, 5000);
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
    refreshInterval = setInterval(() => {
      refreshActiveMatchingRequests(studentId);
    }, 5000);
  });

  return () => {
    unsub();
    if (refreshInterval) clearInterval(refreshInterval);
  };
}

export function subscribeToRequestById(requestId, callback) {
  let unsub = () => {};
  let refreshInterval = null;
  getFirebaseClients().then((clients) => {
    if (!clients) {
      const emit = () => callback(getMockRequests().find((item) => item.id === requestId) || null);
      emit();
      window.addEventListener('storage', emit);
      unsub = () => window.removeEventListener('storage', emit);
      refreshInterval = setInterval(() => {
        refreshActiveMatchingRequests();
      }, 5000);
      return;
    }
    const { db, firestoreModule } = clients;
    const { doc, onSnapshot } = firestoreModule;
    unsub = onSnapshot(doc(db, 'classRequests', requestId), (snapshot) => {
      callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    });
    refreshInterval = setInterval(() => {
      refreshActiveMatchingRequests();
    }, 5000);
  });
  return () => {
    unsub();
    if (refreshInterval) clearInterval(refreshInterval);
  };
}

export function subscribeToTutorAvailableRequests(tutorId, callback) {
  let unsub = () => {};
  let refreshInterval = null;

  getFirebaseClients().then((clients) => {
    if (!clients) {
      const emit = async () => {
        const now = Date.now();
        const current = getMockRequests();

        const updated = current.map((request) => {
          if (request.status === REQUEST_STATUS.OFFERED && request.offerExpiresAt && request.offerExpiresAt <= now) {
            const queue = (request.tutorQueue || []).filter((id) => id !== request.currentOfferTutorId);
            const wasSingleTutor = (request.tutorQueue || []).length <= 1;
            if (wasSingleTutor && !request.retryOfferGranted) {
              return {
                ...request,
                retryOfferGranted: true,
                offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
                updatedAt: new Date().toISOString(),
              };
            }
            return {
              ...updateRequestStatusSafe(request, queue.length ? REQUEST_STATUS.MATCHING : REQUEST_STATUS.NO_TUTOR_AVAILABLE),
              tutorQueue: queue,
              currentOfferTutorId: null,
              offerExpiresAt: null,
              statusDetail: queue.length ? 'Tutor timed out. Trying another tutor.' : 'No tutor accepted. Looking for another tutor.',
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
      refreshInterval = setInterval(() => {
        refreshActiveMatchingRequests();
      }, 5000);
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
          const isSingleTutor = (item.tutorQueue || []).length <= 1;
          if (isSingleTutor && !item.retryOfferGranted) {
            const { doc, updateDoc, serverTimestamp } = firestoreModule;
            await updateDoc(doc(db, 'classRequests', item.id), {
              retryOfferGranted: true,
              offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
              updatedAt: serverTimestamp(),
            });
          } else {
            await handleTutorOfferResponse({ requestId: item.id, tutorId, response: 'timeout' });
          }
        }
      }

      callback(items.filter((item) => !item.offerExpiresAt || item.offerExpiresAt > now));
    });
    refreshInterval = setInterval(() => {
      refreshActiveMatchingRequests();
    }, 5000);
  });

  return () => {
    unsub();
    if (refreshInterval) clearInterval(refreshInterval);
  };
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
    if (!existing) return;

    if (response === 'accept') {
      const existingSessionId = existing.sessionId || requestId;
      const existingSession = getMockSessions().find(
        (item) =>
          item.id === existingSessionId
          || (item.requestId === requestId && item.tutorId === tutorId),
      );

      if (
        existing.status === REQUEST_STATUS.ACCEPTED
        && existing.tutorId === tutorId
        && existingSession
      ) {
        debugLog('classRequestService', 'Mock accept reused existing session.', {
          requestId,
          tutorId,
          sessionId: existingSession.id,
        });
        return { sessionId: existingSession.id, reused: true };
      }

      if (existing.currentOfferTutorId !== tutorId) {
        throw new Error('This request is no longer assigned to you.');
      }

      if (!canTransitionRequest(existing.status, REQUEST_STATUS.ACCEPTED)) {
        throw new Error('This request cannot be accepted in its current state.');
      }

      const sessionId = existingSession?.id || existing.sessionId || requestId;

      const next = getMockRequests().map((item) =>
        item.id === requestId
          ? {
              ...updateRequestStatusSafe(item, REQUEST_STATUS.ACCEPTED),
              tutorId,
              tutorName: tutorName || existing.tutorName || 'Tutor',
              tutorEmail: tutorEmail || existing.tutorEmail || '',
              sessionId,
              currentOfferTutorId: null,
              offerExpiresAt: null,
              statusDetail: 'Tutor accepted. Session is ready to join.',
              updatedAt: new Date().toISOString(),
            }
          : item,
      );
      setMockRequests(next);

      if (!existingSession) {
        const session = {
          id: sessionId,
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
          meetingProvider: MEETING_PROVIDERS.WEBRTC,
          meetingLink: '',
          meetingId: '',
          meetingPassword: '',
          webrtc: {
            ready: true,
            status: 'tutor_waiting',
            tutorReadyAt: Date.now(),
            studentReadyAt: null,
            offer: null,
            answer: null,
            lastRestartAt: null,
          },
          whiteboardRoomId: existing.whiteboardRoomId || requestId,
          notes: '',
          requestAttachment: existing.attachment || null,
          requestDescription: existing.description || '',
          status: SESSION_STATUS.WAITING_STUDENT,
          joinGraceEndsAt: Date.now() + 2 * 60 * 1000,
          callStartedAt: null,
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

        setMockSessions([
          session,
          ...getMockSessions().filter((item) => item.id !== sessionId),
        ]);
      }

      return { sessionId, reused: Boolean(existingSession) };
    }

    if (existing.currentOfferTutorId !== tutorId) {
      throw new Error('This request is no longer assigned to you.');
    }

    const queue = (existing.tutorQueue || []).filter((id) => id !== tutorId);
    const nextStatus = queue.length ? REQUEST_STATUS.MATCHING : REQUEST_STATUS.NO_TUTOR_AVAILABLE;

    if (!canTransitionRequest(existing.status, nextStatus)) {
      throw new Error('This request cannot be declined in its current state.');
    }

    const updated = getMockRequests().map((item) =>
      item.id === requestId
        ? {
            ...updateRequestStatusSafe(item, nextStatus),
            tutorQueue: queue,
            currentOfferTutorId: null,
            offerExpiresAt: null,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );

    setMockRequests(updated);
    await assignNextTutorOffer(requestId);
    return { sessionId: null, reused: false };
  }

  const { db, firestoreModule } = clients;
  const { doc, runTransaction, serverTimestamp } = firestoreModule;

  debugLog('classRequestService', 'Tutor offer transaction started.', {
    requestId,
    tutorId,
    response,
  });

  try {
    const transactionResult = await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, 'classRequests', requestId);
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists()) throw new Error('Request not found.');

      const requestData = requestSnap.data();
      const resolvedTutorName = tutorName || requestData.tutorName || 'Tutor';
      const resolvedTutorEmail = tutorEmail || requestData.tutorEmail || '';
      const sessionId = requestData.sessionId || requestId;
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await transaction.get(sessionRef);

      debugLog('classRequestService', 'Tutor offer transaction request state.', {
        requestId,
        status: requestData.status || null,
        currentOfferTutorId: requestData.currentOfferTutorId || null,
        existingSessionId: requestData.sessionId || null,
      });

      if (response === 'accept') {
        const alreadyAcceptedBySameTutor =
          requestData.status === REQUEST_STATUS.ACCEPTED
          && requestData.tutorId === tutorId;

        if (alreadyAcceptedBySameTutor && sessionSnap.exists()) {
          debugLog('classRequestService', 'Tutor offer transaction reused existing accepted session.', {
            requestId,
            tutorId,
            sessionId,
          });
          return { sessionId, reused: true };
        }

        if (requestData.currentOfferTutorId !== tutorId && !alreadyAcceptedBySameTutor) {
          throw new Error('This request is no longer assigned to you.');
        }

        if (!alreadyAcceptedBySameTutor && !canTransitionRequest(requestData.status, REQUEST_STATUS.ACCEPTED)) {
          throw new Error('This request cannot be accepted in its current state.');
        }

        transaction.update(requestRef, {
          tutorId,
          tutorName: resolvedTutorName,
          tutorEmail: resolvedTutorEmail,
          sessionId,
          status: REQUEST_STATUS.ACCEPTED,
          currentOfferTutorId: null,
          offerExpiresAt: null,
          statusDetail: 'Tutor accepted. Session is ready to join.',
          updatedAt: serverTimestamp(),
        });

        if (!sessionSnap.exists()) {
          debugLog('classRequestService', 'Tutor offer transaction creating session.', {
            requestId,
            sessionId,
          });

          transaction.set(
            sessionRef,
            {
              requestId,
              studentId: requestData.studentId,
              studentName: requestData.studentName,
              studentEmail: requestData.studentEmail,
              tutorId,
              tutorName: resolvedTutorName,
              tutorEmail: resolvedTutorEmail,
              subject: 'Mathematics',
              topic: requestData.topic,
              scheduledDate: requestData.preferredDate,
              scheduledTime: requestData.preferredTime,
              duration: requestData.duration,
              meetingProvider: MEETING_PROVIDERS.WEBRTC,
              meetingLink: '',
              meetingId: '',
              meetingPassword: '',
              webrtc: {
                ready: true,
                status: 'tutor_waiting',
                tutorReadyAt: Date.now(),
                studentReadyAt: null,
                offer: null,
                answer: null,
                lastRestartAt: null,
              },
              whiteboardRoomId: requestData.whiteboardRoomId || requestId,
              notes: '',
              requestAttachment: requestData.attachment || null,
              requestDescription: requestData.description || '',
              status: SESSION_STATUS.WAITING_STUDENT,
              joinGraceEndsAt: Date.now() + 2 * 60 * 1000,
              callStartedAt: null,
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
            },
            { merge: true },
          );
        } else {
          debugLog('classRequestService', 'Tutor offer transaction reused existing session document.', {
            requestId,
            sessionId,
          });

          transaction.set(
            sessionRef,
            {
              requestId,
              studentId: requestData.studentId,
              studentName: requestData.studentName,
              studentEmail: requestData.studentEmail,
              tutorId,
              tutorName: resolvedTutorName,
              tutorEmail: resolvedTutorEmail,
              topic: requestData.topic,
              scheduledDate: requestData.preferredDate,
              scheduledTime: requestData.preferredTime,
              duration: requestData.duration,
              whiteboardRoomId: requestData.whiteboardRoomId || requestId,
              requestAttachment: requestData.attachment || null,
              requestDescription: requestData.description || '',
              status: SESSION_STATUS.WAITING_STUDENT,
              joinGraceEndsAt: Date.now() + 2 * 60 * 1000,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }

        return { sessionId, reused: sessionSnap.exists() };
      }

      if (requestData.currentOfferTutorId !== tutorId) {
        throw new Error('This request is no longer assigned to you.');
      }

      const queue = (requestData.tutorQueue || []).filter((id) => id !== tutorId);
      const nextStatus = queue.length ? REQUEST_STATUS.MATCHING : REQUEST_STATUS.NO_TUTOR_AVAILABLE;

      if (!canTransitionRequest(requestData.status, nextStatus)) {
        throw new Error('This request cannot be declined in its current state.');
      }

      transaction.update(requestRef, {
        tutorQueue: queue,
        status: nextStatus,
        currentOfferTutorId: null,
        offerExpiresAt: null,
        statusDetail: 'Tutor declined. Matching another tutor.',
        updatedAt: serverTimestamp(),
      });

      return { sessionId: null, reused: false };
    });

    debugLog('classRequestService', 'Tutor offer transaction succeeded.', {
      requestId,
      tutorId,
      response,
      sessionId: transactionResult?.sessionId || null,
      reused: Boolean(transactionResult?.reused),
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

      return transactionResult;
    }

    await assignNextTutorOffer(requestId);
    return transactionResult;
  } catch (error) {
    debugError('classRequestService', 'Tutor offer transaction failed.', {
      requestId,
      tutorId,
      response,
      message: error.message,
    });
    throw new Error(error.message || 'Unable to process this request right now. Please retry.');
  }
}

export async function acceptClassRequest({ requestId, tutorId, tutorName, tutorEmail }) {
  debugLog('classRequestService', 'Accepting class request.', { requestId, tutorId });

  const result = await handleTutorOfferResponse({
    requestId,
    tutorId,
    tutorName,
    tutorEmail,
    response: 'accept',
  });

  debugLog('classRequestService', 'Class request accepted.', {
    requestId,
    tutorId,
    sessionId: result?.sessionId || null,
    reused: Boolean(result?.reused),
  });

  return result;
}

export async function declineClassRequest({ requestId, tutorId }) {
  debugLog('classRequestService', 'Declining class request.', { requestId, tutorId });
  const result = await handleTutorOfferResponse({ requestId, tutorId, response: 'decline' });
  debugLog('classRequestService', 'Class request declined.', { requestId, tutorId });
  return result;
}

export async function cancelClassRequest({ requestId, canceledBy, reason }) {
  debugLog('classRequestService', 'Canceling class request.', { requestId, canceledBy });
  const clients = await getFirebaseClients();
  const patch = {
    status: REQUEST_STATUS.CANCELED,
    statusDetail: 'Request canceled by student.',
    canceledReason: String(reason || '').trim(),
    canceledBy: canceledBy || 'student',
    canceledAt: Date.now(),
    currentOfferTutorId: null,
    offerExpiresAt: null,
  };

  if (!clients) {
    const next = getMockRequests().map((item) =>
      item.id === requestId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
    );
    setMockRequests(next);
    const nextSessions = getMockSessions().map((item) => {
      if (item.requestId !== requestId) return item;
      if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(item.status)) return item;
      return {
        ...item,
        status: SESSION_STATUS.CANCELED,
        endedAt: Date.now(),
        canceledAt: Date.now(),
        canceledBy: canceledBy || 'student',
        canceledReason: String(reason || '').trim(),
        updatedAt: new Date().toISOString(),
      };
    });
    setMockSessions(nextSessions);
    return;
  }

  const { db, firestoreModule } = clients;
  const { collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } = firestoreModule;
  try {
    await updateDoc(doc(db, 'classRequests', requestId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    const sessionsQuery = query(collection(db, 'sessions'), where('requestId', '==', requestId));
    const sessionsSnap = await getDocs(sessionsQuery);
    const sessionBatch = writeBatch(db);
    let updatesCount = 0;
    sessionsSnap.docs.forEach((sessionDoc) => {
      const sessionData = sessionDoc.data();
      if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(sessionData.status)) return;
      updatesCount += 1;
      sessionBatch.update(sessionDoc.ref, {
        status: SESSION_STATUS.CANCELED,
        endedAt: Date.now(),
        canceledAt: Date.now(),
        canceledBy: canceledBy || 'student',
        canceledReason: String(reason || '').trim(),
        updatedAt: serverTimestamp(),
      });
    });
    if (updatesCount) {
      await sessionBatch.commit();
    }
    debugLog('classRequestService', 'Class request canceled.', { requestId });
  } catch (error) {
    debugError('classRequestService', 'Failed to cancel class request.', { requestId, message: error.message });
    throw error;
  }
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
