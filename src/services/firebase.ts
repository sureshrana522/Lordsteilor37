// src/services/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🔹 Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAT0ljTn2R39xMwv0SyRyJoDDhGdR36nsY",
  authDomain: "lords-tailor-87f35.firebaseapp.com",
  projectId: "lords-tailor-87f35",
  storageBucket: "lords-tailor-87f35.appspot.com",
  messagingSenderId: "880443699412",
  appId: "1:880443699412:web:77fbd6d6eeb41884184b41"
};

// 🔹 Initialize Firebase app
let app;
let db = null;
let auth = null;
let initError = null;

try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("✅ Firebase Connected Successfully");
} catch (err) {
  console.error("❌ Firebase Initialization Error:", err);
  initError = err;
}

// 🔹 Export Firestore DB, Auth, and any init errors
export { db, auth, initError };
