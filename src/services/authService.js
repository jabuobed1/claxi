import { getFirebaseClients } from '../firebase/config';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { getUserProfile, upsertUserProfile } from './userService';

const MOCK_USER_KEY = 'claxi_mock_user';

export function subscribeToAuthChanges(callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      const saved = localStorage.getItem(MOCK_USER_KEY);
      callback(saved ? JSON.parse(saved) : null);
      return;
    }

    const { auth, authModule } = clients;
    unsub = authModule.onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null);
        return;
      }

      const profile = (await getUserProfile(firebaseUser.uid)) || {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        fullName: firebaseUser.displayName,
        displayName: firebaseUser.displayName,
        role: 'student',
      };

      callback({ ...profile, uid: firebaseUser.uid });
    });
  });

  return () => unsub();
}

export async function loginWithEmail({ email, password }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const mockUser = {
      uid: 'mock-user',
      email,
      fullName: email.split('@')[0],
      displayName: email.split('@')[0],
      role: 'student',
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    return mockUser;
  }

  const { auth, authModule } = clients;
  const credential = await authModule.signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user.uid);

  return {
    uid: credential.user.uid,
    email: credential.user.email,
    fullName: profile?.fullName || profile?.displayName || credential.user.displayName,
    displayName: profile?.displayName || credential.user.displayName,
    role: profile?.role || 'student',
    ...profile,
  };
}

export async function signupWithEmail({ name, email, password, role }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const mockUser = {
      uid: 'mock-user',
      email,
      fullName: name,
      displayName: name,
      role,
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    return mockUser;
  }

  const { auth, authModule } = clients;
  const credential = await authModule.createUserWithEmailAndPassword(auth, email, password);
  await authModule.updateProfile(credential.user, { displayName: name });

  const profile = await upsertUserProfile({
    uid: credential.user.uid,
    email,
    displayName: name,
    role,
  });

  await queueEmailEvent(EMAIL_EVENT_TYPES.WELCOME, {
    userId: credential.user.uid,
    email,
    fullName: name,
    role,
  });

  return {
    uid: credential.user.uid,
    email,
    fullName: profile.fullName,
    displayName: profile.displayName,
    role: profile.role,
    ...profile,
  };
}

export async function logoutUser() {
  const clients = await getFirebaseClients();

  if (!clients) {
    localStorage.removeItem(MOCK_USER_KEY);
    return;
  }

  await clients.authModule.signOut(clients.auth);
}
