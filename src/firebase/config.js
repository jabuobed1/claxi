const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const appModuleName = 'firebase/app';
const authModuleName = 'firebase/auth';
const firestoreModuleName = 'firebase/firestore';

export const hasFirebaseEnv = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let cachedClients = null;

export async function getFirebaseClients() {
  if (!hasFirebaseEnv) {
    return null;
  }

  if (cachedClients) {
    return cachedClients;
  }

  try {
    const appModule = await import(/* @vite-ignore */ appModuleName);
    const authModule = await import(/* @vite-ignore */ authModuleName);
    const firestoreModule = await import(/* @vite-ignore */ firestoreModuleName);

    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(firebaseConfig);

    cachedClients = {
      auth: authModule.getAuth(app),
      db: firestoreModule.getFirestore(app),
      authModule,
      firestoreModule,
    };

    return cachedClients;
  } catch (error) {
    console.warn('Firebase SDK unavailable, using local mock mode.', error);
    return null;
  }
}
