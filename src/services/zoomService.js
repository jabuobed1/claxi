import { getFirebaseClients } from '../firebase/config';
import { debugError, debugLog } from '../utils/devLogger';

const ZOOM_AUTH_START_ENDPOINT = import.meta.env.VITE_ZOOM_AUTH_START_ENDPOINT || '/zoom-auth-start';
const ZOOM_CREATE_MEETING_ENDPOINT = import.meta.env.VITE_ZOOM_CREATE_MEETING_ENDPOINT || '/zoom-create-meeting';

async function getIdToken() {
  const clients = await getFirebaseClients();
  const idToken = await clients?.auth?.currentUser?.getIdToken?.();
  if (!idToken) {
    throw new Error('You must be signed in to use Zoom actions.');
  }
  return idToken;
}

export async function getZoomConnectUrl() {
  debugLog('zoomService', 'Starting Zoom connect flow.');
  const idToken = await getIdToken();
  const response = await fetch(ZOOM_AUTH_START_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({}),
  });

  const payload = await response.json().catch(() => ({}));
  debugLog('zoomService', 'Zoom connect endpoint response received.', { status: response.status, ok: response.ok });
  if (!response.ok || !payload?.success) {
    debugError('zoomService', 'Zoom connect flow failed.', payload);
    throw new Error(payload?.message || 'Unable to start Zoom account linking.');
  }

  debugLog('zoomService', 'Zoom connect URL created.');
  return payload.authUrl;
}

export async function createZoomMeetingForRequest({ requestId, topic, durationMinutes }) {
  debugLog('zoomService', 'Creating Zoom meeting for request.', { requestId, topic, durationMinutes });
  const idToken = await getIdToken();
  const response = await fetch(ZOOM_CREATE_MEETING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requestId, topic, durationMinutes }),
  });

  const payload = await response.json().catch(() => ({}));
  debugLog('zoomService', 'Zoom create meeting response received.', { status: response.status, ok: response.ok, requestId });
  if (!response.ok || !payload?.success) {
    debugError('zoomService', 'Zoom meeting creation failed.', payload);
    throw new Error(payload?.message || 'Unable to create Zoom meeting.');
  }

  debugLog('zoomService', 'Zoom meeting created successfully.', { requestId, meetingId: payload?.meeting?.meetingId });
  return payload.meeting;
}
