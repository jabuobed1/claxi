const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const { randomUUID } = require('crypto');

admin.initializeApp();

const db = admin.firestore();

const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const EMAIL_FROM = defineSecret('EMAIL_FROM');
const CLOUDFLARE_TURN_KEY_ID = defineSecret('CLOUDFLARE_TURN_KEY_ID');
const CLOUDFLARE_TURN_API_TOKEN = defineSecret('CLOUDFLARE_TURN_API_TOKEN');
const CLOUDFLARE_TURN_TTL_SECONDS = defineSecret('CLOUDFLARE_TURN_TTL_SECONDS');

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
const DEFAULT_TURN_TTL_SECONDS = 600;
const MATCHING_TIMEOUT_MS = 3 * 60 * 1000;
const OFFER_TIMEOUT_MS = 30 * 1000;
const REQUEST_STATUS = {
  PENDING: 'pending',
  MATCHING: 'matching',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  IN_SESSION: 'in_session',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  CANCELED_DURING: 'canceled_during',
  EXPIRED: 'expired',
  NO_TUTOR_AVAILABLE: 'no_tutor_available',
};
const ACTIVE_REQUEST_STATUSES = new Set([
  REQUEST_STATUS.PENDING,
  REQUEST_STATUS.MATCHING,
  REQUEST_STATUS.OFFERED,
  REQUEST_STATUS.NO_TUTOR_AVAILABLE,
]);

function normalizeMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextOfferRevision(request = {}) {
  const current = Number(request.offerRevision || 0);
  if (!Number.isFinite(current) || current < 0) return 1;
  return Math.floor(current) + 1;
}

function isRequestExpired(request) {
  const createdAtMs = normalizeMillis(request?.createdAt);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs >= MATCHING_TIMEOUT_MS;
}

function getTutorScore(tutor = {}) {
  const rating = Number(tutor?.tutorProfile?.overallRating ?? 0) || 0;
  const recent24h = Number(tutor?.tutorProfile?.completedSessionsLast24Hours ?? 0) || 0;
  const totalSessions = Number(tutor?.tutorProfile?.completedSessionsTotal ?? 0) || 0;
  return (rating * 10000) + (recent24h * 100) + totalSessions;
}

async function getTutorQueueForSubject(subject) {
  const subjectKey = String(subject || 'Mathematics').trim().toLowerCase();
  const snapshot = await db
    .collection('users')
    .where('activeRole', '==', 'tutor')
    .where('onlineStatus', '==', 'online')
    .get();

  return snapshot.docs
    .map((item) => ({ uid: item.id, ...item.data() }))
    .filter((tutor) => {
      const normalizedSubjects = (tutor.subjects || []).map((entry) => String(entry || '').trim().toLowerCase());
      return tutor?.tutorProfile?.verificationStatus === 'verified'
        && !tutor.activeSessionId
        && normalizedSubjects.includes(subjectKey);
    })
    .sort((a, b) => getTutorScore(b) - getTutorScore(a))
    .map((item) => item.uid);
}

