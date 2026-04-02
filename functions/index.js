const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const { randomUUID, createHmac, timingSafeEqual } = require('crypto');

admin.initializeApp();

const db = admin.firestore();

const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const EMAIL_FROM = defineSecret('EMAIL_FROM');
const ZOOM_CLIENT_ID = defineSecret('ZOOM_CLIENT_ID');
const ZOOM_CLIENT_SECRET = defineSecret('ZOOM_CLIENT_SECRET');
const ZOOM_REDIRECT_URI = defineSecret('ZOOM_REDIRECT_URI');
const ZOOM_WEBHOOK_SECRET = defineSecret('ZOOM_WEBHOOK_SECRET');
const APP_BASE_URL = defineSecret('APP_BASE_URL');

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

exports.zoomAuthStart = onRequest({ cors: true, secrets: [ZOOM_CLIENT_ID, ZOOM_REDIRECT_URI] }, async (req, res) => {
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
  logger.info('zoomAuthStart called by authenticated user.', { uid: decoded.uid });

  const state = randomUUID();
  await db.collection('zoomOAuthStates').doc(state).set({
    uid: decoded.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${encodeURIComponent(ZOOM_CLIENT_ID.value())}&redirect_uri=${encodeURIComponent(ZOOM_REDIRECT_URI.value())}&state=${encodeURIComponent(state)}`;
  logger.info('zoomAuthStart generated OAuth URL.', { uid: decoded.uid, state });
  res.status(200).json({ success: true, authUrl });
});

exports.zoomOAuthCallback = onRequest({ cors: true, secrets: [ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_REDIRECT_URI, APP_BASE_URL] }, async (req, res) => {
  const code = req.query.code?.toString();
  const state = req.query.state?.toString();
  logger.info('zoomOAuthCallback received callback.', { hasCode: Boolean(code), hasState: Boolean(state) });
  if (!code || !state) {
    res.status(400).send('Missing code/state');
    return;
  }

  const stateRef = db.collection('zoomOAuthStates').doc(state);
  const stateSnap = await stateRef.get();
  if (!stateSnap.exists) {
    logger.warn('zoomOAuthCallback received invalid OAuth state.', { state });
    res.status(400).send('Invalid OAuth state.');
    return;
  }

  const uid = stateSnap.data()?.uid;
  await stateRef.delete();
  if (!uid) {
    logger.warn('zoomOAuthCallback missing uid from OAuth state.', { state });
    res.status(400).send('Missing user mapping for OAuth state.');
    return;
  }

  const tokenResponse = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID.value()}:${ZOOM_CLIENT_SECRET.value()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ZOOM_REDIRECT_URI.value(),
    }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    logger.error('Zoom OAuth token exchange failed', { tokenPayload });
    res.status(500).send('Failed to link Zoom account.');
    return;
  }

  const meResp = await fetch('https://api.zoom.us/v2/users/me', {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const me = await meResp.json().catch(() => ({}));

  await db.collection('users').doc(uid).set({
    tutorProfile: {
      zoom: {
        linked: true,
        accountId: me.account_id || tokenPayload?.scope || uid,
        email: me.email || '',
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        expiresAt: Date.now() + ((Number(tokenPayload.expires_in) || 3600) * 1000),
        linkedAt: Date.now(),
      },
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('zoomOAuthCallback linked Zoom account for user.', { uid, zoomEmail: me.email || null });

  const frontendBase = APP_BASE_URL.value()?.trim() || `${req.protocol}://${req.get('host')}`;
  res.redirect(302, `${frontendBase.replace(/\/$/, '')}/app/onboarding?role=tutor&zoom=connected`);
});

async function refreshZoomAccessTokenIfNeeded(zoomMeta = {}) {
  if (zoomMeta.accessToken && Number(zoomMeta.expiresAt || 0) > Date.now() + 60_000) {
    return zoomMeta;
  }
  if (!zoomMeta.refreshToken) {
    throw new Error('Zoom account is not linked or refresh token is missing.');
  }

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID.value()}:${ZOOM_CLIENT_SECRET.value()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: zoomMeta.refreshToken,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.reason || 'Unable to refresh Zoom token.');
  }

  return {
    ...zoomMeta,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || zoomMeta.refreshToken,
    expiresAt: Date.now() + ((Number(payload.expires_in) || 3600) * 1000),
  };
}

