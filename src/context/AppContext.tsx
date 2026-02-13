// src/context/AppContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase"; // Make sure this file exports both auth and db

interface AppContextType {
  user: User | null;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      setLoading(true);

      if (firebaseUser) {
        const userid = firebaseUser.uid;
        setUser(firebaseUser);

        // 🔥 Auto-create wallet if it doesn't exist
        const walletRef = doc(db, "wallets", userid); // "wallets" collection (plural is better)
        const walletSnap = await getDoc(walletRef);

        if (!walletSnap.exists()) {
          await setDoc(walletRef, {
            balance: 0,
            hold: 0,
            totalEarned: 0,
            createdAt: serverTimestamp(),
          });
          console.log(`Wallet created for user: ${userid}`);
        } else {
          console.log(`Wallet already exists for user: ${userid}`);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []); // Empty dependency array → runs once on mount

  return (
    <AppContext.Provider value={{ user, loading }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context safely
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
