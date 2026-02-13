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
  Customer,
  Material,
  Order,
  Stats,
  MeasurementData,
  InvestmentState,
  AppConfig,
  GalleryItem,
  SystemUser,
  Rate,
  StitchingRate,
  WalletTransaction,
  TransactionRequest,
  SystemLog
} from "../types";

import { UserRole, OrderStage } from "../types";

import {
  MOCK_CUSTOMERS,
  MOCK_MATERIALS,
  MOCK_ORDERS,
  MOCK_GALLERY,
  MOCK_SYSTEM_USERS
} from "../services/mockData";

import { db, initError } from "../services/firebase";

import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  addDoc
} from "firebase/firestore";

/* ================= CONTEXT TYPE ================= */

interface AppContextType {
  role: UserRole;
  currentUser: SystemUser | null;
  stats: Stats;
  config: AppConfig;
  systemUsers: SystemUser[];
  orders: Order[];
  transactions: WalletTransaction[];
  requests: TransactionRequest[];
  isDemoMode: boolean;

  loginUser: (role: UserRole, specificUserId?: string) => void;
  authenticateUser: (mobile: string, password: string) => SystemUser | null;

  getDashboardStats: () => Stats;
  getWalletHistory: (walletType: string) => WalletTransaction[];

  requestAddFunds: (amount: number, utr: string) => Promise<void>;
  requestWithdrawal: (
    amount: number,
    method: string,
    paymentDetails: string
  ) => Promise<void>;

  approveRequest: (id: string, approved: boolean) => Promise<boolean>;
}

/* ================= DEFAULT CONFIG ================= */

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
  levelRequirements: Array(10)
    .fill(null)
    .map((_, i) => ({ level: i + 1, requiredDirects: i + 1, isOpen: true })),
  levelDistributionRates: [25, 15, 10, 10, 10, 10, 5, 5, 5, 5],
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
  const [role, setRole] = useState<UserRole>(UserRole.SHIRT_MAKER);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  const isDemoMode = !db || !!initError;

  /* ================= FIREBASE LISTENERS ================= */

  useEffect(() => {
    if (isDemoMode) {
      setSystemUsers(MOCK_SYSTEM_USERS);
      setOrders(MOCK_ORDERS);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db!, "system_users"),
      snap =>
        setSystemUsers(
          snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemUser))
        )
    );

    const unsubOrders = onSnapshot(
      collection(db!, "orders"),
      snap =>
        setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)))
    );

    const unsubTx = onSnapshot(
      query(collection(db!, "transactions"), orderBy("date", "desc")),
      snap =>
        setTransactions(
          snap.docs.map(d => ({ ...d.data(), id: d.id } as WalletTransaction))
        )
    );

    const unsubReq = onSnapshot(
      query(collection(db!, "requests"), orderBy("date", "desc")),
      snap =>
        setRequests(
          snap.docs.map(d => ({ ...d.data(), id: d.id } as TransactionRequest))
        )
    );

    return () => {
      unsubUsers();
      unsubOrders();
      unsubTx();
      unsubReq();
    };
  }, [isDemoMode]);

  /* ================= AUTH ================= */

  const authenticateUser = useCallback(
    (mobile: string, password: string) =>
      systemUsers.find(
        u => u.mobile === mobile && u.loginPassword === password
      ) || null,
    [systemUsers]
  );

  const loginUser = useCallback(
    (r: UserRole, id?: string) => {
      const user = id
        ? systemUsers.find(u => u.id === id)
        : systemUsers.find(u => u.role === r);
      if (user) {
        setCurrentUser(user);
        setRole(user.role);
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
        uplineWallet: 0,
        downlineWallet: 0,
        todaysWallet: 0,
        performanceWallet: 0,
        bookingWallet: 0,
        magicIncome: 0,
        totalIncome: 0
      };
    }

    const myTx = transactions.filter(t => t.userId === currentUser.id);

    let booking = 0;

    myTx.forEach(t => {
      const value = t.type === "Credit" ? t.amount : -t.amount;
      if (t.walletType === "Booking") booking += value;
    });

    return {
      totalOrders: orders.length,
      revenue: booking,
      activeWorkers: systemUsers.length,
      pendingDeliveries: 0,
      bookingWallet: booking,
      uplineWallet: 0,
      downlineWallet: 0,
      magicIncome: 0,
      todaysWallet: 0,
      performanceWallet: 0,
      totalIncome: booking
    };
  }, [transactions, currentUser, orders, systemUsers]);

  /* ================= REQUEST FUNCTIONS ================= */

  const requestAddFunds = async (amount: number, utr: string) => {
    if (!db || !currentUser) return;

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
      await setDoc(
        doc(db, "requests", requestId),
        { status: approved ? "APPROVED" : "REJECTED" },
        { merge: true }
      );

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
      console.error(error);
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        currentUser,
        stats: liveStats,
        config,
        systemUsers,
        orders,
        transactions,
        requests,
        isDemoMode,
        loginUser,
        authenticateUser,
        getDashboardStats: () => liveStats,
        getWalletHistory: wallet =>
          transactions.filter(
            tx =>
              currentUser &&
              tx.userId === currentUser.id &&
              tx.walletType === wallet
          ),
        requestAddFunds,
        requestWithdrawal,
        approveRequest
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
