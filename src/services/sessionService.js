import { getFirebaseClients } from '../firebase/config';
import { REQUEST_STATUS, SESSION_STATUS, PAYMENT_STATUS, canTransitionSession, deriveRequestStatusFromSession } from '../constants/lifecycle';
import { BILLING_RULES } from '../utils/onboarding';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { settleSessionBilling } from './classRequestService';
import { chargeCard } from './paymentGatewayService';
import { applyWalletDebt } from './walletService';
import { getUserProfile } from './userService';

const MOCK_SESSIONS_KEY = 'claxi_mock_sessions';
const MOCK_REQUESTS_KEY = 'claxi_mock_requests';

function getMockSessions() {
  return JSON.parse(localStorage.getItem(MOCK_SESSIONS_KEY) || '[]');
}

function setMockSessions(items) {
  localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
}

function getMockRequests() {
  return JSON.parse(localStorage.getItem(MOCK_REQUESTS_KEY) || '[]');
}

function setMockRequests(items) {
  localStorage.setItem(MOCK_REQUESTS_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
}

function withMockSnapshot(filterFn, callback) {
  const emit = () => callback(getMockSessions().filter(filterFn));
  emit();
  window.addEventListener('storage', emit);
  return () => window.removeEventListener('storage', emit);
}

function syncMockRequestStatus(requestId, sessionStatus) {
  const nextRequestStatus = deriveRequestStatusFromSession(sessionStatus);
  if (!nextRequestStatus) return;

  const nextRequests = getMockRequests().map((request) =>
    request.id === requestId
      ? {
          ...request,
          status: nextRequestStatus,
          updatedAt: new Date().toISOString(),
        }
      : request,
  );

  setMockRequests(nextRequests);
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
    if (!existing) throw new Error('Session not found.');

    if (updates.status && !canTransitionSession(existing.status, updates.status)) {
      throw new Error(`Invalid session transition: ${existing.status} -> ${updates.status}`);
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

    if (updates.status && updates.requestId) {
      syncMockRequestStatus(updates.requestId, updates.status);
    }

    return next.find((item) => item.id === sessionId);
  }

  const { db, firestoreModule } = clients;
  const { doc, serverTimestamp, updateDoc, getDoc, writeBatch } = firestoreModule;

  const sessionRef = doc(db, 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error('Session not found.');

  const existing = sessionSnap.data();
  if (updates.status && !canTransitionSession(existing.status, updates.status)) {
    throw new Error(`Invalid session transition: ${existing.status} -> ${updates.status}`);
  }

  const batch = writeBatch(db);

  batch.update(sessionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  if (updates.status && updates.requestId) {
    const nextRequestStatus = deriveRequestStatusFromSession(updates.status);
    if (nextRequestStatus) {
      const requestRef = doc(db, 'classRequests', updates.requestId);
      batch.update(requestRef, {
        status: nextRequestStatus,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();

  const snap = await getDoc(sessionRef);
  return { id: snap.id, ...snap.data() };
}

export async function joinSessionAsStudent(session, selectedCardId, selectedCardLast4) {
  return updateSession(session.id, {
    ...session,
    status: SESSION_STATUS.IN_PROGRESS,
    studentJoinedAt: Date.now(),
    billingStartedAt: Date.now(),
    selectedCardId,
    selectedCardLast4,
  });
}

export async function endSession(session) {
  const billing = await settleSessionBilling(session);
  const studentProfile = await getUserProfile(session.studentId);
  const selectedCard = (studentProfile?.paymentMethods || []).find((card) => card.id === session.selectedCardId)
    || (studentProfile?.paymentMethods || []).find((card) => card.isDefault)
    || studentProfile?.paymentMethods?.[0];

  const charge = await chargeCard({
    amount: billing.totalAmount,
    card: selectedCard,
  });

  let paymentStatus = PAYMENT_STATUS.PAID;

  if (!charge.ok) {
    paymentStatus = PAYMENT_STATUS.WALLET_DEBT_RECORDED;
    await applyWalletDebt(session.studentId, billing.totalAmount);
  }

  const updated = await updateSession(session.id, {
    ...session,
    status: SESSION_STATUS.COMPLETED,
    endedAt: Date.now(),
    billedSeconds: billing.billedSeconds,
    totalAmount: billing.totalAmount,
    payoutBreakdown: billing.payoutBreakdown,
    chargedCardLast4: billing.chargedCardLast4,
    paymentStatus,
    paymentTransactionId: charge.transactionId || null,
  });

  await Promise.all([
    createNotification({
      userId: session.studentId,
      title: charge.ok ? 'Session ended' : 'Payment declined - wallet updated',
      message: charge.ok
        ? `Billing complete: R${billing.totalAmount.toFixed(2)} (${billing.billedSeconds}s).`
        : `Card declined. Wallet updated to cover R${billing.totalAmount.toFixed(2)} outstanding.`,
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
      paymentStatus,
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

export { REQUEST_STATUS };

export async function getPaymentExceptionsForAdmin() {
  const clients = await getFirebaseClients();
  if (!clients) {
    return getMockSessions().filter((session) => session.paymentStatus === PAYMENT_STATUS.WALLET_DEBT_RECORDED);
  }

  const { db, firestoreModule } = clients;
  const { collection, getDocs, query, where } = firestoreModule;
  const q = query(collection(db, 'sessions'), where('paymentStatus', '==', PAYMENT_STATUS.WALLET_DEBT_RECORDED));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function markPaymentExceptionReviewed(session) {
  return updateSession(session.id, {
    ...session,
    paymentExceptionReview: {
      reviewedAt: Date.now(),
      status: 'reviewed',
    },
  });
}
