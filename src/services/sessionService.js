import { getFirebaseClients } from '../firebase/config';
import { REQUEST_STATUS, SESSION_STATUS, PAYMENT_STATUS, canTransitionSession, deriveRequestStatusFromSession } from '../constants/lifecycle';
import { BILLING_RULES, TUTOR_PAYOUT_RATE, PLATFORM_FEE_RATE } from '../utils/onboarding';
import { createNotification } from './notificationService';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { getUserProfile, updateUserRatingSummary } from './userService';
import { debugError, debugLog } from '../utils/devLogger';

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
              ...(sessionStatus === SESSION_STATUS.IN_PROGRESS
                ? { startedAt: Date.now(), statusDetail: 'Student joined. Session is in progress.' }
                : {}),
              ...(sessionStatus === SESSION_STATUS.COMPLETED
                ? { endedAt: Date.now(), statusDetail: 'Session ended. Billing completed.' }
                : {}),
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
      const requestPatch = {
        status: nextRequestStatus,
        updatedAt: serverTimestamp(),
      };
      if (updates.status === SESSION_STATUS.IN_PROGRESS) {
        requestPatch.startedAt = updates.studentJoinedAt || Date.now();
        requestPatch.statusDetail = 'Student joined. Session is in progress.';
      }
      if (updates.status === SESSION_STATUS.COMPLETED) {
        requestPatch.endedAt = updates.endedAt || Date.now();
        requestPatch.statusDetail = 'Session ended. Billing completed.';
      }
      batch.update(requestRef, {
        ...requestPatch,
      });
    }
  }

  await batch.commit();

  const snap = await getDoc(sessionRef);
  return { id: snap.id, ...snap.data() };
}

export async function joinSessionAsStudent(session, selectedCardId, selectedCardLast4) {
  debugLog('sessionService', 'Student joining session.', { sessionId: session?.id, requestId: session?.requestId });
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
  debugLog('sessionService', 'Ending session and settling billing.', { sessionId: session?.id, requestId: session?.requestId });
  const clients = await getFirebaseClients();
  let updated;
  let isPaid = true;

  if (!clients) {
    const endedAt = Date.now();
    const startedAt = Number(session.billingStartedAt || session.studentJoinedAt || session.callStartedAt || endedAt);
    const billedSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
    const totalAmount = Number(((billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE).toFixed(2));
    const tutorAmount = Number((totalAmount * TUTOR_PAYOUT_RATE).toFixed(2));
    const platformAmount = Number((totalAmount * PLATFORM_FEE_RATE).toFixed(2));

    updated = await updateSession(session.id, {
      ...session,
      status: SESSION_STATUS.COMPLETED,
      endedAt,
      billedSeconds,
      totalAmount,
      payoutBreakdown: {
        platformFeeRate: PLATFORM_FEE_RATE,
        tutorRate: TUTOR_PAYOUT_RATE,
        tutorAmount,
        platformAmount,
      },
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentTransactionId: null,
    });
  } else {
    const idToken = await clients?.auth?.currentUser?.getIdToken?.();
    if (!idToken) {
      throw new Error('You must be signed in to end this session.');
    }

    const response = await fetch('/finalize-session-billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ sessionId: session.id }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || 'Unable to finalize session billing.');
    }

    updated = payload.session || session;
    isPaid = updated.paymentStatus !== PAYMENT_STATUS.WALLET_DEBT_RECORDED;
  }

  if (!clients) {
    isPaid = true;
  }

  await Promise.all([
    createNotification({
      userId: session.studentId,
      title: isPaid ? 'Session ended' : 'Payment declined - wallet updated',
      message: isPaid
        ? `Billing complete: R${Number(updated.totalAmount || 0).toFixed(2)} (${Number(updated.billedSeconds || 0)}s).`
        : `Card declined. Wallet updated to cover R${Number(updated.totalAmount || 0).toFixed(2)} outstanding.`,
      type: 'session_billing',
      requestId: session.requestId,
      sessionId: session.id,
    }),
    createNotification({
      userId: session.tutorId,
      title: 'Session ended',
      message: `Tutor payout pending: R${Number(updated.payoutBreakdown?.tutorAmount || 0).toFixed(2)}.`,
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
      amount: Number(updated.totalAmount || 0),
      rate: BILLING_RULES.DISPLAY_RATE_PER_MINUTE,
      paymentStatus: updated.paymentStatus,
    }),
  ]);

  debugLog('sessionService', 'Session ended and billing updates completed.', {
    sessionId: session?.id,
    totalAmount: Number(updated.totalAmount || 0),
    paymentStatus: updated.paymentStatus,
  });
  return updated;
}

export async function submitSessionRating(session, role, payload) {
  debugLog('sessionService', 'Submitting session rating.', { sessionId: session?.id, role, overall: payload?.overall });
  const ratings = {
    ...(session.ratings || {}),
    [role]: {
      overall: payload.overall,
      topic: payload.topic,
      comment: payload.comment || '',
      submittedAt: Date.now(),
    },
  };

  const updatedSession = await updateSession(session.id, {
    ...session,
    ratings,
  });

  try {
    if (role === 'student') {
      await updateUserRatingSummary(session.tutorId, 'asTutor', payload.overall);
    } else {
      await updateUserRatingSummary(session.studentId, 'asStudent', payload.overall);
    }
  } catch (error) {
    debugError('sessionService', 'Failed to update user rating summary.', { message: error.message, sessionId: session?.id });
    throw error;
  }

  debugLog('sessionService', 'Session rating submitted successfully.', { sessionId: session?.id, role });
  return updatedSession;
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
