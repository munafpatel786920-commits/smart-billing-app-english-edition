/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { firebaseConfigExport } from '../firebase';
import { KeyRound, Mail, User, Building2, ChevronRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import logo from '../assets/logo.png';

export const AuthView: React.FC = () => {
  const { login, register, loginWithGoogle, loginWithDemo, authLoading, authError } = useApp();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoadingState(true);
    
    // Auto-heal common email typos e.g., 'demo@gmail' -> 'demo@gmail.com'
    let targetEmail = email.trim().toLowerCase();
    if (targetEmail === 'demo@gmail') {
      targetEmail = 'demo@gmail.com';
    } else if (targetEmail.endsWith('@gmail')) {
      targetEmail = targetEmail + '.com';
    }
    
    try {
      if (isRegister) {
        await register(targetEmail, firstName, password, companyName);
      } else {
        await login(targetEmail, password);
      }
    } catch (err: any) {
      const errorCode = err?.code || 'unknown';
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Authentication failed';

      if (errorCode === 'auth/operation-not-allowed') {
        setError(`Email/Password login is currently NOT active for your project.`);
      } else if (errorCode === 'auth/unauthorized-domain') {
        setError(`This domain (${window.location.hostname}) is not authorized in Firebase.`);
      } else if (errorCode === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        setError('Invalid email or password. Please verify your credentials.');
      } else {
        setError(`Login failed: ${errorMessage}`);
      }
    } finally {
      setLoadingState(false);
    }
  };

  const marketingFeatures = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-blue-500" />,
      title: "GST Ready Invoicing",
      desc: "Generate professional GST compliant invoices in seconds with custom branding."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      title: "Inventory Management",
      desc: "Real-time stock tracking with low-stock alerts and multi-warehouse support."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-amber-500" />,
      title: "Financial Analytics",
      desc: "Deep insights into your profit, loss, and cash flow with automated ledgers."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-purple-500" />,
      title: "Cloud-Sync Access",
      desc: "Access your business data securely from any device, anywhere in the world."
    }
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-zinc-950 font-sans selection:bg-blue-100 selection:text-blue-700">
      
      {/* Left Section - Feature Advertisement */}
      <div className="hidden lg:flex flex-col bg-gray-50/50 dark:bg-zinc-900/50 border-r border-gray-100 dark:border-zinc-800 p-12 justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500 blur-[120px]"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500 blur-[120px]"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md relative z-10"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white uppercase leading-none">Smart Billing</h1>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Enterprise Solution</p>
            </div>
          </div>

          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6">
            The Ultimate Operating System for <span className="text-blue-600">Your Business.</span>
          </h2>
          
          <p className="text-gray-600 dark:text-zinc-400 text-lg mb-12">
            Streamline your operations, manage inventory, and boost productivity with Global Software's most powerful billing engine.
          </p>

          <div className="grid gap-6">
            {marketingFeatures.map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (idx * 0.1) }}
                className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
              >
                <div className="flex-shrink-0 mt-1">{feature.icon}</div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">{feature.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0.5">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Section - Login Interface */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Professional Login</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Access your business dashboard securely.</p>
          </div>

          {(error || authError) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="p-3.5 mb-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs rounded-xl space-y-2"
            >
              <div className="flex items-start gap-2 font-semibold">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <span>{error || authError}</span>
              </div>
              
              {(error?.includes('NOT active') || error?.includes('operation-not-allowed')) && (
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 space-y-2">
                  <p>
                    <strong>To enable in Firebase Console:</strong> Go to <em>Authentication → Sign-in method → Click 'Email/Password' → Enable → Save</em>.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setEmail('patelmunaf90@gmail.com');
                      setPassword('munaf786');
                      setIsRegister(false);
                      setError('');
                      try {
                        await login('patelmunaf90@gmail.com', 'munaf786');
                      } catch (e) {}
                    }}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-sm"
                  >
                    ⚡ Instant Super Admin Sign-In
                  </button>
                </div>
              )}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="grid gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-zinc-500 group-focus-within:text-blue-500 transition-colors">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Business Name</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-zinc-500 group-focus-within:text-blue-500 transition-colors">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company Pvt Ltd"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-zinc-500 group-focus-within:text-blue-500 transition-colors">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourbusiness.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Password</label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-zinc-500 group-focus-within:text-blue-500 transition-colors">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingState || authLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-blue-400 disabled:scale-100 text-white font-bold text-sm tracking-wide rounded-xl flex items-center justify-center gap-2 transition-all mt-6 shadow-xl shadow-blue-600/20 cursor-pointer"
            >
              {loadingState ? 'Verifying...' : isRegister ? 'Set Up Business' : 'Access Dashboard'}
              {!loadingState && <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Quick Super Admin Helper */}
          <div className="mt-4 p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-[11px] font-bold text-gray-800 dark:text-zinc-200">Super Admin Access</p>
                <p className="text-[10px] text-gray-500 font-mono">patelmunaf90@gmail.com</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('patelmunaf90@gmail.com');
                setPassword('munaf786');
                setIsRegister(false);
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              Autofill
            </button>
          </div>

          <div className="mt-10 text-center">
            <p className="text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
              © GLOBAL SOFTWARE SOLUTIONS 2026
            </p>
            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mt-3 lowercase tracking-tighter">
              Contact for support:{' '}
              <a 
                href="mailto:patelmunaf90@gmail.com" 
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline lowercase"
              >
                patelmunaf90@gmail.com
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};


