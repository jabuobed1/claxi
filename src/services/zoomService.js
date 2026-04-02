import { getFirebaseClients } from '../firebase/config';

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
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Unable to start Zoom account linking.');
  }

  return payload.authUrl;
}

export async function createZoomMeetingForRequest({ requestId, topic, durationMinutes }) {
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
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Unable to create Zoom meeting.');
  }

  return payload.meeting;
}
