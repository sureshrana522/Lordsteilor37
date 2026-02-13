import React,{
createContext,useContext,useState,useEffect,useMemo,useCallback,ReactNode
} from "react";

import type{
Order,Stats,AppConfig,SystemUser,WalletTransaction,TransactionRequest
} from "../types";

import { MOCK_ORDERS, MOCK_SYSTEM_USERS } from "../services/mockData";
import { db, initError } from "../services/firebase";

import{
collection,onSnapshot,doc,setDoc,query,orderBy,serverTimestamp,addDoc
} from "firebase/firestore";

const DEFAULT_CONFIG:AppConfig={
isInvestmentEnabled:true,
investmentOrderPercent:5,
isWithdrawalEnabled:true,
isGalleryEnabled:true,
announcement:{isActive:false,imageUrl:null},
maintenance:{isActive:false,imageUrl:null,liveTime:null},
deductions:{workDeductionPercent:15,downlineSupportPercent:100,magicFundPercent:5},
incomeEligibility:{isActive:false,minMonthlyWorkAmount:3000},
levelRequirements:[],
levelDistributionRates:[],
companyDetails:{
qrUrl:null,
upiId:"9571167318@paytm",
bankName:"LORD'S BESPOKE",
accountNumber:"1234567890",
ifscCode:"IFSC0000123",
accountName:"LORD'S BESPOKE TAILORS"
}
};

interface AppContextType{
role:string;
currentUser:SystemUser|null;
stats:Stats;
systemUsers:SystemUser[];
orders:Order[];
transactions:WalletTransaction[];
requests:TransactionRequest[];
config:AppConfig;
isDemoMode:boolean;

loginUser:(role:string,id?:string)=>void;
authenticateUser:(mobile:string,password:string)=>SystemUser|null;

requestAddFunds:(amount:number,utr:string)=>Promise<void>;
requestWithdrawal:(amount:number,method:string,details:string)=>Promise<void>;
approveRequest:(id:string,approved:boolean)=>Promise<boolean>;
transferFunds:(targetId:string,amount:number)=>Promise<boolean>;
}

const AppContext=createContext<AppContextType|undefined>(undefined);

export const useApp=()=>{
const ctx=useContext(AppContext);
if(!ctx) throw new Error("useApp must be used inside provider");
return ctx;
};

