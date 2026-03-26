import { getFirebaseClients } from '../firebase/config';
import { REQUEST_STATUSES } from '../utils/requestStatus';

function getMockRequests() {
  return JSON.parse(localStorage.getItem('claxi_mock_requests') || '[]');
}

function setMockRequests(items) {
  localStorage.setItem('claxi_mock_requests', JSON.stringify(items));
  window.dispatchEvent(new StorageEvent('storage'));
}

export async function createClassRequest(payload) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const items = getMockRequests();
    const request = {
      id: crypto.randomUUID(),
      ...payload,
      mode: 'online',
      status: REQUEST_STATUSES.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMockRequests([request, ...items]);
    return request.id;
  }

  const { db, firestoreModule } = clients;
  const { addDoc, collection, serverTimestamp } = firestoreModule;
  const docRef = await addDoc(collection(db, 'classRequests'), {
    ...payload,
    mode: 'online',
    status: REQUEST_STATUSES.PENDING,
    tutorId: null,
    tutorName: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

function withMockSnapshot(filterFn, callback) {
  const emit = () => callback(getMockRequests().filter(filterFn));
  emit();
  window.addEventListener('storage', emit);
  return () => window.removeEventListener('storage', emit);
}

export function subscribeToStudentRequests(studentId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.studentId === studentId, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;
    const queryRef = query(
      collection(db, 'classRequests'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub();
}

export function subscribeToAvailableRequests(callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.status === REQUEST_STATUSES.PENDING, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;
    const queryRef = query(
      collection(db, 'classRequests'),
      where('status', '==', REQUEST_STATUSES.PENDING),
      orderBy('createdAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub();
}

export async function acceptClassRequest({ requestId, tutorId, tutorName }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const next = getMockRequests().map((item) =>
      item.id === requestId
        ? {
            ...item,
            tutorId,
            tutorName,
            status: REQUEST_STATUSES.ACCEPTED,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    setMockRequests(next);
    return;
  }

  const { db, firestoreModule } = clients;
  const { doc, serverTimestamp, updateDoc } = firestoreModule;
  await updateDoc(doc(db, 'classRequests', requestId), {
    tutorId,
    tutorName,
    status: REQUEST_STATUSES.ACCEPTED,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToTutorClasses(tutorId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      unsub = withMockSnapshot((item) => item.tutorId === tutorId, callback);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;
    const queryRef = query(
      collection(db, 'classRequests'),
      where('tutorId', '==', tutorId),
      orderBy('updatedAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  });

  return () => unsub();
}
