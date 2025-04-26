// src/lib/firebase/clientApp.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
// Import other Firebase services as needed, e.g., getFirestore, getAuth
// import { getFirestore } from 'firebase/firestore';
// import { getAuth } from 'firebase/auth';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
let firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get specific Firebase services (uncomment and use as needed)
// export const db = getFirestore(firebaseApp);
// export const auth = getAuth(firebaseApp);
// export const storage = getStorage(firebaseApp); // Example for storage

export default firebaseApp;

// Add a note about environment variables
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.warn(
    'Firebase API Key is missing. Please set NEXT_PUBLIC_FIREBASE_API_KEY in your .env file.'
  );
}
