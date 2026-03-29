import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, query, where, orderBy, runTransaction } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const hasFirebaseEnv = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let cachedClients = null;

function initializeFirebase() {
  if (cachedClients) {
    return cachedClients;
  }

  try {
    const app = initializeApp(firebaseConfig);
    cachedClients = {
      auth: getAuth(app),
      db: getFirestore(app),
      // Auth module functions
      authModule: {
        onAuthStateChanged,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        updateProfile,
        signOut,
        deleteUser,
      },
      // Firestore module functions
      firestoreModule: {
        doc,
        getDoc,
        setDoc,
        updateDoc,
        addDoc,
        collection,
        serverTimestamp,
        onSnapshot,
        query,
        where,
        orderBy,
        runTransaction,
      },
    };
    return cachedClients;
  } catch (error) {
    console.warn('Firebase SDK unavailable, using local mock mode.', error);
    return null;
  }
}

export async function getFirebaseClients() {
  if (!hasFirebaseEnv) {
    return null;
  }

  return initializeFirebase();
}
