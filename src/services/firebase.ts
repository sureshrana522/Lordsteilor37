import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// Firebase Config
export const firebaseConfig = {
  apiKey: "AIzaSyAT0ljTn2R39xMwv0SyRyJoDDhGdR36nsY",
  authDomain: "lords-tailor-87f35.firebaseapp.com",
  projectId: "lords-tailor-87f35",
  storageBucket: "lords-tailor-87f35.appspot.com",
  messagingSenderId: "880443699412",
  appId: "1:880443699412:web:77fbd6d6eeb41884184b41"
};

// Firebase Init
let app;
let db = null;
let auth = null;
let initError = null;

try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("Firebase Connected with Auth & Firestore");
} catch (err) {
  console.error("Firebase Initialization Error:", err);
  initError = err;
}

// Login Function
export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login Success:", userCredential.user.uid);
    return { success: true, uid: userCredential.user.uid, email: userCredential.user.email };
  } catch (err: any) {
    console.error("Login Error:", err.message);
    return { success: false, error: err.message };
  }
};

// Logout Function
export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log("User Logged Out");
    return { success: true };
  } catch (err: any) {
    console.error("Logout Error:", err.message);
    return { success: false, error: err.message };
  }
};

// Auth State Listener (Optional)
export const onUserChange = (callback: (user: any) => void) => {
  if (!auth) return;
  onAuthStateChanged(auth, user => {
    callback(user);
  });
};

export { db, auth, initError };
