import React, { useState, useMemo } from "react";
import {
  Wallet, QrCode, ArrowRightLeft, Download, Upload,
  CreditCard, Landmark, Smartphone, History,
  CheckCircle2, Info
} from "lucide-react";
import { useApp } from "../context/AppContext";

const WalletsPage = () => {

  const {
    stats,
    requestAddFunds,
    requestWithdrawal,
    currentUser,
    config,
    requests,
    transferFunds
  } = useApp();

  /* ---------------- SAFE FALLBACKS ---------------- */

  const safeStats = stats || {
    bookingWallet: 0,
    todaysWallet: 0,
    uplineWallet: 0
  };

  const safeConfig = config || {};
  const company = safeConfig.companyDetails || {};

  /* ---------------- STATES ---------------- */

  const [activeTab, setActiveTab] = useState<"ADD" | "WITHDRAW" | "ID_TRANSFER">("ADD");
  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [targetId, setTargetId] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"BANK" | "UPI">("UPI");
  const [loading, setLoading] = useState(false);

  const [notification, setNotification] = useState({
    show: false,
    msg: "",
    type: "success"
  });

  /* ---------------- HELPERS ---------------- */

  const showNotification = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification(p => ({ ...p, show: false })), 3000);
  };

  const parseAmount = () => {
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      showNotification("Enter valid amount", "error");
      return null;
    }
    return amt;
  };

  /* ---------------- ACTIONS ---------------- */

  const handleAddMoney = async () => {
    const amt = parseAmount();
    if (!amt || !utr.trim()) return showNotification("Fill all fields", "error");

    setLoading(true);
    try {
      await requestAddFunds(amt, utr.trim());
      showNotification("Request sent to admin");
      setAmount("");
      setUtr("");
    } catch {
      showNotification("Failed to submit", "error");
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    const amt = parseAmount();
    if (!amt) return;
    if (amt < 500) return showNotification("Minimum ₹500", "error");
    if (amt > safeStats.bookingWallet) return showNotification("Insufficient balance", "error");

    let details = "";

    if (withdrawMethod === "UPI") {
      if (!currentUser?.upiId) return showNotification("Add UPI in profile", "error");
      details = `UPI: ${currentUser.upiId}`;
    } else {
      if (!currentUser?.bankDetails?.accountNumber)
        return showNotification("Add bank details", "error");

      const b = currentUser.bankDetails;
      details = `Bank:${b.bankName} A/C:${b.accountNumber} IFSC:${b.ifscCode}`;
    }

    setLoading(true);
    try {
      await requestWithdrawal(amt, withdrawMethod, details);
      showNotification("Withdrawal request sent");
      setAmount("");
    } catch {
      showNotification("Failed", "error");
    }
    setLoading(false);
  };

  const handleTransfer = async () => {
    const amt = parseAmount();
    if (!amt || !targetId.trim()) return showNotification("Fill all fields", "error");
    if (targetId === currentUser?.id) return showNotification("Cannot send to yourself", "error");
    if (amt > safeStats.bookingWallet) return showNotification("Insufficient balance", "error");

    setLoading(true);
    try {
      const ok = await transferFunds(targetId.trim(), amt);
      if (ok) {
        showNotification("Transfer success");
        setAmount("");
        setTargetId("");
      } else {
        showNotification("Invalid ID or failed", "error");
      }
    } catch {
      showNotification("Transfer error", "error");
    }
    setLoading(false);
  };

  /* ---------------- REQUEST FILTER ---------------- */

  const myRequests = useMemo(() => {
    if (!requests || !currentUser) return [];
    return requests.filter(r => r.userId === currentUser.id);
  }, [requests, currentUser]);

  /* ---------------- QR ---------------- */

  const qrUrl =
    company.qrUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=${company.upiId || "9571167318@paytm"}&pn=LordsBespoke`;

  /* ================================================= */

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen pb-20">

      {/* notification */}
      {notification.show && (
        <div className={`fixed top-0 left-0 w-full text-center py-3 font-bold z-50
          ${notification.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {notification.msg}
        </div>
      )}

      {/* header */}
      <h1 className="text-3xl text-white mb-6">Wallet Panel</h1>

      {/* balance card */}
      <div className="bg-zinc-900 p-6 rounded-2xl mb-8 border border-zinc-800">
        <p className="text-zinc-500 text-xs mb-1 flex gap-2 items-center">
          <Wallet size={14}/> Booking Balance
        </p>

        <h2 className="text-4xl text-white font-bold">
          ₹{safeStats.bookingWallet.toLocaleString()}
        </h2>

        <div className="flex gap-6 mt-4 text-sm">
          <span>Today ₹{safeStats.todaysWallet}</span>
          <span>Bonus ₹{safeStats.uplineWallet}</span>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab("ADD")} className="btn">Add</button>
        <button onClick={() => setActiveTab("WITHDRAW")} className="btn">Withdraw</button>
        <button onClick={() => setActiveTab("ID_TRANSFER")} className="btn">Transfer</button>
      </div>

      {/* ---------------- ADD ---------------- */}
      {activeTab === "ADD" && (
        <div className="space-y-4">

          <img src={qrUrl} alt="qr" className="w-48"/>

          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input"
          />

          <input
            type="text"
            placeholder="UTR Number"
            value={utr}
            onChange={e => setUtr(e.target.value)}
            className="input"
          />

          <button disabled={loading} onClick={handleAddMoney} className="btn-primary">
            {loading ? "Processing..." : "Submit"}
          </button>
        </div>
      )}

      {/* ---------------- WITHDRAW ---------------- */}
      {activeTab === "WITHDRAW" && (
        <div className="space-y-4">

          <div className="flex gap-3">
            <button onClick={() => setWithdrawMethod("UPI")} className="btn">UPI</button>
            <button onClick={() => setWithdrawMethod("BANK")} className="btn">Bank</button>
          </div>

          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input"
          />

          <button disabled={loading} onClick={handleWithdraw} className="btn-danger">
            {loading ? "Processing..." : "Withdraw"}
          </button>
        </div>
      )}

      {/* ---------------- TRANSFER ---------------- */}
      {activeTab === "ID_TRANSFER" && (
        <div className="space-y-4">

          <input
            type="text"
            placeholder="Receiver ID"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="input"
          />

          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input"
          />

          <button disabled={loading} onClick={handleTransfer} className="btn-primary">
            {loading ? "Processing..." : "Send"}
          </button>
        </div>
      )}

      {/* ---------------- HISTORY ---------------- */}
      <div className="mt-10">
        <h3 className="text-zinc-400 text-sm mb-4 flex gap-2 items-center">
          <History size={16}/> History
        </h3>

        {myRequests.length === 0 ? (
          <p className="text-zinc-600 text-xs">No history</p>
        ) : (
          myRequests.map(r => (
            <div key={r.id} className="border-b border-zinc-800 py-3 flex justify-between text-sm">
              <span>{r.type}</span>
              <span>₹{r.amount}</span>
              <span>{r.status}</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default WalletsPage;
