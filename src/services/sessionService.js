import { getFirebaseClients } from '../firebase/config';
import { REQUEST_STATUSES } from '../utils/requestStatus';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';

const MOCK_SESSIONS_KEY = 'claxi_mock_sessions';

function getMockSessions() {
  return JSON.parse(localStorage.getItem(MOCK_SESSIONS_KEY) || '[]');
}

function setMockSessions(items) {
  localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
}

function withMockSnapshot(filterFn, callback) {
  const emit = () => callback(getMockSessions().filter(filterFn));
  emit();
  window.addEventListener('storage', emit);
  return () => window.removeEventListener('storage', emit);
}

export function subscribeToStudentSessions(studentId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!studentId) {
      callback([]);
      return;
    }

    if (!clients) {
      unsub = withMockSnapshot((item) => item.studentId === studentId, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'sessions'),
      where('studentId', '==', studentId),
      orderBy('updatedAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub?.();
}

export function subscribeToTutorSessions(tutorId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!tutorId) {
      callback([]);
      return;
    }

    if (!clients) {
      unsub = withMockSnapshot((item) => item.tutorId === tutorId, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'sessions'),
      where('tutorId', '==', tutorId),
      orderBy('updatedAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub?.();
}

export async function updateSession(sessionId, updates) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const existing = getMockSessions().find((item) => item.id === sessionId);
    if (!existing) {
      throw new Error('Session not found.');
    }

    const next = getMockSessions().map((item) =>
      item.id === sessionId
        ? {
            ...item,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );

    setMockSessions(next);
    return;
  }

  const { db, firestoreModule } = clients;
  const { doc, updateDoc, serverTimestamp, writeBatch } = firestoreModule;

  const sessionRef = doc(db, 'sessions', sessionId);
  const batch = writeBatch(db);

  batch.update(sessionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  if (updates.status) {
    const requestRef = doc(db, 'classRequests', updates.requestId);
    batch.update(requestRef, {
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  if (updates.status === REQUEST_STATUSES.SCHEDULED) {
    await queueEmailEvent(EMAIL_EVENT_TYPES.SESSION_SCHEDULED, {
      sessionId,
      requestId: updates.requestId,
      studentId: updates.studentId,
      studentEmail: updates.studentEmail,
      studentName: updates.studentName,
      tutorId: updates.tutorId,
      tutorEmail: updates.tutorEmail,
      tutorName: updates.tutorName,
      scheduledDate: updates.scheduledDate,
      scheduledTime: updates.scheduledTime,
      meetingProvider: updates.meetingProvider,
      meetingLink: updates.meetingLink,
      subject: updates.subject,
      topic: updates.topic,
    });
  } else if (updates.status === REQUEST_STATUSES.COMPLETED) {
    await queueEmailEvent(EMAIL_EVENT_TYPES.SESSION_COMPLETED, {
      sessionId,
      requestId: updates.requestId,
      studentEmail: updates.studentEmail,
      tutorEmail: updates.tutorEmail,
      subject: updates.subject,
      topic: updates.topic,
    });
  } else {
    await queueEmailEvent(EMAIL_EVENT_TYPES.SESSION_UPDATED, {
      sessionId,
      requestId: updates.requestId,
      studentEmail: updates.studentEmail,
      tutorEmail: updates.tutorEmail,
      status: updates.status,
      subject: updates.subject,
      topic: updates.topic,
    });
  }

  await Promise.all([
    createNotification({
      userId: updates.studentId,
      title: 'Session updated',
      message: `${updates.subject} session is now ${updates.status.replace('_', ' ')}.`,
      type: 'session_update',
      requestId: updates.requestId,
      sessionId,
    }),
    createNotification({
      userId: updates.tutorId,
      title: 'Session updated',
      message: `${updates.subject} session is now ${updates.status.replace('_', ' ')}.`,
      type: 'session_update',
      requestId: updates.requestId,
      sessionId,
    }),
  ]);
}