export const AppProvider=({children}:{children:ReactNode})=>{

const[role,setRole]=useState("USER");
const[currentUser,setCurrentUser]=useState<SystemUser|null>(null);
const[systemUsers,setSystemUsers]=useState<SystemUser[]>([]);
const[orders,setOrders]=useState<Order[]>([]);
const[transactions,setTransactions]=useState<WalletTransaction[]>([]);
const[requests,setRequests]=useState<TransactionRequest[]>([]);
const[config]=useState<AppConfig>(DEFAULT_CONFIG);

const isDemoMode=!db||!!initError;

/* FIREBASE LISTEN */

useEffect(()=>{
if(isDemoMode){
setSystemUsers(MOCK_SYSTEM_USERS);
setOrders(MOCK_ORDERS);
return;
}

const unsubUsers=onSnapshot(collection(db!,"system_users"),
s=>setSystemUsers(s.docs.map(d=>({...d.data(),id:d.id} as SystemUser))));

const unsubOrders=onSnapshot(collection(db!,"orders"),
s=>setOrders(s.docs.map(d=>({...d.data(),id:d.id} as Order))));

const unsubTx=onSnapshot(query(collection(db!,"transactions"),orderBy("date","desc")),
s=>setTransactions(s.docs.map(d=>({...d.data(),id:d.id} as WalletTransaction))));

const unsubReq=onSnapshot(query(collection(db!,"requests"),orderBy("date","desc")),
s=>setRequests(s.docs.map(d=>({...d.data(),id:d.id} as TransactionRequest))));

return()=>{unsubUsers();unsubOrders();unsubTx();unsubReq();};

},[isDemoMode]);

/* LOGIN RESTORE */

useEffect(()=>{
const id=localStorage.getItem("currentUserId");
if(id&&systemUsers.length){
const u=systemUsers.find(x=>x.id===id);
if(u){setCurrentUser(u);setRole(u.role);}
}
},[systemUsers]);

/* AUTH */

const authenticateUser=useCallback(
(mobile:string,password:string)=>
systemUsers.find(u=>u.mobile===mobile&&u.loginPassword===password)||null,
[systemUsers]
);

const loginUser=useCallback((r:string,id?:string)=>{
const u=id?systemUsers.find(x=>x.id===id):systemUsers.find(x=>x.role===r);
if(u){
setCurrentUser(u);
setRole(u.role);
localStorage.setItem("currentUserId",u.id);
}
},[systemUsers]);

/* STATS */

const stats:Stats=useMemo(()=>{
if(!currentUser)return{
totalOrders:0,revenue:0,activeWorkers:0,pendingDeliveries:0,
bookingWallet:0,uplineWallet:0,downlineWallet:0,magicIncome:0,
todaysWallet:0,performanceWallet:0,totalIncome:0
};

const myTx=transactions.filter(t=>t.userId===currentUser.id);

const bookingWallet=myTx.reduce((t,x)=>{
const val=x.type==="Credit"?x.amount:-x.amount;
return x.walletType==="Booking"?t+val:t;
},0);

return{
totalOrders:orders.length,
revenue:bookingWallet,
activeWorkers:systemUsers.length,
pendingDeliveries:0,
bookingWallet,
uplineWallet:0,
downlineWallet:0,
magicIncome:0,
todaysWallet:0,
performanceWallet:0,
totalIncome:bookingWallet
};
},[transactions,currentUser,orders,systemUsers]);

/* REQUESTS */

const requestAddFunds=async(amount:number,utr:string)=>{
if(!db||!currentUser)return;
await addDoc(collection(db,"requests"),{
userId:currentUser.id,amount,utr,type:"ADD_FUNDS",
status:"PENDING",date:serverTimestamp()
});
};

const requestWithdrawal=async(amount:number,method:string,details:string)=>{
if(!db||!currentUser)return;
await addDoc(collection(db,"requests"),{
userId:currentUser.id,amount,method,paymentDetails:details,
type:"WITHDRAW",status:"PENDING",date:serverTimestamp()
});
};

const transferFunds=async(targetId:string,amount:number)=>{
if(!db||!currentUser||targetId===currentUser.id)return false;
try{
await addDoc(collection(db,"transactions"),{
userId:currentUser.id,amount,type:"Debit",walletType:"Booking",
description:`Transfer to ${targetId}`,date:serverTimestamp()
});
await addDoc(collection(db,"transactions"),{
userId:targetId,amount,type:"Credit",walletType:"Booking",
description:`Received from ${currentUser.id}`,date:serverTimestamp()
});
return true;
}catch{return false;}
};

const approveRequest=async(id:string,approved:boolean)=>{
if(!db)return false;
const req=requests.find(r=>r.id===id);
if(!req||req.status!=="PENDING")return false;

await setDoc(doc(db,"requests",id),
{status:approved?"APPROVED":"REJECTED"},{merge:true});

if(approved){
await addDoc(collection(db,"transactions"),{
userId:req.userId,amount:req.amount,
type:req.type==="WITHDRAW"?"Debit":"Credit",
walletType:"Booking",description:"Admin Approved",
date:serverTimestamp()
});
}
return true;
};

return(
<AppContext.Provider value={{
role,currentUser,stats,systemUsers,orders,transactions,requests,
config,isDemoMode,
loginUser,authenticateUser,
requestAddFunds,requestWithdrawal,approveRequest,transferFunds
}}>
{children}
</AppContext.Provider>
);
};
