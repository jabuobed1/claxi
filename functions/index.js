const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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

exports.verifyPaystack = onRequest({ cors: true, secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  logger.info('verifyPaystack request body received.', { body: req.body || null });

  const paystackSecretKey = PAYSTACK_SECRET_KEY.value();
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
    logger.warn('Failed to verify Firebase auth token.', error);
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const uid = decodedToken.uid;
  const providedUserId = body.userId?.toString().trim();
  const nickname = body.nickname?.toString().trim();
  const reference = body.reference?.toString().trim();

  logger.info('verifyPaystack reference received.', { reference, uid, providedUserId });

  if (!reference) {
    res.status(400).json({ success: false, message: 'Missing transaction reference.' });
    return;
  }

  if (providedUserId && providedUserId !== uid) {
    res.status(400).json({ success: false, message: 'Invalid userId supplied.' });
    return;
  }

  try {
    const verificationResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const verificationPayload = await verificationResponse.json().catch(() => null);
    logger.info('Paystack verify response status.', {
      status: verificationResponse.status,
      ok: verificationResponse.ok,
      reference,
      responseStatus: verificationPayload?.status,
      message: verificationPayload?.message,
    });

    if (!verificationResponse.ok) {
      const verifyError = new Error('Paystack verification request failed.');
      verifyError.response = { data: verificationPayload || `HTTP ${verificationResponse.status}` };
      throw verifyError;
    }

    const transactionData = verificationPayload?.data;
    const authorization = transactionData?.authorization;

    if (!transactionData || transactionData.status !== 'success') {
      res.status(400).json({ success: false, message: 'Transaction verification failed or transaction is not successful.' });
      return;
    }

    if (!authorization?.authorization_code) {
      res.status(400).json({ success: false, message: 'Authorization details not available for this transaction.' });
      return;
    }

    if (authorization.reusable !== true) {
      res.status(400).json({ success: false, message: 'Card is not reusable. Please use a reusable card.' });
      return;
    }

    const usersRef = db.collection('users').doc(uid);
    const userSnap = await usersRef.get();
    const existingMethods = Array.isArray(userSnap.data()?.paymentMethods) ? userSnap.data().paymentMethods : [];

    const duplicateMethod = existingMethods.find((method) => method.paystackAuthorizationCode === authorization.authorization_code);

    const safeCardRecord = duplicateMethod || {
      id: randomUUID(),
      nickname: nickname || `${authorization.brand || 'Card'} •••• ${authorization.last4 || '----'}`,
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
        message: refundPayload?.message,
      });

      if (!refundResponse.ok) {
        const refundError = new Error('Paystack refund request failed.');
        refundError.response = { data: refundPayload || `HTTP ${refundResponse.status}` };
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
    res.status(500).json({ success: false, message: 'Unable to verify card right now. Please try again.' });
  }
});

exports.sendEmailFromQueue = onDocumentCreated({
  document: 'emailEvents/{eventId}',
  secrets: [RESEND_API_KEY, EMAIL_FROM],
}, async (event) => {
  const data = event.data?.data();
  if (!data) {
    return;
  }

  const eventRef = db.collection('emailEvents').doc(event.params.eventId);
  const resendApiKey = RESEND_API_KEY.value();

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
  const emailFrom = EMAIL_FROM.value() || 'noreply@claxi.app';
  const emailPayload = buildEmailPayload(data.eventType, data.payload);

  if (!emailPayload) {
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

  try {
    const response = await resend.emails.send({
      from: emailFrom,
      ...emailPayload,
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
    logger.error('Failed to send email', error);
    await eventRef.set(
      {
        status: 'failed',
        errorMessage: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
});
