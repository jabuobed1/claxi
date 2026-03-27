import { getFirebaseClients } from '../firebase/config';

export async function upsertUserProfile({ uid, email, displayName, role }) {
  const clients = await getFirebaseClients();

  const profileShape = {
    uid,
    email,
    fullName: displayName,
    displayName,
    role: role || 'student',
    profilePhoto: '',
    phoneNumber: '',
    subjects: [],
    bio: '',
    availability: '',
  };

  if (!clients) {
    return profileShape;
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc, serverTimestamp, setDoc } = firestoreModule;
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  await setDoc(
    userRef,
    {
      ...profileShape,
      updatedAt: serverTimestamp(),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    },
    { merge: true },
  );

  const snap = await getDoc(userRef);
  return { uid, ...snap.data() };
}

export async function updateUserProfile(uid, updates) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return { uid, ...updates };
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc, serverTimestamp, setDoc } = firestoreModule;
  const userRef = doc(db, 'users', uid);

  await setDoc(
    userRef,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const snap = await getDoc(userRef);
  return { uid, ...snap.data() };
}

export async function getUserProfile(uid) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return null;
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc } = firestoreModule;
  const snap = await getDoc(doc(db, 'users', uid));

  if (!snap.exists()) {
    return null;
  }

  return { uid: snap.id, ...snap.data() };
}
