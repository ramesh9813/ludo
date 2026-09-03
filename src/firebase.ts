import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA144Urt7h5bal8p-lOaVScujReYwDKiZk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "game-9813.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "game-9813",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "game-9813.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "195842128329",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:195842128329:web:295e933d721c90ccc81018"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
