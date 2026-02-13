import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, UserPlus, ArrowRight, CheckCircle2,
  Loader2, LogIn, Store, Truck,
  Shirt, Scissors, Briefcase, PenTool, Package
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';

/* =========================
   JOIN FORM COMPONENT
========================= */

const JoinForm = ({ referralId }: { referralId: string }) => {
  const { autoRegister, loginUser } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SHIRT_MAKER);
  const [generatedCreds, setGeneratedCreds] = useState<{ id: string; password: string } | null>(null);

  const handleSubmit = () => {
    if (!name || !mobile) return alert("Fill Name and Mobile.");
    const creds = autoRegister(name, mobile, role, referralId);
    setGeneratedCreds(creds);
  };

  const handleAutoLogin = () => {
    if (generatedCreds) {
      loginUser(role, generatedCreds.id);
      navigate('/dashboard');
    }
  };

  if (generatedCreds) {
    return (
      <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl p-8 text-center">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl text-white mb-6">Registration Done!</h3>

        <div className="bg-black p-5 rounded-xl border border-zinc-800 mb-6 text-left space-y-3">
          <div>
            <p className="text-xs text-zinc-500">Mobile ID</p>
            <p className="text-white font-mono">{mobile}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Password</p>
            <p className="text-amber-500 font-mono">{generatedCreds.password}</p>
          </div>
        </div>

        <button
          onClick={handleAutoLogin}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl"
        >
          Login Now
        </button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
      <h2 className="text-lg text-white mb-6 flex items-center gap-2">
        <UserPlus className="text-amber-500" /> Registration
      </h2>

      <div className="mb-5 text-sm text-zinc-400">
        Sponsor Code: <span className="text-white font-mono">{referralId}</span>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white"
          placeholder="Full Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="tel"
          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white"
          placeholder="Mobile"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
        />
        <select
          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white"
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
        >
          {Object.values(UserRole)
            .filter(r => r !== UserRole.ADMIN && r !== UserRole.MANAGER)
            .map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
        </select>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full mt-6 bg-amber-600 hover:bg-amber-500 text-black py-3 rounded-xl"
      >
        Register
      </button>
    </div>
  );
};

/* =========================
   MAIN LOGIN PAGE
========================= */

const LoginPage = () => {
  const { loginUser, authenticateUser } = useApp();
  const navigate = useNavigate();

  const [referralId, setReferralId] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /* ===== REFERRAL FIX ===== */
  useEffect(() => {
    let ref: string | null = null;

    if (window.location.hash.includes('?')) {
      const queryString = window.location.hash.split('?')[1];
      const params = new URLSearchParams(queryString);
      ref = params.get('ref');
    }

    if (!ref && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      ref = params.get('ref');
    }

    if (ref) {
      const upperRef = ref.toUpperCase();
      setReferralId(upperRef);
      localStorage.setItem('referral', upperRef);
    }
  }, []);

  const handleLogin = () => {
    if (!mobile || !password) return;
    setError('');
    setIsLoading(true);

    const user = authenticateUser(mobile, password);

    if (user) {
      loginUser(user.role, user.id);
      const path =
        user.role === UserRole.CUSTOMER
          ? '/track'
          : user.role === UserRole.SHOWROOM
          ? '/showroom'
          : '/dashboard';

      navigate(path);
    } else {
      setError('Wrong ID or Password');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {referralId ? (
          <JoinForm referralId={referralId} />
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-white mb-6 flex items-center gap-2">
              <LogIn className="text-amber-500" /> Login
            </h2>

            <div className="space-y-4">
              <input
                type="tel"
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white"
                placeholder="Mobile"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
              />
              <input
                type="password"
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm mt-3">{error}</div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full mt-6 bg-amber-600 hover:bg-amber-500 text-black py-3 rounded-xl"
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Login'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
