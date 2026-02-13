
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// --- REAL FIREBASE CONFIGURATION ---
// User Provided Config for: lords-tailor-87f35
export const firebaseConfig = {
  apiKey: "AIzaSyAT0ljTn2R39xMwv0SyRyJoDDhGdR36nsY",
  authDomain: "lords-tailor-87f35.firebaseapp.com",
  projectId: "lords-tailor-87f35",
  storageBucket: "lords-tailor-87f35.firebasestorage.app",
  messagingSenderId: "880443699412",
  appId: "1:880443699412:web:77fbd6d6eeb41884184b41",
  measurementId: "G-MYNZNJ3E65"
};

let app;
let db: Firestore | null = null;
let initError: any = null;

try {
    // SINGLETON PATTERN: Strictly check if app exists
    // This prevents "Firebase: Firebase App named '[DEFAULT]' already exists" error
    if (getApps().length > 0) {
        app = getApp();
        console.log("♻️ Firebase App Reused");
    } else {
        app = initializeApp(firebaseConfig);
        console.log("✅ Firebase App Initialized");
    }

    // Initialize Firestore
    // Using simple getFirestore(app) is safer than passing config again
    db = getFirestore(app);
    console.log("✅ Firestore Database Instance Ready");

} catch (error) {
    console.error("CRITICAL FIREBASE ERROR:", error);
    initError = error;
    // Last ditch effort to recover if possible
    try {
        if (!app && getApps().length > 0) {
            app = getApp();
            db = getFirestore(app);
        }
    } catch(e) {
        console.error("Recovery Failed", e);
    }
}

export { db, initError };
