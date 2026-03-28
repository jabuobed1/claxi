import { getFirebaseClients } from '../firebase/config';
import { REQUEST_STATUSES } from '../utils/requestStatus';
import { BILLING_RULES } from '../utils/onboarding';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { settleSessionBilling } from './classRequestService';

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
    return next.find((item) => item.id === sessionId);
  }

  const { db, firestoreModule } = clients;
  const { doc, serverTimestamp, updateDoc, getDoc, writeBatch } = firestoreModule;

  const sessionRef = doc(db, 'sessions', sessionId);
  const batch = writeBatch(db);

  batch.update(sessionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  if (updates.status && updates.requestId) {
    const requestRef = doc(db, 'classRequests', updates.requestId);
    batch.update(requestRef, {
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  const snap = await getDoc(sessionRef);
  return { id: snap.id, ...snap.data() };
}

export async function joinSessionAsStudent(session, selectedCardId, selectedCardLast4) {
  return updateSession(session.id, {
    ...session,
    status: REQUEST_STATUSES.IN_PROGRESS,
    studentJoinedAt: Date.now(),
    billingStartedAt: Date.now(),
    selectedCardId,
    selectedCardLast4,
  });
}

export async function endSession(session) {
  const billing = await settleSessionBilling(session);
  const updated = await updateSession(session.id, {
    ...session,
    status: REQUEST_STATUSES.COMPLETED,
    endedAt: Date.now(),
    billedSeconds: billing.billedSeconds,
    totalAmount: billing.totalAmount,
    payoutBreakdown: billing.payoutBreakdown,
    chargedCardLast4: billing.chargedCardLast4,
  });

  await Promise.all([
    createNotification({
      userId: session.studentId,
      title: 'Session ended',
      message: `Billing complete: R${billing.totalAmount.toFixed(2)} (${billing.billedSeconds}s).`,
      type: 'session_billing',
      requestId: session.requestId,
      sessionId: session.id,
    }),
    createNotification({
      userId: session.tutorId,
      title: 'Session ended',
      message: `Tutor payout pending: R${billing.payoutBreakdown.tutorAmount.toFixed(2)}.`,
      type: 'session_billing',
      requestId: session.requestId,
      sessionId: session.id,
    }),
    queueEmailEvent(EMAIL_EVENT_TYPES.SESSION_COMPLETED, {
      sessionId: session.id,
      requestId: session.requestId,
      studentEmail: session.studentEmail,
      tutorEmail: session.tutorEmail,
      subject: session.subject,
      topic: session.topic,
      amount: billing.totalAmount,
      rate: BILLING_RULES.DISPLAY_RATE_PER_MINUTE,
    }),
  ]);

  return updated;
}

export async function submitSessionRating(session, role, payload) {
  const ratings = {
    ...(session.ratings || {}),
    [role]: {
      overall: payload.overall,
      topic: payload.topic,
      comment: payload.comment || '',
      submittedAt: Date.now(),
    },
  };

  return updateSession(session.id, {
    ...session,
    ratings,
  });
}
