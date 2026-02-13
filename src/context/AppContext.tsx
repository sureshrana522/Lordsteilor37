import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback
} from "react";

import type {
  Order,
  Stats,
  AppConfig,
  SystemUser,
  WalletTransaction,
  TransactionRequest
} from "../types";

// REMOVED: import { UserRole } from "../types";
import { MOCK_ORDERS, MOCK_SYSTEM_USERS } from "../services/mockData";
import { db, initError } from "../services/firebase";

import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  addDoc
} from "firebase/firestore";

/* ================= CONTEXT TYPE ================= */

// Ye bata raha hai ki AppContext me kya kya values aur functions available hain
interface AppContextType {
  role: string; // CHANGED: UserRole se string
  currentUser: SystemUser | null; // logged in user info
  stats: Stats; // dashboard ke liye live stats
  systemUsers: SystemUser[]; // saare system users
  orders: Order[]; // saare orders
  transactions: WalletTransaction[]; // wallet transactions
  requests: TransactionRequest[]; // add/withdraw requests
  isDemoMode: boolean; // agar firebase nahi hai to demo mode

  loginUser: (role: string, specificUserId?: string) => void; // CHANGED: UserRole se string
  authenticateUser: (mobile: string, password: string) => SystemUser | null; // login check

  requestAddFunds: (amount: number, utr: string) => Promise<void>; // add funds request
  requestWithdrawal: (
    amount: number,
    method: string,
    paymentDetails: string
  ) => Promise<void>; // withdrawal request

  approveRequest: (id: string, approved: boolean) => Promise<boolean>; // admin approve
}

/* ================= DEFAULT CONFIG ================= */

// Default system config, agar firebase se data na aaye
const DEFAULT_CONFIG: AppConfig = {
  isInvestmentEnabled: true,
  investmentOrderPercent: 5,
  isWithdrawalEnabled: true,
  isGalleryEnabled: true,
  announcement: { isActive: false, imageUrl: null },
  maintenance: { isActive: false, imageUrl: null, liveTime: null },
  deductions: {
    workDeductionPercent: 15,
    downlineSupportPercent: 100,
    magicFundPercent: 5
  },
  incomeEligibility: { isActive: false, minMonthlyWorkAmount: 3000 },
  levelRequirements: [],
  levelDistributionRates: [],
  companyDetails: {
    qrUrl: null,
    upiId: "9571167318@paytm",
    bankName: "LORD'S BESPOKE",
    accountNumber: "1234567890",
    ifscCode: "IFSC0000123",
    accountName: "LORD'S BESPOKE TAILORS"
  }
};

/* ================= CONTEXT ================= */

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};

