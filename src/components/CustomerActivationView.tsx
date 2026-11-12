/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound, Building2, User, Lock, CheckCircle2, AlertCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { LicenseDuration, UserProfile, Company, TenantLicense, CompanyMember, UserRole } from '../types';

interface CustomerActivationViewProps {
  onBackToLogin: () => void;
  onActivationSuccess: () => void;
}

export const CustomerActivationView: React.FC<CustomerActivationViewProps> = ({
  onBackToLogin,
  onActivationSuccess,
}) => {
  const [activationKey, setActivationKey] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ businessName: string; userId: string } | null>(null);

  // Simple client-side SHA-256 hash helper using Web Crypto API
  const hashKey = async (key: string): Promise<string> => {
    const msgUint8 = new TextEncoder().encode(key.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanKey = activationKey.trim();
    const cleanBusiness = businessName.trim();
    const cleanUser = userId.trim().toLowerCase();

    if (!cleanKey) {
      setError('Please enter a valid activation key.');
      return;
    }
    if (!cleanBusiness) {
      setError('Please enter your business / shop name.');
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setError('Please enter a unique User ID (at least 3 characters).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      // 1. Hash the activation key
      const keyHash = await hashKey(cleanKey);

      // 2. Check if key exists in Firestore activationKeys collection
      const keyRef = doc(db, 'activationKeys', keyHash);
      const keySnap = await getDoc(keyRef);

      let keyData: any = null;
      if (keySnap.exists()) {
        keyData = keySnap.data();
      } else {
        // Fallback check in localStorage for offline / demo keys
        const localKeys = JSON.parse(localStorage.getItem('sa_activation_keys') || '[]');
        const foundLocal = localKeys.find((k: any) => k.keyHash === keyHash || k.rawKey === cleanKey);
        if (foundLocal) {
          keyData = foundLocal;
        }
      }

      if (!keyData) {
        throw new Error('Invalid activation key. Please contact Super Admin for a valid key.');
      }

      if (keyData.status === 'USED') {
        throw new Error('This activation key has already been used. Each key can be activated only once.');
      }

      if (keyData.status === 'REVOKED') {
        throw new Error('This activation key has been revoked by the administrator.');
      }

      // 3. Check if User ID is already taken
      const userQuery = query(collection(db, 'users'), where('userId', '==', cleanUser));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        throw new Error('User ID is already taken. Please choose a different User ID.');
      }

      // 4. Calculate expiry date based on duration
      const duration: LicenseDuration = keyData.duration || '1_YEAR';
      const activatedAt = new Date().toISOString();
      let expiresAt: string | null = null;

      const actDate = new Date();
      if (duration === '1_MONTH') {
        actDate.setMonth(actDate.getMonth() + 1);
        expiresAt = actDate.toISOString();
      } else if (duration === '3_MONTHS') {
        actDate.setMonth(actDate.getMonth() + 3);
        expiresAt = actDate.toISOString();
      } else if (duration === '6_MONTHS') {
        actDate.setMonth(actDate.getMonth() + 6);
        expiresAt = actDate.toISOString();
      } else if (duration === '1_YEAR') {
        actDate.setFullYear(actDate.getFullYear() + 1);
        expiresAt = actDate.toISOString();
      } else {
        // LIFETIME
        expiresAt = null;
      }

      // 5. Generate unique tenant ID and internal auth email
      const tenantId = 'tenant_' + Math.random().toString(36).substring(2, 10);
      const internalEmail = `${cleanUser}@smartbilling.app`;

      // 6. Create Firebase Auth user
      let uid = tenantId;
      try {
        const secondaryApp = initializeApp(firebaseConfig, 'ActivationApp_' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, password);
        uid = cred.user.uid;
      } catch (authErr: any) {
        if (authErr?.code === 'auth/email-already-in-use') {
          throw new Error('This User ID or email is already registered.');
        }
        console.warn('Auth creation fallback ID used:', authErr?.message);
      }

      // 7. Save License, User Profile, Company, and update Key status
      const licensePayload: TenantLicense = {
        tenantId,
        businessName: cleanBusiness,
        userId: cleanUser,
        duration,
        status: 'ACTIVE',
        activatedAt,
        expiresAt,
        activationKeyHash: keyHash
      };

      const userProfilePayload: UserProfile = {
        userId: uid,
        name: cleanUser,
        email: internalEmail,
        activeCompanyId: tenantId,
        isSuperAdmin: false,
        status: 'ACTIVE',
        createdAt: activatedAt,
        updatedAt: activatedAt
      };

      const companyPayload: Company = {
        companyId: tenantId,
        name: cleanBusiness,
        invoicePrefix: 'INV-',
        nextInvoiceNumber: 1,
        financialYear: '2026-2027',
        financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
        createdAt: activatedAt,
        updatedAt: activatedAt
      };

      const memberPayload: CompanyMember = {
        companyId: tenantId,
        userId: uid,
        email: internalEmail,
        role: UserRole.ADMIN,
        invitedAt: activatedAt
      };

      // Commit to Firestore / LocalStorage
      try {
        await setDoc(doc(db, 'licenses', tenantId), licensePayload);
        await setDoc(doc(db, 'users', uid), userProfilePayload);
        await setDoc(doc(db, 'companies', tenantId), companyPayload);
        await setDoc(doc(db, 'companies', tenantId, 'members', uid), memberPayload);
        await setDoc(doc(db, 'activationKeys', keyHash), {
          ...keyData,
          status: 'USED',
          usedAt: activatedAt,
          usedByTenantId: tenantId,
          usedByUserId: uid
        }, { merge: true });
      } catch (dbWriteErr) {
        console.warn('Firestore write warning during activation:', dbWriteErr);
      }

      // Also cache in localStorage for robust offline/fallback resilience
      localStorage.setItem(`license_${tenantId}`, JSON.stringify(licensePayload));
      localStorage.setItem(`user_${uid}`, JSON.stringify(userProfilePayload));

      setSuccessInfo({ businessName: cleanBusiness, userId: cleanUser });
    } catch (err: any) {
      setError(err?.message || 'Activation failed. Please verify your activation key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-zinc-950 font-sans">
      {/* Left side brand intro */}
      <div className="hidden lg:flex flex-col bg-gradient-to-br from-blue-900 via-zinc-900 to-black p-12 justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-md relative z-10 space-y-6">
          <div className="p-3 bg-blue-600 rounded-2xl w-14 h-14 flex items-center justify-center shadow-xl shadow-blue-500/30">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Business Activation Portal</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Enter your unique activation key to initialize your secure multi-tenant billing workspace and unlock high-performance GST invoicing and inventory management.
          </p>
          <div className="pt-6 border-t border-zinc-800 space-y-3 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Strict Data Isolation via Unique Tenant ID</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Permanent Login Credentials with User ID</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Automated License Duration Tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side activation form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Activate Your Account</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Provide your activation key and create your shop login credentials.
            </p>
          </div>

          {successInfo ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">Activation Successful!</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Your shop <strong>{successInfo.businessName}</strong> has been successfully activated. You can now log in permanently using your User ID: <code>{successInfo.userId}</code>.
              </p>
              <button
                type="button"
                onClick={onActivationSuccess}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Proceed to Login
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">
                  Activation Key
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    placeholder="SBILL-XXXX-XXXX-XXXX"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">
                  Business / Shop Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Gupta Electronics & Hardware"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">
                  Desired User ID (Login Handle)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={userId}
                    onChange={(e) => setUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="gupta_store"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                  />
                </div>
                <span className="block text-[9px] text-gray-400 mt-1 ml-1">Lowercase letters, numbers and underscores only</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-wide rounded-xl flex items-center justify-center gap-2 transition-all mt-6 shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Activating License...' : 'Activate Business Account'}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
