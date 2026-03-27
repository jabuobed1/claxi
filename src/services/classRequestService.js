import { getFirebaseClients } from '../firebase/config';
import { MEETING_PROVIDERS } from '../constants/meetingProviders';
import { REQUEST_STATUSES } from '../utils/requestStatus';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';

const MOCK_REQUESTS_KEY = 'claxi_mock_requests';
const MOCK_SESSIONS_KEY = 'claxi_mock_sessions';

function getMockRequests() {
  return JSON.parse(localStorage.getItem(MOCK_REQUESTS_KEY) || '[]');
}

function setMockRequests(items) {
  localStorage.setItem(MOCK_REQUESTS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
}

function getMockSessions() {
  return JSON.parse(localStorage.getItem(MOCK_SESSIONS_KEY) || '[]');
}

function setMockSessions(items) {
  localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
}

function withMockSnapshot(filterFn, callback) {
  const emit = () => callback(getMockRequests().filter(filterFn));
  emit();
  window.addEventListener('storage', emit);
  return () => window.removeEventListener('storage', emit);
}

export async function createClassRequest(payload) {
  const clients = await getFirebaseClients();
  const requestBody = {
    ...payload,
    mode: 'online',
    meetingProviderPreference: payload.meetingProviderPreference || MEETING_PROVIDERS.ANY,
    status: REQUEST_STATUSES.PENDING,
    tutorId: null,
    tutorName: null,
    tutorEmail: null,
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
      message: `Your ${payload.subject} request is now visible to tutors.`,
      type: 'class_request',
      requestId: request.id,
    });

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
    message: `Your ${payload.subject} request is now visible to tutors.`,
    type: 'class_request',
    requestId: docRef.id,
  });

  await queueEmailEvent(EMAIL_EVENT_TYPES.REQUEST_CREATED, {
    requestId: docRef.id,
    studentId: payload.studentId,
    studentName: payload.studentName,
    studentEmail: payload.studentEmail,
    subject: payload.subject,
    topic: payload.topic,
  });

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

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub();
}

export function subscribeToTutorAvailableRequests(callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.status === REQUEST_STATUSES.PENDING, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'classRequests'),
      where('status', '==', REQUEST_STATUSES.PENDING),
      orderBy('createdAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
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

export async function acceptClassRequest({ requestId, tutorId, tutorName, tutorEmail }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const existing = getMockRequests().find((item) => item.id === requestId);
    if (!existing || existing.status !== REQUEST_STATUSES.PENDING) {
      throw new Error('This request is no longer available.');
    }

    const next = getMockRequests().map((item) =>
      item.id === requestId
        ? {
            ...item,
            tutorId,
            tutorName,
            tutorEmail,
            status: REQUEST_STATUSES.ACCEPTED,
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
      tutorName,
      tutorEmail,
      subject: existing.subject,
      topic: existing.topic,
      scheduledDate: existing.preferredDate,
      scheduledTime: existing.preferredTime,
      duration: existing.duration,
      meetingProvider: existing.meetingProviderPreference || MEETING_PROVIDERS.ANY,
      meetingLink: '',
      notes: '',
      status: REQUEST_STATUSES.ACCEPTED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMockSessions([session, ...getMockSessions()]);

    return;
  }

  const { db, firestoreModule } = clients;
  const { runTransaction, doc, collection, serverTimestamp } = firestoreModule;

  let acceptedRequest = null;

  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'classRequests', requestId);
    const requestSnap = await transaction.get(requestRef);

    if (!requestSnap.exists()) {
      throw new Error('Request not found.');
    }

    const requestData = requestSnap.data();
    if (requestData.status !== REQUEST_STATUSES.PENDING) {
      throw new Error('This request is already assigned.');
    }

    acceptedRequest = { id: requestId, ...requestData };

    transaction.update(requestRef, {
      tutorId,
      tutorName,
      tutorEmail,
      status: REQUEST_STATUSES.ACCEPTED,
      updatedAt: serverTimestamp(),
    });

    const sessionRef = doc(collection(db, 'sessions'));
    transaction.set(sessionRef, {
      requestId,
      studentId: requestData.studentId,
      studentName: requestData.studentName,
      studentEmail: requestData.studentEmail,
      tutorId,
      tutorName,
      tutorEmail,
      subject: requestData.subject,
      topic: requestData.topic,
      scheduledDate: requestData.preferredDate,
      scheduledTime: requestData.preferredTime,
      duration: requestData.duration,
      meetingProvider: requestData.meetingProviderPreference || MEETING_PROVIDERS.ANY,
      meetingLink: '',
      notes: '',
      status: REQUEST_STATUSES.ACCEPTED,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  if (!acceptedRequest) {
    return;
  }

  await Promise.all([
    createNotification({
      userId: acceptedRequest.studentId,
      title: 'Request accepted',
      message: `${tutorName} accepted your ${acceptedRequest.subject} request.`,
      type: 'request_accepted',
      requestId,
    }),
    queueEmailEvent(EMAIL_EVENT_TYPES.REQUEST_ACCEPTED, {
      requestId,
      studentId: acceptedRequest.studentId,
      studentName: acceptedRequest.studentName,
      studentEmail: acceptedRequest.studentEmail,
      tutorId,
      tutorName,
      tutorEmail,
      subject: acceptedRequest.subject,
      topic: acceptedRequest.topic,
    }),
  ]);
}
