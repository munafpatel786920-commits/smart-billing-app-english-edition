/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { statesOfIndia } from '../translations';
import { getCountryConfig, COUNTRIES, CountryCode } from '../utils/countryConfig';
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
  Loader2,
  Percent,
  Sliders,
  Plus,
  Globe,
  RefreshCw
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
  const [country, setCountry] = useState<CountryCode>((activeCompany?.country as CountryCode) || 'IN');
  
  // Manual Tax Rates State
  const [enableManualTaxRates, setEnableManualTaxRates] = useState<boolean>(activeCompany?.enableManualTaxRates || false);

  const [customCountryTaxRates, setCustomCountryTaxRates] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    Object.keys(COUNTRIES).forEach(code => {
      initial[code] = activeCompany?.customCountryTaxRates?.[code]
        ? [...activeCompany.customCountryTaxRates[code]!]
        : [...COUNTRIES[code as CountryCode].taxRates];
    });
    return initial;
  });

  const [customDefaultTaxRates, setCustomDefaultTaxRates] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    Object.keys(COUNTRIES).forEach(code => {
      initial[code] = activeCompany?.customDefaultTaxRates?.[code] !== undefined
        ? activeCompany.customDefaultTaxRates[code]!
        : COUNTRIES[code as CountryCode].defaultTaxRate;
    });
    return initial;
  });

  const [editingTaxCountry, setEditingTaxCountry] = useState<CountryCode>((activeCompany?.country as CountryCode) || 'IN');
  const [newSlabRateInput, setNewSlabRateInput] = useState('');
  const [taxRateActionNotice, setTaxRateActionNotice] = useState<string | null>(null);

  const selectedConfig = getCountryConfig(
    country,
    customCountryTaxRates,
    enableManualTaxRates,
    customDefaultTaxRates
  );

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
      setCountry((activeCompany.country as CountryCode) || 'IN');
      setEditingTaxCountry((activeCompany.country as CountryCode) || 'IN');
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
      setEnableManualTaxRates(activeCompany.enableManualTaxRates || false);

      const newCustomRates: Record<string, number[]> = {};
      const newDefaultRates: Record<string, number> = {};
      Object.keys(COUNTRIES).forEach(code => {
        newCustomRates[code] = activeCompany.customCountryTaxRates?.[code]
          ? [...activeCompany.customCountryTaxRates[code]!]
          : [...COUNTRIES[code as CountryCode].taxRates];
        newDefaultRates[code] = activeCompany.customDefaultTaxRates?.[code] !== undefined
          ? activeCompany.customDefaultTaxRates[code]!
          : COUNTRIES[code as CountryCode].defaultTaxRate;
      });
      setCustomCountryTaxRates(newCustomRates);
      setCustomDefaultTaxRates(newDefaultRates);
    }
  }, [activeCompany]);

  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry);
    setEditingTaxCountry(newCountry);
    const config = getCountryConfig(newCountry, customCountryTaxRates, enableManualTaxRates, customDefaultTaxRates);
    if (config && config.statesOrProvinces.length > 0) {
      setState(config.statesOrProvinces[0]);
    }
  };

  const handleAddTaxSlab = (cCode: CountryCode) => {
    const rateVal = parseFloat(newSlabRateInput);
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      alert('Please enter a valid tax rate percentage between 0% and 100% (e.g. 6, 12, 18, 22.5).');
      return;
    }
    const currentRates = customCountryTaxRates[cCode] || COUNTRIES[cCode].taxRates;
    if (currentRates.includes(rateVal)) {
      alert(`Tax rate ${rateVal}% already exists in ${COUNTRIES[cCode].name}.`);
      return;
    }
    const updated = [...currentRates, rateVal].sort((a, b) => a - b);
    setCustomCountryTaxRates(prev => ({
      ...prev,
      [cCode]: updated
    }));
    setNewSlabRateInput('');
    setTaxRateActionNotice(`Tax slab ${rateVal}% added for ${COUNTRIES[cCode].flag} ${COUNTRIES[cCode].name}! Click 'Update Company Profile' below to save.`);
    setTimeout(() => setTaxRateActionNotice(null), 4000);
  };

  const handleRemoveTaxSlab = (cCode: CountryCode, rateToRemove: number) => {
    const currentRates = customCountryTaxRates[cCode] || COUNTRIES[cCode].taxRates;
    if (currentRates.length <= 1) {
      alert('At least one tax rate slab must be maintained for compliance calculations.');
      return;
    }
    const updated = currentRates.filter(r => r !== rateToRemove);
    setCustomCountryTaxRates(prev => ({
      ...prev,
      [cCode]: updated
    }));
    if (customDefaultTaxRates[cCode] === rateToRemove) {
      setCustomDefaultTaxRates(prev => ({
        ...prev,
        [cCode]: updated[0] || 0
      }));
    }
    setTaxRateActionNotice(`Tax slab ${rateToRemove}% removed from ${COUNTRIES[cCode].name}. Click 'Update Company Profile' below to save.`);
    setTimeout(() => setTaxRateActionNotice(null), 4000);
  };

  const handleSetDefaultTaxRate = (cCode: CountryCode, rate: number) => {
    setCustomDefaultTaxRates(prev => ({
      ...prev,
      [cCode]: rate
    }));
    setTaxRateActionNotice(`Default standard rate set to ${rate}% for ${COUNTRIES[cCode].name}.`);
    setTimeout(() => setTaxRateActionNotice(null), 3000);
  };

  const handleApplyToAllCountries = (sourceCountry: CountryCode) => {
    const sourceRates = customCountryTaxRates[sourceCountry] || COUNTRIES[sourceCountry].taxRates;
    const sourceDefault = customDefaultTaxRates[sourceCountry] ?? COUNTRIES[sourceCountry].defaultTaxRate;
    const newRatesMap: Record<string, number[]> = {};
    const newDefaultsMap: Record<string, number> = {};

    Object.keys(COUNTRIES).forEach(code => {
      newRatesMap[code] = [...sourceRates];
      newDefaultsMap[code] = sourceDefault;
    });

    setCustomCountryTaxRates(newRatesMap);
    setCustomDefaultTaxRates(newDefaultsMap);
    setTaxRateActionNotice(`Tax slabs from ${COUNTRIES[sourceCountry].flag} ${COUNTRIES[sourceCountry].name} successfully applied to all 9 countries! Click 'Update Company Profile' below to save.`);
    setTimeout(() => setTaxRateActionNotice(null), 5000);
  };

  const handleResetCountryTaxRates = (cCode: CountryCode) => {
    setCustomCountryTaxRates(prev => ({
      ...prev,
      [cCode]: [...COUNTRIES[cCode].taxRates]
    }));
    setCustomDefaultTaxRates(prev => ({
      ...prev,
      [cCode]: COUNTRIES[cCode].defaultTaxRate
    }));
    setTaxRateActionNotice(`Tax slabs for ${COUNTRIES[cCode].name} restored to official government standards.`);
    setTimeout(() => setTaxRateActionNotice(null), 3500);
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
        financialYears,
        enableManualTaxRates,
        customCountryTaxRates,
        customDefaultTaxRates
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
                onChange={(e) => handleCountryChange(e.target.value as CountryCode)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-bold"
              >
                {Object.values(COUNTRIES).map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.taxName} • {c.currencyCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Company Registered State / Province *</label>
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
                  gstin
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 focus:border-emerald-500'
                    : 'border-gray-205 dark:border-zinc-800 text-blue-600 focus:border-indigo-500'
                }`}
              />
              <p className="text-[10px] mt-1 text-gray-500 font-sans">
                {selectedConfig.taxFormatLabel}
              </p>
            </div>

            {/* LIVE COUNTRY TAX COMPLIANCE BADGE */}
            <div className="col-span-1 sm:col-span-3 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-zinc-850 dark:to-zinc-900 border border-blue-200/60 dark:border-zinc-700/60 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/40 dark:border-zinc-700 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedConfig.flag}</span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-gray-900 dark:text-white tracking-wider flex items-center gap-2">
                      <span>{selectedConfig.name}</span>
                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-extrabold uppercase">
                        {selectedConfig.taxName} Active
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Currency: <strong className="text-gray-900 dark:text-white font-mono">{selectedConfig.currencyCode} ({selectedConfig.currencySymbol})</strong> | Tax ID: <strong className="text-gray-900 dark:text-white">{selectedConfig.taxLabel}</strong>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Standard Tax Rate</span>
                  <span className="text-base font-black text-blue-600 dark:text-blue-400">{selectedConfig.defaultTaxRate}% {selectedConfig.taxName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-2.5 bg-white/70 dark:bg-zinc-800/70 rounded-lg border border-gray-150 dark:border-zinc-700">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Tax System Structure</span>
                  <p className="font-bold text-gray-800 dark:text-zinc-200 mt-0.5">
                    {selectedConfig.taxSystem === 'dual_gst' ? 'Intrastate (CGST + SGST) & Interstate (IGST)' :
                     selectedConfig.taxSystem === 'single_vat' ? `Single Unified ${selectedConfig.taxName} Rate` :
                     selectedConfig.taxSystem === 'us_sales_tax' ? 'State & Local Origin/Destination Sales Tax' :
                     'Federal GST (5%) + Provincial PST / HST'}
                  </p>
                </div>
                <div className="p-2.5 bg-white/70 dark:bg-zinc-800/70 rounded-lg border border-gray-150 dark:border-zinc-700">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Standard Tax Slabs</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedConfig.taxRates.map((rate) => (
                      <span key={rate} className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        rate === selectedConfig.defaultTaxRate
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300'
                      }`}>
                        {rate}%
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-2.5 bg-white/70 dark:bg-zinc-800/70 rounded-lg border border-gray-150 dark:border-zinc-700">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Live Invoice Example</span>
                  <p className="font-mono text-[11px] text-gray-700 dark:text-zinc-300 mt-0.5">
                    Subtotal: <strong>{selectedConfig.currencySymbol}1,000.00</strong> + {selectedConfig.taxName} ({selectedConfig.defaultTaxRate}%): <strong>{selectedConfig.currencySymbol}{(1000 * selectedConfig.defaultTaxRate / 100).toFixed(2)}</strong> = <strong>{selectedConfig.currencySymbol}{(1000 * (1 + selectedConfig.defaultTaxRate / 100)).toFixed(2)}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* MANUAL TAX RATES / CUSTOM TAX SLABS CONFIGURATION */}
            <div className="col-span-1 sm:col-span-3 p-5 bg-white dark:bg-zinc-850 rounded-2xl border-2 border-indigo-200/70 dark:border-indigo-900/60 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Sliders className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Country Tax Rate Settings</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        enableManualTaxRates
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300'
                      }`}>
                        {enableManualTaxRates ? '✓ Manual Rates Active' : '🏛️ Official Preset Rates'}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configure custom tax rates for each country or use official government preset slabs.
                    </p>
                  </div>
                </div>

                {/* Mode Selector Toggle */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEnableManualTaxRates(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:cursor-pointer ${
                      !enableManualTaxRates
                        ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Official Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnableManualTaxRates(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:cursor-pointer ${
                      enableManualTaxRates
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    ✏️ Manual / Custom Rates
                  </button>
                </div>
              </div>

              {/* Action feedback alert banner */}
              {taxRateActionNotice && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{taxRateActionNotice}</span>
                </div>
              )}

              {/* Country Picker Tabs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <span>Select Country to Configure Tax Slabs:</span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 normal-case font-semibold">
                    Current Company: {COUNTRIES[country].flag} {COUNTRIES[country].name}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {Object.values(COUNTRIES).map(c => {
                    const isSelected = editingTaxCountry === c.code;
                    const isCompanyCountry = country === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setEditingTaxCountry(c.code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-gray-50 dark:bg-zinc-800/80 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.name.split(' ')[0]}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400'
                        }`}>
                          {c.taxName}
                        </span>
                        {isCompanyCountry && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Your Registered Country"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Editing Country Card */}
              {(() => {
                const activeC = COUNTRIES[editingTaxCountry];
                const activeRates = customCountryTaxRates[editingTaxCountry] || activeC.taxRates;
                const activeDefaultRate = customDefaultTaxRates[editingTaxCountry] ?? activeC.defaultTaxRate;

                return (
                  <div className="p-4 bg-gray-50/70 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-750 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/60 dark:border-zinc-700 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl">{activeC.flag}</span>
                        <div>
                          <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                            <span>{activeC.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-mono font-bold">
                              Tax: {activeC.taxName}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              ({activeC.currencyCode} - {activeC.currencySymbol})
                            </span>
                          </h5>
                          <p className="text-[11px] text-gray-500">
                            Structure: {activeC.taxSystem === 'dual_gst' ? 'Dual GST (CGST + SGST / IGST)' : activeC.taxSystem === 'single_vat' ? 'Single VAT' : activeC.taxSystem === 'canadian_gst_pst' ? 'GST + PST/HST' : 'Sales Tax'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyToAllCountries(editingTaxCountry)}
                          title="Copy these tax rates to all 9 countries"
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:cursor-pointer transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          Apply Slabs to All Countries
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetCountryTaxRates(editingTaxCountry)}
                          title="Restore official government presets for this country"
                          className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 text-gray-700 dark:text-zinc-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:cursor-pointer transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reset to Official Slabs
                        </button>
                      </div>
                    </div>

                    {/* Slabs Pill Display & Delete */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-zinc-300 mb-1.5 uppercase tracking-wide">
                        Active Tax Rate Slabs ({activeRates.length} Slabs Configured):
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {activeRates.map((rate) => {
                          const isDefault = rate === activeDefaultRate;
                          return (
                            <div
                              key={rate}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs shadow-2xs ${
                                isDefault
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border-gray-250 dark:border-zinc-700'
                              }`}
                            >
                              <span>{rate}%</span>
                              {isDefault && (
                                <span className="text-[9px] bg-blue-800 text-white px-1 py-0.2 rounded font-sans font-extrabold uppercase">
                                  Default
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveTaxSlab(editingTaxCountry, rate)}
                                title={`Remove ${rate}% slab`}
                                className={`ml-1 p-0.5 rounded-full hover:cursor-pointer transition-colors ${
                                  isDefault
                                    ? 'hover:bg-blue-700 text-blue-200'
                                    : 'hover:bg-red-50 dark:hover:bg-red-955/50 text-gray-400 hover:text-red-500'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Controls: Add New Slab & Pick Default */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* Add New Slab */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                          ➕ ADD NEW TAX SLAB (%)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="e.g. 6, 12.5, 14, 22"
                            value={newSlabRateInput}
                            onChange={(e) => setNewSlabRateInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTaxSlab(editingTaxCountry);
                              }
                            }}
                            className="flex-1 p-2 bg-white dark:bg-zinc-900 border border-gray-250 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold text-gray-900 dark:text-white focus:outline-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTaxSlab(editingTaxCountry)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm hover:cursor-pointer transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add Slab
                          </button>
                        </div>
                      </div>

                      {/* Select Default Rate */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                          ⭐ DEFAULT TAX RATE FOR NEW PRODUCTS
                        </label>
                        <select
                          value={activeDefaultRate}
                          onChange={(e) => handleSetDefaultTaxRate(editingTaxCountry, parseFloat(e.target.value) || 0)}
                          className="w-full p-2 bg-white dark:bg-zinc-900 border border-gray-250 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold text-gray-900 dark:text-white"
                        >
                          {activeRates.map((r) => (
                            <option key={r} value={r}>
                              {r}% Standard {r === 0 ? '(Tax Exempt)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
