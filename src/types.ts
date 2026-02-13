import { ReactNode } from "react";

/* ================= USER ROLES ================= */

export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  MEASUREMENT = "MEASUREMENT",
  CUTTING = "CUTTING",
  SHIRT_MAKER = "SHIRT_MAKER",
  PANT_MAKER = "PANT_MAKER",
  COAT_MAKER = "COAT_MAKER",
  FINISHING = "FINISHING",
  PRESS = "PRESS",
  DELIVERY = "DELIVERY",
  SHOWROOM = "SHOWROOM",
  CUSTOMER = "CUSTOMER"
}

/* ================= SIDEBAR ================= */

export type SidebarItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  path: string;
};

/* ================= ORDER ================= */

export enum OrderStage {
  PENDING = "Pending",
  MEASUREMENT = "Measurement",
  CUTTING = "Cutting",
  STITCHING = "Stitching",
  FINISHING = "Finishing",
  PRESSING = "Pressing",
  READY = "Ready",
  DELIVERED = "Delivered"
}

export interface Order {
  id: string;
  customerName: string;
  mobile: string;
  item: string;
  amount: number;
  stage: OrderStage;
  createdAt?: any;
}

/* ================= USERS ================= */

export interface SystemUser {
  id: string;
  name: string;
  mobile: string;
  role: string;
  loginPassword: string;
  status?: "Active" | "Blocked";
}

/* ================= STATS ================= */

export interface Stats {
  totalOrders: number;
  revenue: number;
  activeWorkers: number;
  pendingDeliveries: number;
  bookingWallet: number;
  uplineWallet: number;
  downlineWallet: number;
  magicIncome: number;
  todaysWallet: number;
  performanceWallet: number;
  totalIncome: number;
}

/* ================= WALLET ================= */

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "Credit" | "Debit";
  walletType: "Booking" | "Income" | "Bonus";
  description?: string;
  date?: any;
}

export interface TransactionRequest {
  id: string;
  userId: string;
  amount: number;
  type: "ADD_FUNDS" | "WITHDRAW";
  status: "PENDING" | "APPROVED" | "REJECTED";
  utr?: string;
  method?: string;
  paymentDetails?: string;
  date?: any;
}

/* ================= CONFIG ================= */

export interface AppConfig {
  isInvestmentEnabled: boolean;
  investmentOrderPercent: number;
  isWithdrawalEnabled: boolean;
  isGalleryEnabled: boolean;

  announcement: {
    isActive: boolean;
    imageUrl: string | null;
  };

  maintenance: {
    isActive: boolean;
    imageUrl: string | null;
    liveTime: string | null;
  };

  deductions: {
    workDeductionPercent: number;
    downlineSupportPercent: number;
    magicFundPercent: number;
  };

  incomeEligibility: {
    isActive: boolean;
    minMonthlyWorkAmount: number;
  };

  levelRequirements: number[];
  levelDistributionRates: number[];

  companyDetails: {
    qrUrl: string | null;
    upiId: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountName: string;
  };
}