/* ================= PROVIDER ================= */

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<string>("SHIRT_MAKER"); // CHANGED: UserRole.SHIRT_MAKER se "SHIRT_MAKER"
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);

  const isDemoMode = !db || !!initError; // agar firebase setup fail hua to demo

  /* ================= FIREBASE LISTENERS ================= */

  useEffect(() => {
    if (isDemoMode) {
      setSystemUsers(MOCK_SYSTEM_USERS);
      setOrders(MOCK_ORDERS);
      return;
    }

    // Listen real-time system users
    const unsubUsers = onSnapshot(collection(db!, "system_users"), snap => {
      setSystemUsers(
        snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemUser))
      );
    });

    // Listen real-time orders
    const unsubOrders = onSnapshot(collection(db!, "orders"), snap => {
      setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)));
    });

    // Listen real-time transactions
    const unsubTx = onSnapshot(
      query(collection(db!, "transactions"), orderBy("date", "desc")),
      snap => {
        setTransactions(
          snap.docs.map(d => ({ ...d.data(), id: d.id } as WalletTransaction))
        );
      }
    );

    // Listen real-time fund/withdraw requests
    const unsubReq = onSnapshot(
      query(collection(db!, "requests"), orderBy("date", "desc")),
      snap => {
        setRequests(
          snap.docs.map(d => ({ ...d.data(), id: d.id } as TransactionRequest))
        );
      }
    );

    // Cleanup listeners
    return () => {
      unsubUsers();
      unsubOrders();
      unsubTx();
      unsubReq();
    };
  }, [isDemoMode]);

  /* ================= LOGIN PERSIST ================= */

  useEffect(() => {
    // Agar refresh hua to previous logged in user info set kar do
    const savedId = localStorage.getItem("currentUserId");
    if (savedId && systemUsers.length > 0) {
      const user = systemUsers.find(u => u.id === savedId);
      if (user) {
        setCurrentUser(user);
        setRole(user.role);
      }
    }
  }, [systemUsers]);

  /* ================= AUTH FUNCTIONS ================= */

  const authenticateUser = useCallback(
    (mobile: string, password: string) =>
      systemUsers.find(
        u => u.mobile === mobile && u.loginPassword === password
      ) || null,
    [systemUsers]
  );

  const loginUser = useCallback(
    (r: string, id?: string) => { // CHANGED: UserRole se string
      const user = id
        ? systemUsers.find(u => u.id === id)
        : systemUsers.find(u => u.role === r);

      if (user) {
        setCurrentUser(user);
        setRole(user.role);
        localStorage.setItem("currentUserId", user.id); // persist login
      }
    },
    [systemUsers]
  );

  /* ================= WALLET CALCULATION ================= */

  const liveStats: Stats = useMemo(() => {
    if (!currentUser) {
      return {
        totalOrders: 0,
        revenue: 0,
        activeWorkers: 0,
        pendingDeliveries: 0,
        bookingWallet: 0,
        uplineWallet: 0,
        downlineWallet: 0,
        magicIncome: 0,
        todaysWallet: 0,
        performanceWallet: 0,
        totalIncome: 0
      };
    }

    // Current user ke transactions
    const myTx = transactions.filter(
      t => t.userId === currentUser.id
    );

    const bookingWallet = myTx.reduce((total, t) => {
      const value = t.type === "Credit" ? t.amount : -t.amount;
      return t.walletType === "Booking" ? total + value : total;
    }, 0);

    return {
      totalOrders: orders.length,
      revenue: bookingWallet,
      activeWorkers: systemUsers.length,
      pendingDeliveries: 0,
      bookingWallet,
      uplineWallet: 0,
      downlineWallet: 0,
      magicIncome: 0,
      todaysWallet: 0,
      performanceWallet: 0,
      totalIncome: bookingWallet
    };
  }, [transactions, currentUser, orders, systemUsers]);

  /* ================= REQUEST FUNCTIONS ================= */

  const requestAddFunds = async (amount: number, utr: string) => {
    if (!db || !currentUser) return;

    // User ke liye ADD_FUNDS request create
    await addDoc(collection(db, "requests"), {
      userId: currentUser.id,
      amount: Number(amount),
      utr,
      type: "ADD_FUNDS",
      status: "PENDING",
      date: serverTimestamp()
    });
  };

  const requestWithdrawal = async (
    amount: number,
    method: string,
    paymentDetails: string
  ) => {
    if (!db || !currentUser) return;

    // User ke liye WITHDRAW request create
    await addDoc(collection(db, "requests"), {
      userId: currentUser.id,
      amount: Number(amount),
      method,
      paymentDetails,
      type: "WITHDRAW",
      status: "PENDING",
      date: serverTimestamp()
    });
  };

  const approveRequest = async (
    requestId: string,
    approved: boolean
  ): Promise<boolean> => {
    if (!db) return false;

    const req = requests.find(r => r.id === requestId);
    if (!req || req.status !== "PENDING") return false;

    try {
      // Update request status
      await setDoc(
        doc(db, "requests", requestId),
        { status: approved ? "APPROVED" : "REJECTED" },
        { merge: true }
      );

      // Agar approved hai to transaction bhi add kar do
      if (approved) {
        await addDoc(collection(db, "transactions"), {
          userId: req.userId,
          amount: Number(req.amount),
          type: req.type === "WITHDRAW" ? "Debit" : "Credit",
          walletType: "Booking",
          description:
            req.type === "WITHDRAW"
              ? "Withdrawal Approved"
              : "Fund Added (Admin Approved)",
          date: serverTimestamp()
        });
      }

      return true;
    } catch (error) {
      console.error("Approve Error:", error);
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        currentUser,
        stats: liveStats,
        systemUsers,
        orders,
        transactions,
        requests,
        isDemoMode,
        loginUser,
        authenticateUser,
        requestAddFunds,
        requestWithdrawal,
        approveRequest
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