exports.zoomCreateMeeting = onRequest({ cors: true, secrets: [ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET] }, async (req, res) => {
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
  logger.info('zoomCreateMeeting called.', { uid: decoded.uid, requestId: req.body?.requestId || null });

  const requestId = req.body?.requestId?.toString();
  const topic = req.body?.topic?.toString() || 'Claxi session';
  const durationMinutes = Number(req.body?.durationMinutes || 30);

  const userRef = db.collection('users').doc(decoded.uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  const existingZoom = userData?.tutorProfile?.zoom || {};

  try {
    const zoomMeta = await refreshZoomAccessTokenIfNeeded(existingZoom);
    const zoomResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${zoomMeta.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        type: 1,
        duration: durationMinutes,
        settings: {
          waiting_room: true,
          join_before_host: true,
        },
      }),
    });
    const meetingPayload = await zoomResponse.json().catch(() => ({}));
    if (!zoomResponse.ok) {
      throw new Error(meetingPayload?.message || 'Zoom meeting creation failed.');
    }

    await userRef.set({
      tutorProfile: {
        ...(userData.tutorProfile || {}),
        zoom: zoomMeta,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (requestId) {
      await db.collection('classRequests').doc(requestId).set({
        meetingProvider: 'zoom',
        meetingLink: meetingPayload.join_url || '',
        meetingId: String(meetingPayload.id || ''),
        meetingPassword: meetingPayload.password || '',
        statusDetail: 'Zoom meeting created. Waiting for student to join.',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    res.status(200).json({
      success: true,
      meeting: {
        joinUrl: meetingPayload.join_url || '',
        meetingId: String(meetingPayload.id || ''),
        password: meetingPayload.password || '',
        startUrl: meetingPayload.start_url || '',
        whiteboardRoomId: requestId || randomUUID(),
      },
    });
  } catch (error) {
    logger.error('zoomCreateMeeting failed', { uid: decoded.uid, error: error.message });
    res.status(500).json({ success: false, message: error.message || 'Unable to create Zoom meeting.' });
  }
});

function verifyZoomWebhookSignature(req, webhookSecret) {
  const timestamp = req.headers['x-zm-request-timestamp']?.toString();
  const signature = req.headers['x-zm-signature']?.toString();

  if (!timestamp || !signature || !webhookSecret) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) {
    return false;
  }

  const bodyString = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const message = `v0:${timestamp}:${bodyString}`;
  const expected = `v0=${createHmac('sha256', webhookSecret).update(message).digest('hex')}`;

  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

exports.zoomWebhook = onRequest({ cors: true, secrets: [ZOOM_WEBHOOK_SECRET] }, async (req, res) => {
  const webhookSecret = ZOOM_WEBHOOK_SECRET.value();
  const isValidSignature = verifyZoomWebhookSignature(req, webhookSecret);
  if (!isValidSignature) {
    logger.warn('zoomWebhook signature verification failed.', {
      hasTimestamp: Boolean(req.headers['x-zm-request-timestamp']),
      hasSignature: Boolean(req.headers['x-zm-signature']),
    });
    res.status(401).json({ success: false, message: 'Invalid Zoom webhook signature.' });
    return;
  }
  logger.info('zoomWebhook signature verified.', { event: req.body?.event || null });

  if (req.body?.event === 'endpoint.url_validation') {
    const plainToken = req.body?.payload?.plainToken?.toString() || '';
    const encryptedToken = createHmac('sha256', webhookSecret).update(plainToken).digest('hex');
    res.status(200).json({
      plainToken,
      encryptedToken,
    });
    return;
  }

  const eventType = req.body?.event;
  if (eventType === 'meeting.ended') {
    const meetingId = String(req.body?.payload?.object?.id || '');
    if (meetingId) {
      const sessionsSnap = await db.collection('sessions').where('meetingId', '==', meetingId).limit(1).get();
      const match = sessionsSnap.docs[0];
      if (match) {
        const data = match.data();
        await match.ref.set({
          status: 'completed',
          endedAt: Date.now(),
          zoomEndedAt: Date.now(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        if (data.requestId) {
          await db.collection('classRequests').doc(data.requestId).set({
            status: 'completed',
            statusDetail: 'Zoom call ended. Finalizing billing.',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        logger.info('zoomWebhook processed meeting.ended event.', { meetingId, sessionId: match.id, requestId: data.requestId || null });
      }
    }
  }
  res.status(200).json({ success: true });
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