exports.syncClassRequestLifecycle = onDocumentWritten('classRequests/{requestId}', async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : null;
  if (!afterData) return;

  if (!ACTIVE_REQUEST_STATUSES.has(afterData.status) || afterData.tutorId) {
    return;
  }

  const requestId = event.params.requestId;
  const requestRef = db.collection('classRequests').doc(requestId);
  const candidateQueue = await getTutorQueueForSubject(afterData.subject);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (!snap.exists) return;
    const request = snap.data();

    if (!ACTIVE_REQUEST_STATUSES.has(request.status) || request.tutorId) {
      return;
    }

    if (isRequestExpired(request)) {
      transaction.update(requestRef, {
        status: REQUEST_STATUS.EXPIRED,
        statusDetail: 'Request expired because no tutor accepted in time.',
        tutorQueue: [],
        currentOfferTutorId: null,
        offerExpiresAt: null,
        offerToken: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    if (
      request.status === REQUEST_STATUS.OFFERED
      && request.currentOfferTutorId
      && normalizeMillis(request.offerExpiresAt) > Date.now()
    ) {
      return;
    }

    let queue = Array.isArray(candidateQueue) ? [...candidateQueue] : [];

    if (request.status === REQUEST_STATUS.OFFERED && request.currentOfferTutorId) {
      queue = queue.filter((id) => id !== request.currentOfferTutorId);
    }

    if (!queue.length) {
      transaction.update(requestRef, {
        status: REQUEST_STATUS.NO_TUTOR_AVAILABLE,
        statusDetail: 'No tutor accepted. Looking for another tutor.',
        tutorQueue: [],
        currentOfferTutorId: null,
        offerExpiresAt: null,
        offerToken: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const offerRevision = nextOfferRevision(request);
    transaction.update(requestRef, {
      status: REQUEST_STATUS.OFFERED,
      statusDetail: 'Tutor notified. Waiting for acceptance.',
      tutorQueue: queue,
      currentOfferTutorId: queue[0],
      offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
      offerRevision,
      offerToken: randomUUID(),
      retryOfferGranted: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
});

function sanitizeCloudflareIceServers(iceServers) {
  if (!Array.isArray(iceServers)) return [];

  return iceServers
    .map((server) => {
      const urls = Array.isArray(server?.urls)
        ? server.urls.filter(Boolean)
        : [server?.urls].filter(Boolean);

      const filteredUrls = urls.filter((url) => !String(url).includes(':53'));

      if (!filteredUrls.length) return null;

      return {
        urls: filteredUrls,
        ...(server?.username ? { username: server.username } : {}),
        ...(server?.credential ? { credential: server.credential } : {}),
        ...(server?.credentialType ? { credentialType: server.credentialType } : {}),
      };
    })
    .filter(Boolean);
}

function parseTurnTtlSeconds(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_TURN_TTL_SECONDS;
  return Math.max(60, Math.min(172800, Math.floor(parsed)));
}

function buildEmailPayload(eventType, payload) {
  switch (eventType) {
    case 'welcome':
      return {
        to: payload.email,
        subject: `Welcome to Claxi, ${payload.fullName}!`,
        html: `<p>Welcome to Claxi. Your ${payload.role} account is ready.</p>`,
      };
    case 'request_created':
      return {
        to: payload.studentEmail,
        subject: 'Your class request is live',
        html: `<p>Your ${payload.subject} request has been posted and is visible to tutors.</p>`,
      };
    case 'request_accepted':
      return {
        to: payload.studentEmail,
        subject: 'A tutor accepted your request',
        html: `<p>${payload.tutorName} accepted your ${payload.subject} request.</p>`,
      };
    case 'session_scheduled':
      return {
        to: [payload.studentEmail, payload.tutorEmail],
        subject: `Session scheduled: ${payload.subject}`,
        html: `<p>Your session is scheduled for ${payload.scheduledDate} at ${payload.scheduledTime}. Link: ${payload.meetingLink || 'to be added'}</p>`,
      };
    case 'session_updated':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session update: ${payload.subject}`,
        html: `<p>Session status changed to ${payload.status || 'updated'}.</p>`,
      };
    case 'session_completed':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session completed: ${payload.subject}`,
        html: '<p>Your session has been marked as completed. Thanks for learning with Claxi.</p>',
      };
    case 'cancellation':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session canceled: ${payload.subject}`,
        html: '<p>This session has been canceled.</p>',
      };
    default:
      return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring('Bearer '.length).trim();
}

function getSafeSecretPreview(value) {
  if (!value || typeof value !== 'string') {
    return {
      exists: false,
      prefix: null,
      length: 0,
    };
  }

  return {
    exists: true,
    prefix: value.slice(0, 10),
    length: value.length,
  };
}

exports.getIceConfig = onRequest(
  {
    cors: true,
    secrets: [
      CLOUDFLARE_TURN_KEY_ID,
      CLOUDFLARE_TURN_API_TOKEN,
      CLOUDFLARE_TURN_TTL_SECONDS,
    ],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Unauthorized request.' });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      logger.warn('Failed to verify Firebase auth token for ICE config.', {
        error: error.message,
      });
      res.status(401).json({ success: false, message: 'Unauthorized request.' });
      return;
    }

    const turnKeyId = CLOUDFLARE_TURN_KEY_ID.value();
    const turnApiToken = CLOUDFLARE_TURN_API_TOKEN.value();
    const ttl = parseTurnTtlSeconds(CLOUDFLARE_TURN_TTL_SECONDS.value());

    if (!turnKeyId || !turnApiToken) {
      logger.error('Cloudflare TURN secrets missing.', {
        hasTurnKeyId: Boolean(turnKeyId),
        hasTurnApiToken: Boolean(turnApiToken),
      });
      res.status(500).json({
        success: false,
        message: 'Realtime network configuration unavailable.',
      });
      return;
    }

    try {
      const cfResponse = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(
          turnKeyId,
        )}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${turnApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl }),
        },
      );

      const cfPayload = await cfResponse.json().catch(() => null);

      if (!cfResponse.ok) {
        logger.error('Cloudflare TURN credential generation failed.', {
          uid: decodedToken.uid,
          status: cfResponse.status,
          payload: cfPayload || null,
        });

        res.status(500).json({
          success: false,
          message: 'Unable to generate realtime network credentials.',
        });
        return;
      }

      const generatedIceServers = sanitizeCloudflareIceServers(cfPayload?.iceServers || []);
      const combinedIceServers = generatedIceServers.length
        ? generatedIceServers
        : [{ urls: DEFAULT_STUN_URLS }];

      const turnServers = combinedIceServers.filter((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => String(url).startsWith('turn:') || String(url).startsWith('turns:'));
      });

      const stunServers = combinedIceServers.filter((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => String(url).startsWith('stun:'));
      });

      logger.info('Generated Cloudflare ICE config for authenticated user.', {
        uid: decodedToken.uid,
        ttlSeconds: ttl,
        serverCount: combinedIceServers.length,
        stunCount: stunServers.reduce(
          (sum, server) => sum + (Array.isArray(server.urls) ? server.urls.length : 1),
          0,
        ),
        turnCount: turnServers.reduce(
          (sum, server) => sum + (Array.isArray(server.urls) ? server.urls.length : 1),
          0,
        ),
        turnHasUsername: turnServers.some((server) => Boolean(server.username)),
        turnHasCredential: turnServers.some((server) => Boolean(server.credential)),
      });

      res.status(200).json({
        success: true,
        iceServers: combinedIceServers,
        ttlSeconds: ttl,
      });
    } catch (error) {
      logger.error('Failed to fetch Cloudflare ICE config.', {
        uid: decodedToken.uid,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Unable to generate realtime network credentials.',
      });
    }
  },
);

exports.verifyPaystack = onRequest({ cors: true, secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  logger.info('verifyPaystack request body received.', { body: req.body || null });

  const paystackSecretKey = PAYSTACK_SECRET_KEY.value();
  const paystackSecretPreview = getSafeSecretPreview(paystackSecretKey);

  logger.info('Paystack secret loaded.', {
    exists: paystackSecretPreview.exists,
    prefix: paystackSecretPreview.prefix,
    length: paystackSecretPreview.length,
  });

  if (!paystackSecretKey) {
    logger.error('PAYSTACK_SECRET_KEY missing.');
    res.status(500).json({ success: false, message: 'Payment configuration is unavailable.' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    logger.warn('Failed to verify Firebase auth token.', {
      error: error.message,
    });
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const uid = decodedToken.uid;
  const providedUserId = body.userId?.toString().trim();
  const nickname = body.nickname?.toString().trim();
  const reference = body.reference?.toString().trim();

  logger.info('verifyPaystack reference received.', {
    uid,
    providedUserId,
    reference,
    nickname: nickname || null,
  });

  if (!reference) {
    res.status(400).json({ success: false, message: 'Missing transaction reference.' });
    return;
  }

  if (providedUserId && providedUserId !== uid) {
    res.status(400).json({ success: false, message: 'Invalid userId supplied.' });
    return;
  }

  try {
    const verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const verificationPayload = await verificationResponse.json().catch(() => null);

    logger.info('Paystack verify response status.', {
      status: verificationResponse.status,
      ok: verificationResponse.ok,
      reference,
      responseStatus: verificationPayload?.status,
      message: verificationPayload?.message,
      errorCode: verificationPayload?.code || null,
      errorType: verificationPayload?.type || null,
    });

    if (!verificationResponse.ok) {
      const verifyError = new Error(`Paystack verify failed (${verificationResponse.status})`);
      verifyError.response = {
        data: verificationPayload || `HTTP ${verificationResponse.status}`,
      };
      throw verifyError;
    }

    const transactionData = verificationPayload?.data;
    const authorization = transactionData?.authorization;

    logger.info('Paystack verified transaction payload summary.', {
      reference,
      transactionStatus: transactionData?.status || null,
      hasAuthorization: !!authorization,
      authorizationReusable: authorization?.reusable === true,
      authorizationBrand: authorization?.brand || null,
      authorizationLast4: authorization?.last4 || null,
      amount: transactionData?.amount || null,
      currency: transactionData?.currency || null,
    });

    if (!transactionData || transactionData.status !== 'success') {
      res.status(400).json({
        success: false,
        message: 'Transaction verification failed or transaction is not successful.',
      });
      return;
    }

    if (!authorization?.authorization_code) {
      res.status(400).json({
        success: false,
        message: 'Authorization details not available for this transaction.',
      });
      return;
    }

    if (authorization.reusable !== true) {
      res.status(400).json({
        success: false,
        message: 'Card is not reusable. Please use a reusable card.',
      });
      return;
    }

    const usersRef = db.collection('users').doc(uid);
    const userSnap = await usersRef.get();
    const existingMethods = Array.isArray(userSnap.data()?.paymentMethods)
      ? userSnap.data().paymentMethods
      : [];

    const duplicateMethod = existingMethods.find(
      (method) => method.paystackAuthorizationCode === authorization.authorization_code,
    );

    const safeCardRecord = duplicateMethod || {
      id: randomUUID(),
      nickname: nickname || `${(authorization.brand || 'Card').charAt(0).toUpperCase() + (authorization.brand || 'Card').slice(1)} •••• ${authorization.last4 || '----'}`,
      brand: authorization.brand || 'Card',
      last4: authorization.last4 || '----',
      paystackAuthorizationCode: authorization.authorization_code,
      signature: authorization.signature || null,
      reusable: true,
      isDefault: existingMethods.length === 0,
      createdAt: new Date().toISOString(),
    };

    if (!duplicateMethod) {
      await usersRef.set(
        {
          paymentMethods: [...existingMethods, safeCardRecord],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    logger.info('Card saved to Firestore.', {
      uid,
      reference,
      duplicateMethod: !!duplicateMethod,
      cardId: safeCardRecord.id,
      brand: safeCardRecord.brand,
      last4: safeCardRecord.last4,
      reusable: safeCardRecord.reusable,
      isDefault: safeCardRecord.isDefault,
    });

    let refundSucceeded = false;
    let refundMessage = null;

    try {
      const refundResponse = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction: reference }),
      });

      const refundPayload = await refundResponse.json().catch(() => null);

      logger.info('Paystack refund response status.', {
        status: refundResponse.status,
        ok: refundResponse.ok,
        reference,
        responseStatus: refundPayload?.status,
        message: refundPayload?.message,
        errorCode: refundPayload?.code || null,
        errorType: refundPayload?.type || null,
      });

      if (!refundResponse.ok) {
        const refundError = new Error(`Paystack refund failed (${refundResponse.status})`);
        refundError.response = {
          data: refundPayload || `HTTP ${refundResponse.status}`,
        };
        throw refundError;
      }

      refundSucceeded = true;
    } catch (refundError) {
      refundMessage = 'Card saved, but refund is still processing. Please contact support if not reversed shortly.';
      logger.error('Paystack refund failed after successful authorization.', {
        reference,
        uid,
        error: refundError.response?.data || refundError.message,
      });
    }

    res.status(200).json({
      success: true,
      card: {
        id: safeCardRecord.id,
        nickname: safeCardRecord.nickname,
        brand: safeCardRecord.brand,
        last4: safeCardRecord.last4,
        reusable: safeCardRecord.reusable,
        isDefault: safeCardRecord.isDefault,
        signature: safeCardRecord.signature,
        createdAt: safeCardRecord.createdAt,
      },
      refunded: refundSucceeded,
      refundMessage,
    });
  } catch (error) {
    logger.error('verifyPaystack flow failed.', {
      reference,
      uid,
      error: error.response?.data || error.message,
    });

    res.status(500).json({
      success: false,
      message: 'Unable to verify card right now. Please try again.',
    });
  }
});

const BILLING_RULES = {
  DISPLAY_RATE_PER_MINUTE: 5,
  PLATFORM_FEE_RATE: 0.3,
  TUTOR_PAYOUT_RATE: 0.7,
};

async function chargeAuthorizationWithPaystack({ paystackSecretKey, email, amount, authorizationCode }) {
  if (!authorizationCode) {
    return { ok: false, reason: 'missing_authorization' };
  }

  const chargeResponse = await fetch('https://api.paystack.co/transaction/charge_authorization', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amount || 0) * 100),
      authorization_code: authorizationCode,
      currency: 'ZAR',
    }),
  });

  const chargePayload = await chargeResponse.json().catch(() => ({}));
  const chargeData = chargePayload?.data || {};
  const succeeded = chargeResponse.ok && chargePayload?.status === true && chargeData?.status === 'success';

  return {
    ok: succeeded,
    reason: succeeded ? null : (chargePayload?.message || 'gateway_declined'),
    transactionId: chargeData?.id ? String(chargeData.id) : null,
  };
}

exports.finalizeSessionBilling = onRequest({ cors: true, secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const sessionId = req.body?.sessionId?.toString().trim();
  if (!sessionId) {
    res.status(400).json({ success: false, message: 'Missing sessionId.' });
    return;
  }

  const sessionRef = db.collection('sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    res.status(404).json({ success: false, message: 'Session not found.' });
    return;
  }

  const session = sessionSnap.data() || {};
  const isParticipant = [session.studentId, session.tutorId].includes(decoded.uid);
  if (!isParticipant) {
    res.status(403).json({ success: false, message: 'Not allowed to close this session.' });
    return;
  }

  if (session.status === 'completed') {
    res.status(200).json({ success: true, session: { id: sessionId, ...session } });
    return;
  }

  const endedAt = Date.now();
  const startedAt = Number(session.billingStartedAt || session.studentJoinedAt || session.callStartedAt || endedAt);
  const billedSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const totalAmount = Number(((billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE).toFixed(2));
  const tutorAmount = Number((totalAmount * BILLING_RULES.TUTOR_PAYOUT_RATE).toFixed(2));
  const platformAmount = Number((totalAmount * BILLING_RULES.PLATFORM_FEE_RATE).toFixed(2));

  const studentRef = db.collection('users').doc(session.studentId);
  const studentSnap = await studentRef.get();
  const studentData = studentSnap.data() || {};
  const paymentMethods = studentData.paymentMethods || [];
  const selectedCard = paymentMethods.find((card) => card.id === session.selectedCardId)
    || paymentMethods.find((card) => card.isDefault)
    || paymentMethods[0]
    || null;

  const charge = await chargeAuthorizationWithPaystack({
    paystackSecretKey: PAYSTACK_SECRET_KEY.value(),
    email: studentData.email || session.studentEmail || '',
    amount: totalAmount,
    authorizationCode: selectedCard?.paystackAuthorizationCode || '',
  });

  const paymentStatus = charge.ok ? 'paid' : 'wallet_debt_recorded';
  const wallet = studentData.wallet || { balance: 0, currency: 'ZAR' };
  const nextWalletBalance = charge.ok
    ? Number(wallet.balance || 0)
    : Number((Number(wallet.balance || 0) - totalAmount).toFixed(2));

  const batch = db.batch();
  batch.set(sessionRef, {
    status: 'completed',
    endedAt,
    billedSeconds,
    totalAmount,
    payoutBreakdown: {
      platformFeeRate: BILLING_RULES.PLATFORM_FEE_RATE,
      tutorRate: BILLING_RULES.TUTOR_PAYOUT_RATE,
      tutorAmount,
      platformAmount,
    },
    paymentStatus,
    paymentTransactionId: charge.transactionId || null,
    chargedCardLast4: selectedCard?.last4 || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  batch.set(db.collection('classRequests').doc(session.requestId), {
    status: 'completed',
    statusDetail: 'Session ended. Billing completed.',
    endedAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  if (!charge.ok) {
    batch.set(studentRef, {
      wallet: {
        ...wallet,
        balance: nextWalletBalance,
        currency: wallet.currency || 'ZAR',
        updatedAt: new Date().toISOString(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();

  const updatedSnap = await sessionRef.get();
  res.status(200).json({
    success: true,
    session: { id: updatedSnap.id, ...updatedSnap.data() },
    charge: { ok: charge.ok, reason: charge.reason || null },
  });
});

exports.sendEmailFromQueue = onDocumentCreated(
  {
    document: 'emailEvents/{eventId}',
    secrets: [RESEND_API_KEY, EMAIL_FROM],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      logger.warn('sendEmailFromQueue received empty event data.', {
        eventId: event.params.eventId,
      });
      return;
    }

    const eventRef = db.collection('emailEvents').doc(event.params.eventId);
    const resendApiKey = RESEND_API_KEY.value();
    const emailFrom = EMAIL_FROM.value() || 'noreply@claxi.app';

    const resendPreview = getSafeSecretPreview(resendApiKey);

    logger.info('Email secret/config loaded.', {
      resendKeyExists: resendPreview.exists,
      resendKeyPrefix: resendPreview.prefix,
      resendKeyLength: resendPreview.length,
      emailFrom,
      eventId: event.params.eventId,
      eventType: data.eventType || null,
    });

    if (!resendApiKey) {
      logger.warn('RESEND_API_KEY missing. Skipping email send.');
      await eventRef.set(
        {
          status: 'skipped',
          reason: 'missing_resend_api_key',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const resend = new Resend(resendApiKey);
    const emailPayload = buildEmailPayload(data.eventType, data.payload);

    if (!emailPayload) {
      logger.warn('Unsupported email event type.', {
        eventId: event.params.eventId,
        eventType: data.eventType || null,
      });

      await eventRef.set(
        {
          status: 'ignored',
          reason: 'unsupported_event_type',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    logger.info('Prepared email payload summary.', {
      eventId: event.params.eventId,
      eventType: data.eventType,
      to: emailPayload.to,
      subject: emailPayload.subject,
      from: emailFrom,
    });

    try {
      const response = await resend.emails.send({
        from: emailFrom,
        ...emailPayload,
      });

      logger.info('Email sent successfully.', {
        eventId: event.params.eventId,
        provider: 'resend',
        providerMessageId: response.data?.id || null,
      });

      await eventRef.set(
        {
          status: 'sent',
          provider: 'resend',
          providerMessageId: response.data?.id || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      logger.error('Failed to send email.', {
        eventId: event.params.eventId,
        error: error.message,
        response: error.response?.data || null,
      });

      await eventRef.set(
        {
          status: 'failed',
          errorMessage: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  },
);
