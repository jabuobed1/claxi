const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');

admin.initializeApp();

const db = admin.firestore();
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || 'noreply@claxi.app';
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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

async function verifyPaystackTransaction(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paystack verify failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function refundPaystackTransaction(reference) {
  const response = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction: reference }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paystack refund failed (${response.status}): ${text}`);
  }

  return response.json();
}

exports.verifyPaystack = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  if (!PAYSTACK_SECRET_KEY) {
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

  const uid = decodedToken.uid;
  const reference = req.body?.reference?.toString().trim();

  if (!reference) {
    res.status(400).json({ success: false, message: 'Missing transaction reference.' });
    return;
  }

  try {
    const verification = await verifyPaystackTransaction(reference);
    const transactionData = verification?.data;

    if (transactionData?.status !== 'success') {
      res.status(400).json({ success: false, message: 'Transaction verification failed.' });
      return;
    }

    const authorization = transactionData.authorization || {};
    const authorizationCode = authorization.authorization_code;
    const reusable = authorization.reusable === true;

    if (!authorizationCode || !reusable) {
      res.status(400).json({
        success: false,
        message: !authorizationCode
          ? 'Authorization details not available for this card.'
          : 'Card is not reusable. Please use a reusable card.',
      });
      return;
    }

    const usersRef = db.collection('users').doc(uid);
    const userSnap = await usersRef.get();
    const existingMethods = Array.isArray(userSnap.data()?.paymentMethods) ? userSnap.data().paymentMethods : [];

    const duplicateMethod = existingMethods.find((method) => method.paystackAuthorizationCode === authorizationCode);

    const paymentMethod = duplicateMethod || {
      id: crypto.randomUUID(),
      nickname: `${authorization.brand || 'Card'} •••• ${authorization.last4 || '----'}`,
      brand: authorization.brand || 'Card',
      last4: authorization.last4 || '----',
      paystackAuthorizationCode: authorizationCode,
      reusable,
      isDefault: existingMethods.length === 0,
      createdAt: new Date().toISOString(),
    };

    if (!duplicateMethod) {
      await usersRef.set(
        {
          paymentMethods: [...existingMethods, paymentMethod],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    let refundSucceeded = false;
    let refundErrorMessage = null;

    try {
      await refundPaystackTransaction(reference);
      refundSucceeded = true;
    } catch (refundError) {
      refundErrorMessage = 'Card saved, but refund is still processing. Please contact support if not reversed shortly.';
      logger.error('Paystack refund failed after successful authorization.', {
        reference,
        uid,
        error: refundError.message,
      });
    }

    res.status(200).json({
      success: true,
      card: {
        id: paymentMethod.id,
        nickname: paymentMethod.nickname,
        brand: paymentMethod.brand,
        last4: paymentMethod.last4,
        reusable: paymentMethod.reusable,
        isDefault: paymentMethod.isDefault,
        createdAt: paymentMethod.createdAt,
      },
      refunded: refundSucceeded,
      refundMessage: refundErrorMessage,
    });
  } catch (error) {
    logger.error('verifyPaystack flow failed.', { reference, uid, error: error.message });
    res.status(500).json({ success: false, message: 'Unable to verify card right now. Please try again.' });
  }
});

exports.sendEmailFromQueue = onDocumentCreated('emailEvents/{eventId}', async (event) => {
  const data = event.data?.data();
  if (!data) {
    return;
  }

  const eventRef = db.collection('emailEvents').doc(event.params.eventId);

  if (!resend) {
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
