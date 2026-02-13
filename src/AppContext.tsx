import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "../services/firebase";
import { db } from "../services/firebase";

const AppContext = createContext<any>(null);

export const AppProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userId = firebaseUser.uid;

        setUser(firebaseUser);

        // 🔥 WALLET AUTO CREATE FIX
        const walletRef = doc(db, "wallet", userId);
        const walletSnap = await getDoc(walletRef);

        if (!walletSnap.exists()) {
          await setDoc(walletRef, {
            balance: 0,
            hold: 0,
            totalEarned: 0,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <AppContext.Provider value={{ user, loading }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);