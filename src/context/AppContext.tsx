import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback
} from "react";

import {
  Customer,
  Material,
  Order,
  OrderStage,
  UserRole,
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
  updateDoc,
  query,
  writeBatch,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";

/* =========================
   CONTEXT TYPE
========================= */

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

  requestAddFunds: (amount: number, utr: string) => void;
  requestWithdrawal: (amount: number, method: string, paymentDetails: string) => void;

  releaseFundsManually: (
    userId: string,
    amount: number,
    walletType: string,
    description: string
  ) => Promise<boolean>;
}

/* =========================
   CONTEXT
========================= */

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};

/* =========================
   DEFAULT CONFIG
========================= */

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

/* =========================
   PROVIDER
========================= */

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>(UserRole.SHIRT_MAKER);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  const isDemoMode = !db || !!initError;

  /* =========================
     FIREBASE LISTENERS
  ========================= */

  useEffect(() => {
    if (isDemoMode) {
      setSystemUsers(MOCK_SYSTEM_USERS);
      setOrders(MOCK_ORDERS);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db!, "system_users"),
      snap => setSystemUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemUser)))
    );

    const unsubOrders = onSnapshot(
      collection(db!, "orders"),
      snap => setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)))
    );

    const unsubTx = onSnapshot(
      query(collection(db!, "transactions"), orderBy("date", "desc"), limit(1000)),
      snap => setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as WalletTransaction)))
    );

    const unsubReq = onSnapshot(
      query(collection(db!, "requests"), orderBy("date", "desc"), limit(100)),
      snap => setRequests(snap.docs.map(d => ({ ...d.data(), id: d.id } as TransactionRequest)))
    );

    const unsubConfig = onSnapshot(
      doc(db!, "app_config", "settings"),
      snap => snap.exists() && setConfig(snap.data() as AppConfig)
    );

    return () => {
      unsubUsers();
      unsubOrders();
      unsubTx();
      unsubReq();
      unsubConfig();
    };
  }, [isDemoMode]);

  /* =========================
     AUTH
  ========================= */

  const authenticateUser = useCallback(
    (mobile: string, password: string) =>
      systemUsers.find(u => u.mobile === mobile && u.loginPassword === password) || null,
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

  /* =========================
     WALLET STATS (🔥 FIX)
  ========================= */

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

    let booking = 0,
      upline = 0,
      downline = 0,
      magic = 0,
      daily = 0;

    myTx.forEach(t => {
      const val = t.type === "Credit" ? t.amount : -t.amount;
      if (t.walletType === "Booking") booking += val;
      if (t.walletType === "Upline") upline += val;
      if (t.walletType === "Downline") downline += val;
      if (t.walletType === "Magic") magic += val;
      if (t.walletType === "Daily") daily += val;
    });

    return {
      totalOrders: orders.length,
      revenue: booking,
      activeWorkers: systemUsers.length,
      pendingDeliveries: orders.filter(o => o.stage !== OrderStage.DELIVERED).length,
      bookingWallet: booking,
      uplineWallet: upline,
      downlineWallet: downline,
      magicIncome: magic,
      todaysWallet: daily,
      performanceWallet: 0,
      totalIncome: booking + upline + downline + magic + daily
    };
  }, [transactions, currentUser, orders, systemUsers]);

  /* =========================
     WALLET HELPERS
  ========================= */

  const getWalletHistory = useCallback(
    (walletType: string) => {
      if (!currentUser) return [];
      return transactions.filter(
        tx => tx.userId === currentUser.id && tx.walletType === walletType
      );
    },
    [transactions, currentUser]
  );

  const releaseFundsManually = useCallback(
    async (userId: string, amount: number, walletType: string, description: string) => {
      if (amount <= 0) return false;

      const tx: WalletTransaction = {
        id: `TX-${Date.now()}`,
        userId,
        date: new Date().toISOString(),
        amount,
        type: "Credit",
        walletType: walletType as any,
        description
      };

      if (isDemoMode) {
        setTransactions(prev => [tx, ...prev]);
        return true;
      }

      await setDoc(doc(db!, "transactions", tx.id), {
        ...tx,
        serverTime: serverTimestamp()
      });

      return true;
    },
    [isDemoMode]
  );

  const requestAddFunds = useCallback(
    async (amount: number, utr: string) => {
      if (!currentUser) return;
      const req: TransactionRequest = {
        id: `REQ-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        type: "ADD_FUNDS",
        amount,
        status: "PENDING",
        date: new Date().toISOString(),
        utr
      };

      if (isDemoMode) setRequests(p => [req, ...p]);
      else await setDoc(doc(db!, "requests", req.id), req);
    },
    [currentUser, isDemoMode]
  );

  const requestWithdrawal = useCallback(
    async (amount: number, method: string, paymentDetails: string) => {
      if (!currentUser) return;
      const req: TransactionRequest = {
        id: `REQ-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        type: "WITHDRAW",
        amount,
        status: "PENDING",
        date: new Date().toISOString(),
        method,
        paymentDetails
      };

      if (isDemoMode) setRequests(p => [req, ...p]);
      else await setDoc(doc(db!, "requests", req.id), req);
    },
    [currentUser, isDemoMode]
  );

  /* =========================
     PROVIDER VALUE
  ========================= */

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
        getWalletHistory,

        requestAddFunds,
        requestWithdrawal,
        releaseFundsManually
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
