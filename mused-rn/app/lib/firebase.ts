import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import Config from "react-native-config";

const firebaseConfig = {
  apiKey: Config.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Config.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Config.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Config.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Config.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Config.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: Config.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
