import { getFirebaseClients } from '../firebase/config';

export async function uploadUserFile({ userId, file, pathPrefix = 'uploads' }) {
  if (!file) {
    throw new Error('No file selected.');
  }

  const clients = await getFirebaseClients();
  if (!clients?.storage || !clients?.storageModule) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${pathPrefix}/${userId}/${Date.now()}-${safeName}`;
    return { downloadUrl: '', objectPath };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${pathPrefix}/${userId}/${Date.now()}-${safeName}`;
  const fileRef = clients.storageModule.ref(clients.storage, objectPath);

  await clients.storageModule.uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: 'public,max-age=3600',
  });

  const downloadUrl = await clients.storageModule.getDownloadURL(fileRef);
  return { downloadUrl, objectPath };
}

const activeSessionRecorders = new Map();

function sanitizeStorageName(name) {
  return String(name || 'recording').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildSessionRecordingPath(sessionId) {
  const safeSessionId = sanitizeStorageName(sessionId || 'unknown-session');
  return `session-recordings/${safeSessionId}/${Date.now()}.webm`;
}

export function startSessionScreenRecording({ sessionId, stream }) {
  if (!sessionId || !stream) return false;
  if (activeSessionRecorders.has(sessionId)) return true;
  if (typeof MediaRecorder === 'undefined') {
    console.warn('[storageService] MediaRecorder is not supported in this browser.');
    return false;
  }

  const videoTrack = stream.getVideoTracks?.()[0] || null;
  if (!videoTrack || videoTrack.readyState !== 'live') {
    return false;
  }

  let recorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
    });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event?.data?.size) {
      chunks.push(event.data);
    }
  };

  recorder.start(1000);

  activeSessionRecorders.set(sessionId, {
    recorder,
    chunks,
    startedAt: Date.now(),
  });

  return true;
}

export async function stopSessionScreenRecording({ sessionId }) {
  if (!sessionId) return null;

  const entry = activeSessionRecorders.get(sessionId);
  if (!entry) return null;

  const { recorder, chunks } = entry;

  const blob = await new Promise((resolve) => {
    const finalize = () => {
      const type = chunks[0]?.type || recorder.mimeType || 'video/webm';
      resolve(new Blob(chunks, { type }));
    };

    recorder.onstop = finalize;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      finalize();
    }
  });

  activeSessionRecorders.delete(sessionId);

  if (!blob || blob.size === 0) {
    return null;
  }

  const objectPath = buildSessionRecordingPath(sessionId);
  const clients = await getFirebaseClients();

  if (!clients?.storage || !clients?.storageModule) {
    console.log('[storageService] Session recording saved (mock mode):', {
      sessionId,
      objectPath,
      size: blob.size,
    });
    return { objectPath, downloadUrl: '' };
  }

  const fileRef = clients.storageModule.ref(clients.storage, objectPath);
  await clients.storageModule.uploadBytes(fileRef, blob, {
    contentType: blob.type || 'video/webm',
  });

  const downloadUrl = await clients.storageModule.getDownloadURL(fileRef);
  console.log('[storageService] Session recording uploaded successfully:', {
    sessionId,
    objectPath,
    size: blob.size,
  });

  return { objectPath, downloadUrl };
}
