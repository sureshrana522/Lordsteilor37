import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Customer, Material, Order, OrderStage, UserRole, Stats, MeasurementData, InvestmentState, AppConfig, GalleryItem, SystemUser, Rate, StitchingRate, WalletTransaction, TransactionRequest, SystemLog } from '../types';
import { MOCK_CUSTOMERS, MOCK_MATERIALS, MOCK_ORDERS, MOCK_GALLERY, MOCK_SYSTEM_USERS } from '../services/mockData';
import { db, initError } from '../services/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, writeBatch, orderBy, limit, getDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';

interface AppContextType {
  role: UserRole;
  currentUser: SystemUser | null;
  setRole: (role: UserRole) => void;
  loginUser: (role: UserRole, specificUserId?: string) => void;
  authenticateUser: (mobile: string, password: string) => SystemUser | null;
  registerUser: (newUser: SystemUser) => void;
  autoRegister: (name: string, mobile: string, role: UserRole, uplineId: string) => { id: string, password: string };
  orders: Order[];
  customers: Customer[];
  materials: Material[];
  galleryItems: GalleryItem[];
  systemUsers: SystemUser[];
  logs: SystemLog[];
  stats: Stats;
  investment: InvestmentState;
  config: AppConfig;
  rates: Rate[];
  stitchingRates: StitchingRate[];
  transactions: WalletTransaction[];
  requests: TransactionRequest[];
  updateOrderStage: (orderId: string, newStage: OrderStage) => void;
  addCustomer: (customer: Customer, orderType: Order['type'], price: number, assignedWorker?: string, quality?: 'Normal' | 'Medium' | 'Regular' | 'VIP', creatorId?: string) => Promise<boolean>;
  addOrder: (order: Order) => void; 
  addMaterial: (material: Material) => void; 
  moveOrder: (orderId: string, folder: 'Self' | 'Save' | 'Inbox' | 'Return' | 'Completed', assignedWorker?: string, nextStage?: OrderStage, codAmount?: number) => void;
  confirmHandover: (orderId: string) => Promise<boolean>;
  saveMeasurements: (orderId: string, data: MeasurementData, updatedPrice: number) => Promise<void>;
  deleteOrder: (orderId: string) => void;
  investFunds: (amount: number, planName: string) => Promise<boolean>;
  withdrawReturns: (amount: number) => Promise<boolean>;
  transferFunds: (recipientId: string, amount: number) => Promise<boolean>;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateRates: (newRates: Rate[]) => void;
  updateStitchingRates: (newRates: StitchingRate[]) => void;
  addGalleryItem: (item: Omit<GalleryItem, 'id' | 'code'>) => void;
  deleteGalleryItem: (id: string) => void;
  updateSystemUser: (id: string, updates: Partial<SystemUser>) => void;
  resetSystemIDs: () => void;
  resetDatabase: () => Promise<void>;
  addFrequentWorker: (workerId: string) => void;
  getDashboardStats: () => Stats;
  getWalletHistory: (walletType: string) => WalletTransaction[];
  requestAddFunds: (amount: number, utr: string) => void;
  requestWithdrawal: (amount: number, method: string, paymentDetails: string) => void;
  requestJoin: (name: string, mobile: string, role: UserRole, uplineId: string) => void; 
  approveRequest: (reqId: string, approved: boolean) => Promise<boolean>;
  releaseFundsManually: (userId: string, amount: number, walletType: string, description: string) => Promise<boolean>;
  addLog: (action: string, details: string, type: SystemLog['type']) => Promise<void>;
  seedDatabase: () => Promise<{ success: boolean; message: string }>; 
  isDemoMode: boolean; 
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const toFixedNumber = (num: number) => {
    if (typeof num !== 'number') return 0;
    return Math.round((num + Number.EPSILON) * 100000) / 100000;
};

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
        magicFundPercent: 5,
    },
    incomeEligibility: { isActive: false, minMonthlyWorkAmount: 3000 },
    levelRequirements: Array(10).fill(null).map((_,i) => ({ level: i+1, requiredDirects: i+1, isOpen: true })),
    levelDistributionRates: [25, 15, 10, 10, 10, 10, 5, 5, 5, 5], 
    companyDetails: {
        qrUrl: null,
        upiId: '9571167318@paytm',
        bankName: 'LORD\'S BESPOKE',
        accountNumber: '1234567890',
        ifscCode: 'IFSC0000123',
        accountName: 'LORD\'S BESPOKE TAILORS'
    }
};

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [role, setRole] = useState<UserRole>(UserRole.SHIRT_MAKER);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [stitchingRates, setStitchingRates] = useState<StitchingRate[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, revenue: 0, activeWorkers: 0, pendingDeliveries: 0, uplineWallet: 0, downlineWallet: 0, todaysWallet: 0, performanceWallet: 0, bookingWallet: 0, magicIncome: 0, totalIncome: 0 });
  const [investment, setInvestment] = useState<InvestmentState>({ invested: 0, totalEarnings: 0, totalWithdrawn: 0, activePlans: [] });
  
  const isDemoMode = !db || !!initError;

  useEffect(() => {
      if (isDemoMode) {
          setSystemUsers(MOCK_SYSTEM_USERS); setOrders(MOCK_ORDERS); setCustomers(MOCK_CUSTOMERS); setMaterials(MOCK_MATERIALS); setGalleryItems(MOCK_GALLERY); return;
      }
      const unsubUsers = onSnapshot(collection(db!, 'system_users'), (snap) => setSystemUsers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SystemUser))));
      const unsubOrders = onSnapshot(collection(db!, 'orders'), (snap) => setOrders(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order))));
      const unsubCustomers = onSnapshot(collection(db!, 'customers'), (snap) => setCustomers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer))));
      const unsubLogs = onSnapshot(query(collection(db!, 'system_logs'), orderBy('timestamp', 'desc'), limit(100)), (snap) => setLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SystemLog))));
      const unsubTx = onSnapshot(query(collection(db!, 'transactions'), orderBy('date', 'desc'), limit(1000)), (snap) => setTransactions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as WalletTransaction))));
      const unsubReq = onSnapshot(query(collection(db!, 'requests'), orderBy('date', 'desc'), limit(50)), (snap) => setRequests(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as TransactionRequest))));
      const unsubConfig = onSnapshot(doc(db!, 'app_config', 'settings'), (snap) => { if (snap.exists()) setConfig(snap.data() as AppConfig); });
      const unsubRates = onSnapshot(collection(db!, 'rates'), (snap) => setRates(snap.docs.map(doc => doc.data() as Rate).sort((a,b) => a.id - b.id)));
      const unsubStitch = onSnapshot(collection(db!, 'stitching_rates'), (snap) => setStitchingRates(snap.docs.map(doc => doc.data() as StitchingRate)));
      const unsubGallery = onSnapshot(collection(db!, 'gallery_items'), (snap) => setGalleryItems(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as GalleryItem))));
      return () => { unsubUsers(); unsubOrders(); unsubCustomers(); unsubLogs(); unsubTx(); unsubReq(); unsubConfig(); unsubRates(); unsubStitch(); unsubGallery(); };
  }, [isDemoMode]);

  const addLog = useCallback(async (action: string, details: string, type: SystemLog['type']) => {
      const newLog: SystemLog = { id: `LOG-${Date.now()}`, timestamp: new Date().toISOString(), userId: currentUser?.id || 'GUEST', userName: currentUser?.name || 'Guest User', action, details, type };
      if (isDemoMode) setLogs(prev => [newLog, ...prev]);
      else try { await setDoc(doc(db!, 'system_logs', newLog.id), { ...newLog, serverTime: serverTimestamp() }); } catch (e) {}
  }, [currentUser, isDemoMode]);

  const addTransaction = useCallback(async (userId: string, amount: number, type: 'Credit' | 'Debit', walletType: string, description: string, relatedOrderId?: string, relatedUser?: string, level?: string) => {
      if (amount <= 0) return false;
      const newTx: WalletTransaction = { id: `TX-${Date.now()}`, userId, date: new Date().toISOString(), amount: toFixedNumber(amount), type, walletType: walletType as any, description, relatedOrderId, relatedUser, level };
      if (isDemoMode) { setTransactions(prev => [newTx, ...prev]); return true; }
      else try { await setDoc(doc(db!, 'transactions', newTx.id), { ...newTx, serverTime: serverTimestamp() }); return true; } catch (e) { return false; }
  }, [isDemoMode]);

  const liveStats = useMemo(() => {
    if (!currentUser) return stats;
    const myTx = transactions.filter(t => t.userId === currentUser.id);
    const walletSums = myTx.reduce((acc, curr) => {
      const val = curr.type === 'Credit' ? curr.amount : -curr.amount;
      if (curr.walletType === 'Booking') acc.booking += val;
      else if (curr.walletType === 'Upline') acc.upline += val;
      else if (curr.walletType === 'Downline') acc.downline += val;
      else if (curr.walletType === 'Magic') acc.magic += val;
      else if (curr.walletType === 'Daily') acc.daily += val;
      return acc;
    }, { booking: 0, upline: 0, downline: 0, magic: 0, daily: 0 });

    return { 
        ...stats, 
        bookingWallet: toFixedNumber(walletSums.booking), 
        uplineWallet: toFixedNumber(walletSums.upline), 
        downlineWallet: toFixedNumber(walletSums.downline), 
        magicIncome: toFixedNumber(walletSums.magic), 
        todaysWallet: toFixedNumber(walletSums.daily), 
        totalIncome: toFixedNumber(walletSums.booking + walletSums.upline + walletSums.downline + walletSums.magic + walletSums.daily) 
    };
  }, [stats, transactions, currentUser]);

  const distributeNetworkRewards = useCallback(async (targetUserId: string, basePayout: number, order: Order) => {
      const totalDedPool = (basePayout * 15) / 100;
      const workerNet = basePayout - totalDedPool;
      await addTransaction(targetUserId, workerNet, 'Credit', 'Daily', `Released Work Payout: ${order.billNumber}`, order.id);
      const magicPercent = config.deductions.magicFundPercent || 0;
      let magicShare = 0;
      if (magicPercent > 0) {
          magicShare = (totalDedPool * magicPercent) / 100;
          const targetUser = systemUsers.find(u => u.id === targetUserId);
          if (targetUser?.magicUplineId) {
             await addTransaction(targetUser.magicUplineId, magicShare, 'Credit', 'Magic', `Magic Matrix Share from ${targetUserId} for ${order.billNumber}`, order.id, targetUserId);
          }
      }
      const levelPool = totalDedPool - magicShare;
      let currUplineId = systemUsers.find(u => u.id === targetUserId)?.uplineId;
      for (let i = 0; i < 10; i++) {
          if (!currUplineId) break;
          const upline = systemUsers.find(u => u.id === currUplineId);
          if (!upline) break;
          const levelRate = config.levelDistributionRates[i] || 0;
          const share = (levelPool * levelRate) / 100;
          if (share > 0) {
              const walletTarget = (i === 0) ? 'Upline' : 'Downline';
              await addTransaction(upline.id, share, 'Credit', walletTarget, `${walletTarget} Income (L${i+1}): ${order.billNumber} from ${targetUserId}`, order.id, targetUserId, `L${i+1}`);
          }
          currUplineId = upline.uplineId;
      }
  }, [config, systemUsers, addTransaction]);

  const confirmHandover = useCallback(async (orderId: string) => {
      const order = orders.find(o => o.id === orderId);
      if (!order || !currentUser) return false;
      const updates: any = { handoverStatus: 'Accepted', folder: 'Save', lastUpdated: new Date().toISOString() };
      if (order.previousWorkerId) {
          const prevWorker = systemUsers.find(u => u.id === order.previousWorkerId);
          if (prevWorker && prevWorker.role !== UserRole.ADMIN) {
              const rateObj = stitchingRates.find(r => r.type.toLowerCase().includes(order.type.toLowerCase()) || r.type.toLowerCase().includes(prevWorker.role.toLowerCase()));
              let basePayout = 0;
              const q = order.quality?.toLowerCase() || 'regular';
              if (rateObj) {
                  let rawRate = 0;
                  if (q === 'normal') rawRate = rateObj.normal;
                  else if (q === 'medium') rawRate = rateObj.medium;
                  else if (q === 'regular') rawRate = rateObj.regular;
                  else if (q === 'vip') rawRate = rateObj.vip;
                  if (rateObj.rateType === 'Percentage') basePayout = (order.price * rawRate) / 100;
                  else basePayout = rawRate;
              } else basePayout = (order.price * 0.1); 
              await distributeNetworkRewards(prevWorker.id, basePayout, order);
          }
      }
      if (!order.isPaid && currentUser.role === UserRole.CUTTING) {
          const creatorId = order.creatorId || 'LBT-ADMIN';
          await addTransaction(creatorId, order.price, 'Debit', 'Booking', `Booking Deducted: ${order.billNumber}`, order.id);
          updates.isPaid = true;
      }
      if (isDemoMode) setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
      else await updateDoc(doc(db!, 'orders', orderId), updates);
      return true;
  }, [orders, currentUser, stitchingRates, distributeNetworkRewards, isDemoMode, transactions, addTransaction, systemUsers]);

  const moveOrder = useCallback(async (orderId: string, folder: any, nextWorkerId?: string, nextStage?: OrderStage, codAmount?: number) => {
    const isSending = folder === 'Inbox';
    // FIX: Force folder to 'Completed' when order reaches Delivered stage
    const finalFolder = nextStage === OrderStage.DELIVERED ? 'Completed' : folder;
    
    const updates: any = { 
        folder: finalFolder, 
        assignedWorker: nextWorkerId || currentUser?.id, 
        lastUpdated: new Date().toISOString(), 
        stage: nextStage || OrderStage.ORDER_PLACED, 
        handoverStatus: isSending ? 'Pending' : 'Accepted', 
        previousWorker: currentUser?.name || 'System', 
        previousWorkerId: currentUser?.id 
    };
    
    if (nextWorkerId) { 
        const order = orders.find(o => o.id === orderId); 
        updates.workerHistory = [...(order?.workerHistory || []), nextWorkerId]; 
    }
    
    if (codAmount && codAmount > 0 && nextStage === OrderStage.DELIVERED) {
        const order = orders.find(o => o.id === orderId);
        await addTransaction(order?.creatorId || 'LBT-ADMIN', codAmount, 'Credit', 'Booking', `COD Collection: ${order?.billNumber}`, orderId);
    }

    if (isDemoMode) setOrders(prev => prev.map(o => o.id === orderId ? {...o, ...updates} : o)); 
    else await updateDoc(doc(db!, 'orders', orderId), updates);
  }, [isDemoMode, orders, currentUser, addTransaction]);

  const saveMeasurements = useCallback(async (orderId: string, data: MeasurementData, updatedPrice: number) => {
    const updateData = { measurements: data, price: updatedPrice, lastUpdated: new Date().toISOString() };
    if (isDemoMode) setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updateData } : o));
    else await updateDoc(doc(db!, 'orders', orderId), updateData);
  }, [isDemoMode]);

  const addCustomer = useCallback(async (customer: Customer, orderType: string, price: number, assignedWorker?: string, quality?: any, creatorId?: string) => {
    const newOrder: Order = { id: `o${Date.now()}`, customerId: customer.id, customerName: customer.name, billNumber: customer.billNumber, type: orderType, stage: OrderStage.ORDER_PLACED, createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), price, quality: quality || 'Regular', createdBy: assignedWorker || 'Admin', creatorId: creatorId || 'LBT-ADMIN', folder: 'Self', assignedWorker: creatorId || 'LBT-ADMIN', handoverStatus: 'Accepted', securityCode: Math.floor(1000 + Math.random() * 9000).toString(), workerHistory: [creatorId || 'LBT-ADMIN'], isPaid: false };
    if (isDemoMode) { setCustomers(prev => [...prev, customer]); setOrders(prev => [...prev, newOrder]); } 
    else { await setDoc(doc(db!, 'customers', customer.id), customer); await setDoc(doc(db!, 'orders', newOrder.id), newOrder); }
    return true;
  }, [isDemoMode]);

  const authenticateUser = useCallback((mobile: string, password: string) => systemUsers.find(u => u.mobile === mobile && u.loginPassword === password) || null, [systemUsers]);
  const loginUser = useCallback((selectedRole: UserRole, specificUserId?: string) => {
     let user = specificUserId ? systemUsers.find(u => u.id === specificUserId) : systemUsers.find(u => u.role === selectedRole);
     if (user) { setCurrentUser(user); setRole(user.role); }
  }, [systemUsers]);

  const autoRegister = useCallback((name: string, mobile: string, role: UserRole, uplineId: string) => {
      const id = `LBT-${Math.floor(1000 + Math.random() * 9000)}`;
      const password = Math.floor(100000 + Math.random() * 900000).toString();
      const newUser: SystemUser = { id, name, role, mobile, status: 'Active', joinDate: new Date().toISOString().split('T')[0], uplineId, magicUplineId: uplineId, loginPassword: password, canWithdraw: true };
      if (isDemoMode) setSystemUsers(prev => [...prev, newUser]); 
      else setDoc(doc(db!, 'system_users', newUser.id), newUser);
      return { id, password };
  }, [isDemoMode]);

  const updateConfig = useCallback(async (updates: Partial<AppConfig>) => { if (isDemoMode) setConfig(prev => ({...prev, ...updates})); else await setDoc(doc(db!, 'app_config', 'settings'), { ...config, ...updates }); }, [config, isDemoMode]);
  const updateStitchingRates = useCallback(async (newRates: StitchingRate[]) => { if (isDemoMode) setStitchingRates(newRates); else { const batch = writeBatch(db!); newRates.forEach(r => batch.set(doc(db!, 'stitching_rates', r.id), r)); await batch.commit(); } }, [isDemoMode]);
  const updateOrderStage = useCallback((orderId: string, newStage: OrderStage) => { if (isDemoMode) setOrders(prev => prev.map(o => o.id === orderId ? {...o, stage: newStage} : o)); else updateDoc(doc(db!, 'orders', orderId), { stage: newStage, lastUpdated: new Date().toISOString() }); }, [isDemoMode]);
  const requestAddFunds = useCallback(async (amount: number, utr: string) => {
    const newReq: TransactionRequest = { id: `REQ-${Date.now()}`, userId: currentUser?.id || '', userName: currentUser?.name || '', type: 'ADD_FUNDS', amount, status: 'PENDING', date: new Date().toISOString(), utr };
    if (isDemoMode) setRequests(prev => [newReq, ...prev]); else await setDoc(doc(db!, 'requests', newReq.id), newReq);
  }, [currentUser, isDemoMode]);
  const requestWithdrawal = useCallback(async (amount: number, method: string, paymentDetails: string) => {
    const newReq: TransactionRequest = { id: `REQ-${Date.now()}`, userId: currentUser?.id || '', userName: currentUser?.name || '', type: 'WITHDRAW', amount, status: 'PENDING', date: new Date().toISOString(), method, paymentDetails };
    if (isDemoMode) setRequests(prev => [newReq, ...prev]); else await setDoc(doc(db!, 'requests', newReq.id), newReq);
  }, [currentUser, isDemoMode]);

  const ap
