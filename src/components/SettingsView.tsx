/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { statesOfIndia } from '../translations';
import { getCountryConfig, COUNTRIES } from '../utils/countryConfig';
import { 
  Building, 
  Settings, 
  MapPin, 
  CreditCard, 
  SunMoon,
  Save,
  Lock,
  UserCheck,
  Paperclip,
  X,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { MasterResetScope } from '../types';
import { BankAccountsManager } from './BankAccountsManager';

export const SettingsView: React.FC = () => {
  const { 
    activeCompany, 
    saveCompanyProfile, 
    updateUserProfile,
    userRole, 
    currentUser, 
    userProfile,
    theme, 
    toggleTheme, 
    t,
    verifyAdminCredentials,
    performMasterReset
  } = useApp();

  // User Profile Name State
  const [userDisplayName, setUserDisplayName] = useState(userProfile?.name || '');

  // Form states initialized with activeCompany or defaults
  const [name, setName] = useState(activeCompany?.name || '');
  const [email, setEmail] = useState(activeCompany?.email || '');
  const [phone, setPhone] = useState(activeCompany?.phone || '');
  const [address, setAddress] = useState(activeCompany?.address || '');
  const [country, setCountry] = useState<'IN' | 'US' | 'UK' | 'CA'>(activeCompany?.country || 'IN');
  
  const selectedConfig = getCountryConfig(country);

  const [state, setState] = useState(activeCompany?.state || (selectedConfig?.statesOrProvinces[0] || 'Maharashtra'));
  const [gstin, setGstin] = useState(activeCompany?.gstin || '');
  const [logoUrl, setLogoUrl] = useState(activeCompany?.logoUrl || '');
  
  // Sync form states when context data loads or changes
  React.useEffect(() => {
    if (userProfile?.name) setUserDisplayName(userProfile.name);
  }, [userProfile?.name]);

  React.useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name || '');
      setEmail(activeCompany.email || '');
      setPhone(activeCompany.phone || '');
      setAddress(activeCompany.address || '');
      setCountry(activeCompany.country || 'IN');
      setState(activeCompany.state || '');
      setGstin(activeCompany.gstin || '');
      setLogoUrl(activeCompany.logoUrl || '');
      setInvoicePrefix(activeCompany.invoicePrefix || 'INV-');
      setNextInvoiceNo(activeCompany.nextInvoiceNumber || 1);
      setBankName(activeCompany.bankName || '');
      setBankAccountNo(activeCompany.bankAccountNo || '');
      setBankIfsc(activeCompany.bankIfsc || '');
      setBankBranch(activeCompany.bankBranch || '');
      setUpiId(activeCompany.upiId || '');
      setFinancialYear(activeCompany.financialYear || '2026-2027');
      setFinancialYears(activeCompany.financialYears || ['2025-2026', '2026-2027', '2027-2028', '2028-2029']);
    }
  }, [activeCompany]);

  const handleCountryChange = (newCountry: 'IN' | 'US' | 'UK' | 'CA') => {
    setCountry(newCountry);
    const config = getCountryConfig(newCountry);
    if (config && config.statesOrProvinces.length > 0) {
      setState(config.statesOrProvinces[0]);
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size too large. Please upload a logo under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  // Sequence prefix setup
  const [invoicePrefix, setInvoicePrefix] = useState(activeCompany?.invoicePrefix || 'INV-');
  const [nextInvoiceNo, setNextInvoiceNo] = useState(activeCompany?.nextInvoiceNumber || 1);

  // Bank Coordinates
  const [bankName, setBankName] = useState(activeCompany?.bankName || '');
  const [bankAccountNo, setBankAccountNo] = useState(activeCompany?.bankAccountNo || '');
  const [bankIfsc, setBankIfsc] = useState(activeCompany?.bankIfsc || '');
  const [bankBranch, setBankBranch] = useState(activeCompany?.bankBranch || '');
  const [upiId, setUpiId] = useState(activeCompany?.upiId || '');

  // Financial Year states
  const [financialYear, setFinancialYear] = useState(activeCompany?.financialYear || '2026-2027');
  const [financialYears, setFinancialYears] = useState<string[]>(activeCompany?.financialYears || ['2025-2026', '2026-2027', '2027-2028', '2028-2029']);
  const [customYearInput, setCustomYearInput] = useState('');

  const handleAddFinancialYear = () => {
    const trimmed = customYearInput.trim();
    if (!trimmed) return;
    const fyRegex = /^\d{4}-\d{4}$/;
    if (!fyRegex.test(trimmed)) {
      alert('Please enter Financial Year in YYYY-YYYY format (e.g., 2027-2028).');
      return;
    }
    if (financialYears.includes(trimmed)) {
      alert('This Financial Year already exists.');
      return;
    }
    const updatedYears = [...financialYears, trimmed].sort();
    setFinancialYears(updatedYears);
    setFinancialYear(trimmed); // Auto select new year
    setCustomYearInput('');
    alert(`Financial Year "${trimmed}" added! Make sure to save profile settings below to finalize your changes.`);
  };

  // Master Reset States & Handlers (Admin ID & Password Protected)
  const [showResetModal, setShowResetModal] = useState(false);
  const [adminIdInput, setAdminIdInput] = useState(currentUser?.email || '');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetScope, setResetScope] = useState<MasterResetScope>('TRANSACTIONS_ONLY');
  const [confirmTextInput, setConfirmTextInput] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (currentUser?.email && !adminIdInput) {
      setAdminIdInput(currentUser.email);
    }
  }, [currentUser?.email]);

  const handleOpenResetModal = () => {
    setAdminIdInput(currentUser?.email || '');
    setAdminPasswordInput('');
    setConfirmTextInput('');
    setResetError(null);
    setResetSuccess(null);
    setResetScope('TRANSACTIONS_ONLY');
    setShowResetModal(true);
  };

  const handleMasterResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    const email = adminIdInput.trim();
    if (!email) {
      setResetError('Admin ID / Email is required.');
      return;
    }
    if (!adminPasswordInput) {
      setResetError('Admin Password is required to authorize the Master Reset.');
      return;
    }
    const cleanConfirm = confirmTextInput.trim().toUpperCase();
    if (cleanConfirm !== 'CONFIRM RESET' && cleanConfirm !== 'RESET') {
      setResetError('Security check: Please type "CONFIRM RESET" in the text box below.');
      return;
    }

    setResetLoading(true);
    try {
      const authResult = await verifyAdminCredentials(email, adminPasswordInput);
      if (!authResult.valid) {
        setResetError(authResult.error || 'Admin verification failed. Incorrect credentials or insufficient Admin rights.');
        setResetLoading(false);
        return;
      }

      await performMasterReset({
        scope: resetScope,
        adminEmail: email
      });

      setResetSuccess(
        resetScope === 'COMPLETE_RESET'
          ? 'Full Master Reset executed successfully! All transaction logs, products, customers, and suppliers have been cleanly wiped, and invoice numbering has reset to 1.'
          : 'Transaction Master Reset executed successfully! All invoices, purchases, returns, ledger entries, and expenses have been cleared, inventory stock reset to 0, and invoice numbering has reset to 1.'
      );
      setAdminPasswordInput('');
      setConfirmTextInput('');
    } catch (err: any) {
      console.error('Master Reset execution error:', err);
      setResetError(err?.message || 'Failed to complete master reset. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCompanySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !gstin) {
      alert(`Company Legal Name and ${selectedConfig.taxLabel} are mandatory fields.`);
      return;
    }

    try {
      await saveCompanyProfile({
        name,
        email,
        phone,
        address,
        state,
        gstin,
        logoUrl,
        invoicePrefix,
        nextInvoiceNumber: nextInvoiceNo,
        bankName,
        bankAccountNo,
        bankIfsc,
        bankBranch,
        upiId,
        country,
        financialYear,
        financialYears
      });

      alert('Company profile settings updated successfully! Page datasets synchronized.');
    } catch (err) {
      alert('Failed to save settings. Security policies require admin roles.');
    }
  };

  const handleUserProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDisplayName.trim()) {
      alert('Please enter your name.');
      return;
    }
    try {
      await updateUserProfile({ name: userDisplayName });
      alert('Personal profile updated successfully!');
    } catch (err) {
      alert('Failed to update personal profile.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* UI Settings panel: Theme & Translation box */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* User Profile Section */}
          <div className="space-y-4">
            <h4 id="setting-user-title" className="font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 text-xs">
              <UserCheck className="w-4 h-4 text-blue-500" />
              Personal Profile
            </h4>
            <p className="text-gray-400 text-[10px]">Your personal identity across all company workspaces.</p>
            
            <form onSubmit={handleUserProfileSave} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">YOUR DISPLAY NAME</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userDisplayName}
                    onChange={(e) => setUserDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-medium text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Update
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Appearance Section */}
          <div className="space-y-4">
            <h4 id="setting-theme-title" className="font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 text-xs">
              <SunMoon className="w-4 h-4 text-amber-500" />
              Appearance
            </h4>
            <p className="text-gray-400 text-[10px]">Toggle dark-mode canvas styling directly.</p>
            
            <button
              id="setting-theme-toggle-btn"
              onClick={toggleTheme}
              className="w-full sm:w-auto px-4 py-2 bg-gray-100 dark:bg-zinc-805 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 font-bold rounded-xl flex items-center justify-center gap-2 hover:cursor-pointer transition-colors text-xs"
            >
              <span>Current Theme:</span>
              <span className="uppercase text-blue-600 font-extrabold">{theme}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form: Corporate Profile Config */}
      <form onSubmit={handleCompanySave} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
        
        {/* Company basic coordinates */}
        <div className="space-y-4">
          <h3 id="setting-company-header" className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-50 pb-2 flex items-center gap-1.5">
            <Building className="w-5 h-5 text-blue-600" />
            {selectedConfig.taxName} Business entity configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">COMPANY LEGAL NAME *</label>
              <input
                id="form-c-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Patel Electricals Pvt Ltd"
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">CORPORATE PHONE</label>
              <input
                id="form-c-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">CORPORATE EMAIL</label>
              <input
                id="form-c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">REGISTERED COUNTRY *</label>
              <select
                id="form-c-country"
                value={country}
                onChange={(e) => handleCountryChange(e.target.value as any)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-bold"
              >
                <option value="IN">🇮🇳 India</option>
                <option value="US">🇺🇸 United States (USA)</option>
                <option value="UK">🇬🇧 United Kingdom (UK)</option>
                <option value="CA">🇨🇦 Canada (CAN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Company Registered state *</label>
              <select
                id="form-c-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
              >
                {selectedConfig.statesOrProvinces.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">{selectedConfig.taxLabel.toUpperCase()} *</label>
              <input
                id="form-c-gstin"
                type="text"
                required
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder={selectedConfig.taxLabelPlaceholder}
                className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-lg font-mono font-extrabold focus:outline-none ${
                  country === 'IN' && gstin
                    ? /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)
                      ? 'border-emerald-550 text-emerald-600 dark:text-emerald-400 focus:border-emerald-550'
                      : 'border-yellow-500 text-yellow-600 focus:border-yellow-500'
                    : 'border-gray-205 dark:border-zinc-800 text-blue-600 focus:border-indigo-500'
                }`}
              />
              {country === 'IN' && gstin && (
                <p className="text-[10px] mt-1 font-sans">
                  {/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin) ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Valid Indian GSTIN alphanumeric layout</span>
                  ) : (
                    <span className="text-yellow-600 dark:text-yellow-500 font-semibold">⚠ Expected 15-digit layout: State(2) + PAN(10) + Entity(1) + Z(1) + Checksum(1)</span>
                  )}
                </p>
              )}
            </div>

            <div className="col-span-1 sm:col-span-3 pb-4 pt-4 border-t border-b border-gray-150/40 dark:border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center gap-6">
              <div className="flex-1 space-y-2.5">
                <label className="block text-xs font-bold text-gray-500 mb-0.5">COMPANY BRAND LOGO</label>
                <p className="text-gray-400 text-[11px] leading-normal font-medium">Attach your company logo to customize bills, invoices, receipts, and headers instantly, or paste a public web image URL link.</p>
                
                <div className="flex gap-2.5 flex-wrap items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <button
                    id="btn-attach-logo"
                    type="button"
                    onClick={triggerFileSelect}
                    className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-extrabold text-[11px] uppercase tracking-wider border border-blue-150/40 dark:border-blue-900/40 rounded-xl flex items-center gap-1.5 transition-all hover:cursor-pointer shadow-sm shrink-0"
                  >
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    <span>Attach Logo File</span>
                  </button>

                  {logoUrl && (
                    <button
                      id="btn-remove-logo"
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="px-3 py-2.5 bg-red-50 dark:bg-red-955/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100/30 dark:border-red-900/30 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all hover:cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-widest text-gray-400 block uppercase">OR PASTE EXTERNAL DIRECT URL</span>
                  <input
                    id="form-c-logo"
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="e.g. https://yourcompany.com/logo.png"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Logo Preview Container */}
              <div className="w-24 h-24 bg-gray-50 dark:bg-zinc-800 border border-dashed border-gray-200 dark:border-zinc-750 rounded-2xl flex items-center justify-center p-2.5 shrink-0 shadow-inner overflow-hidden relative group">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="Logo Preview" 
                    className="max-w-full max-h-full object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <Building className="w-7 h-7 mx-auto opacity-30 mb-1 text-gray-500" />
                    <span className="text-[9px] block leading-tight font-bold uppercase tracking-wider">No Logo</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">REGISTERED TAX MAILING ADDRESS</label>
            <textarea
              id="form-c-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full mailing address for legal invoices headers"
              className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white h-12 text-xs"
            />
          </div>
        </div>

        {/* Invoice configuration settings */}
        <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-zinc-805">
          <h3 id="setting-invoice-header" className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Settings className="w-5 h-5 text-indigo-500" />
            Automatic Sequence Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Sales Prefix Sequence</label>
              <input
                id="form-c-prefix"
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-950 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Next Auto Number Increment</label>
              <input
                id="form-c-nextno"
                type="number"
                min="1"
                value={nextInvoiceNo}
                onChange={(e) => setNextInvoiceNo(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-950 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Financial Year settings */}
        <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-zinc-805">
          <h3 id="setting-fy-header" className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-5 h-5 text-amber-500" />
            Financial Year Settings
          </h3>
          <p className="text-gray-400 text-xs leading-normal">
            Select the active financial year. All transactions, invoices, sales billing, and report indices will automatically partition and organize under the selected year.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">ACTIVE FINANCIAL YEAR</label>
              <select
                id="form-c-fy"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-805 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:bg-zinc-800 dark:text-white font-extrabold focus:ring-2 focus:ring-amber-500"
              >
                {financialYears.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy} (FY {fy.replace('-', ' - ')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">ADD NEW FINANCIAL YEAR</label>
              <div className="flex gap-2">
                <input
                  id="form-c-newfy"
                  type="text"
                  value={customYearInput}
                  onChange={(e) => setCustomYearInput(e.target.value)}
                  placeholder="e.g. 2027-2028"
                  className="flex-1 p-2.5 bg-gray-50 dark:bg-zinc-805 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white dark:bg-zinc-800 font-bold placeholder-gray-400 focus:ring-2 focus:ring-amber-500"
                />
                <button
                  id="btn-add-fy"
                  type="button"
                  onClick={handleAddFinancialYear}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Add Year
                </button>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">Format: Year-Year (e.g., 2027-2028)</span>
            </div>
          </div>
        </div>

        {/* Bank accounts setup details */}
        <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-zinc-805">
          <h3 id="setting-bank-header" className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            Bank transfer coordinates (Renders on PDF invoice footer)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">BANK NAME</label>
              <input
                id="form-b-name"
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">ACCOUNT NUMBER</label>
              <input
                id="form-b-acc"
                type="text"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                placeholder="11-digit or 15-digit number"
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">IFSC CODE</label>
              <input
                id="form-b-ifsc"
                type="text"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg font-mono text-blue-600 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">BRANCH LOCATION</label>
              <input
                id="form-b-branch"
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">UPI ID (VPA) FOR DIGITAL QRs</label>
              <input
                id="form-b-upi"
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. patelstore@okicici"
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg font-mono text-indigo-600 font-bold dark:text-indigo-400"
              />
              <p className="text-[9px] text-gray-400 mt-1">
                Autobuilds scan-to-pay QR codes instantly on tax invoices!
              </p>
            </div>
          </div>
        </div>

        {/* Security / User credentials details info */}
        <div className="pt-4 border-t border-gray-50 dark:border-zinc-805 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-zinc-800/10 p-4 rounded-xl gap-4">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-blue-600 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Current Authorized Profile</span>
              <p className="font-bold text-gray-800 dark:text-zinc-250 mt-0.5">{currentUser?.email || 'N/A'}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Role Authorization Level: <span className="text-blue-600 font-extrabold uppercase">{userRole}</span></p>
            </div>
          </div>

          <button
            id="form-c-save-btn"
            type="submit"
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl hover:cursor-pointer transition-colors shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            Save Profile Settings
          </button>
        </div>

      </form>

      {/* Registered Bank Accounts Card */}
      <div id="settings-bank-accounts-card" className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
        <BankAccountsManager />
      </div>

      {/* Master Reset / Danger Zone Section */}
      <div id="master-reset-section" className="mt-8 pt-6 border-t border-red-200 dark:border-red-950/50">
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 dark:bg-red-950/50 rounded-lg text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  Company Master Reset
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-full border border-red-300 dark:border-red-800">
                    Admin ID & Password Protected
                  </span>
                </h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-zinc-400 max-w-2xl mt-1">
                Wipe or reset business records, sales invoices, purchase bills, returns, cash/bank ledger transactions, daily expenses, and reset invoice counter to 1. Requires Admin Email ID and Password verification to execute.
              </p>
            </div>

            <button
              id="btn-open-master-reset"
              type="button"
              onClick={handleOpenResetModal}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              Master Reset Console
            </button>
          </div>
        </div>
      </div>

      {/* Master Reset Authorization Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Admin Authorization: Master Reset</h3>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">Verify Admin credentials to execute reset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !resetLoading && setShowResetModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleMasterResetSubmit} className="p-6 space-y-5">
              {resetSuccess ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5" />
                    Reset Operation Successful!
                  </div>
                  <p className="leading-relaxed">{resetSuccess}</p>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Warning banner */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold">Irreversible Action</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Selected company transaction records will be permanently erased. Enter your Administrator credentials to authorize this action.
                      </p>
                    </div>
                  </div>

                  {resetError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  {/* Admin Credentials */}
                  <div className="space-y-3.5 bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block">
                      Admin Verification Credentials
                    </span>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        ADMIN EMAIL / ID *
                      </label>
                      <input
                        id="reset-admin-email"
                        type="email"
                        required
                        value={adminIdInput}
                        onChange={(e) => setAdminIdInput(e.target.value)}
                        placeholder="admin@company.com"
                        className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        ADMIN PASSWORD *
                      </label>
                      <div className="relative">
                        <input
                          id="reset-admin-password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={adminPasswordInput}
                          onChange={(e) => setAdminPasswordInput(e.target.value)}
                          placeholder="Enter Admin Account Password"
                          className="w-full p-2.5 pr-10 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scope Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300">
                      SELECT RESET SCOPE *
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <label
                        onClick={() => setResetScope('TRANSACTIONS_ONLY')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          resetScope === 'TRANSACTIONS_ONLY'
                            ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 text-gray-900 dark:text-white font-semibold'
                            : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-red-600 dark:text-red-400">Transactions Only</span>
                            <input
                              type="radio"
                              name="resetScope"
                              checked={resetScope === 'TRANSACTIONS_ONLY'}
                              onChange={() => setResetScope('TRANSACTIONS_ONLY')}
                              className="accent-red-600"
                            />
                          </div>
                          <p className="text-[11px] mt-1.5 opacity-90">
                            Wipes all Invoices, Purchases, Ledger, Expenses & Stock. Retains Products, Customers & Suppliers.
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 block">
                          Recommended (Keeps Catalog & Parties)
                        </span>
                      </label>

                      <label
                        onClick={() => setResetScope('COMPLETE_RESET')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          resetScope === 'COMPLETE_RESET'
                            ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 text-gray-900 dark:text-white font-semibold'
                            : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-red-600 dark:text-red-400">Full Factory Reset</span>
                            <input
                              type="radio"
                              name="resetScope"
                              checked={resetScope === 'COMPLETE_RESET'}
                              onChange={() => setResetScope('COMPLETE_RESET')}
                              className="accent-red-600"
                            />
                          </div>
                          <p className="text-[11px] mt-1.5 opacity-90">
                            Wipes EVERYTHING: Invoices, Purchases, Ledger, AND all Products, Customers, and Suppliers.
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-2 block">
                          Total Blank Slate
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Confirmation Input */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                      TYPE <span className="text-red-600 font-mono">CONFIRM RESET</span> TO VERIFY *
                    </label>
                    <input
                      id="reset-confirm-text"
                      type="text"
                      required
                      value={confirmTextInput}
                      onChange={(e) => setConfirmTextInput(e.target.value)}
                      placeholder="CONFIRM RESET"
                      className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none uppercase"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={resetLoading}
                      onClick={() => setShowResetModal(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-execute-master-reset"
                      type="submit"
                      disabled={resetLoading}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/20 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Authenticating & Resetting...
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4" />
                          Verify & Execute Master Reset
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
