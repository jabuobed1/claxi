import { getFirebaseClients } from '../firebase/config';

function buildDefaultProfile({ uid, email, displayName, role }) {
  const normalizedRole = role || 'student';

  return {
    uid,
    email,
    fullName: displayName,
    displayName,
    role: normalizedRole,
    activeRole: normalizedRole,
    roles: normalizedRole === 'tutor' ? ['tutor'] : ['student'],
    profilePhoto: '',
    phoneNumber: '',
    subjects: normalizedRole === 'tutor' ? ['mathematics'] : ['mathematics'],
    bio: '',
    availability: '',
    onlineStatus: 'offline',
    studentProfile: {
      grade: '',
      curriculum: '',
      discoverySource: '',
    },
    tutorProfile: {
      highestGradeResultUrl: '',
      mathScore: null,
      gradesToTutor: [],
      topics: [],
      verificationStatus: 'pending',
      payout: {
        bankName: '',
        accountNumber: '',
        accountHolder: '',
      },
    },
    paymentMethods: [],
  };
}

export async function upsertUserProfile({ uid, email, displayName, role }) {
  const clients = await getFirebaseClients();

  const profileShape = buildDefaultProfile({ uid, email, displayName, role });

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


function scoreTutorForTopic(tutor = {}, topic = '') {
  const topicKey = topic.toLowerCase();
  const topicRatings = tutor?.tutorProfile?.topicRatings || {};
  const topicScore = Number(topicRatings[topicKey] || 0);
  const overall = Number(tutor?.tutorProfile?.overallRating || 0);
  const sessionLoadPenalty = tutor?.activeSessionId ? 100 : 0;
  return topicScore * 2 + overall - sessionLoadPenalty;
}

export async function getTutorCandidatesForRequest({ topic }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return [];
  }

  const { db, firestoreModule } = clients;
  const { collection, getDocs, query, where } = firestoreModule;

  const q = query(
    collection(db, 'users'),
    where('activeRole', '==', 'tutor'),
    where('onlineStatus', '==', 'online'),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((doc) => ({ uid: doc.id, ...doc.data() }))
    .filter((tutor) => {
      const tutorProfile = tutor.tutorProfile || {};
      const isVerified = tutorProfile.verificationStatus === 'verified';
      const teachesMath = (tutor.subjects || []).includes('mathematics');
      return isVerified && teachesMath && !tutor.activeSessionId;
    })
    .sort((a, b) => scoreTutorForTopic(b, topic) - scoreTutorForTopic(a, topic));
}
