import { getFirebaseClients } from '../firebase/config';

const ICE_CONFIG_ENDPOINT = import.meta.env.VITE_ICE_CONFIG_ENDPOINT || '/ice-config';

export async function fetchIceServers() {
  const clients = await getFirebaseClients();
  const idToken = await clients?.auth?.currentUser?.getIdToken?.();

  if (!idToken) {
    throw new Error('You must be signed in before starting a session.');
  }

  const response = await fetch(ICE_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !Array.isArray(payload.iceServers)) {
    throw new Error(payload.message || 'Unable to load network relay configuration right now.');
  }

  return payload.iceServers;
}
