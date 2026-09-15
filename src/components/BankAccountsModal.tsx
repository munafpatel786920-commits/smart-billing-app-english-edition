import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  X, 
  Check, 
  AlertCircle, 
  CreditCard, 
  Lock, 
  FileText, 
  Sparkles,
  QrCode,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BankAccount } from '../types';

interface BankAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: BankAccount | null;
}

// Common Indian Banks for fast 1-click autofill
const POPULAR_BANKS = [
  { name: 'State Bank of India', ifscPrefix: 'SBIN0' },
  { name: 'HDFC Bank', ifscPrefix: 'HDFC0' },
  { name: 'ICICI Bank', ifscPrefix: 'ICIC0' },
  { name: 'Axis Bank', ifscPrefix: 'UTIB0' },
  { name: 'Kotak Mahindra Bank', ifscPrefix: 'KKBK0' },
  { name: 'Punjab National Bank', ifscPrefix: 'PUNB0' },
  { name: 'Bank of Baroda', ifscPrefix: 'BARB0' },
  { name: 'Canara Bank', ifscPrefix: 'CNRB0' },
  { name: 'Union Bank of India', ifscPrefix: 'UBIN0' },
  { name: 'IndusInd Bank', ifscPrefix: 'INDB0' },
  { name: 'IDFC FIRST Bank', ifscPrefix: 'IDFB0' },
  { name: 'Federal Bank', ifscPrefix: 'FDRL0' }
];

export const BankAccountsModal: React.FC<BankAccountsModalProps> = ({
  isOpen,
  onClose,
  editingAccount
}) => {
  const { activeCompany, saveBankAccount, formatCurrency } = useApp();

  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState<'CURRENT' | 'SAVINGS' | 'OD_CC'>('CURRENT');
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [upiId, setUpiId] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState('');

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (editingAccount) {
      setBankName(editingAccount.bankName || '');
      setAccountHolderName(editingAccount.accountHolderName || activeCompany?.name || '');
      setAccountNumber(editingAccount.accountNumber || '');
      setConfirmAccountNumber(editingAccount.accountNumber || '');
      setIfscCode(editingAccount.ifscCode || '');
      setBranchName(editingAccount.branchName || '');
      setAccountType(editingAccount.accountType || 'CURRENT');
      setOpeningBalance(editingAccount.openingBalance ? editingAccount.openingBalance.toString() : '0');
      setOpeningBalanceDate(editingAccount.openingBalanceDate || new Date().toISOString().split('T')[0]);
      setUpiId(editingAccount.upiId || '');
      setIsDefault(!!editingAccount.isDefault);
      setDescription(editingAccount.description || '');
    } else {
      setBankName('');
      setAccountHolderName(activeCompany?.name || '');
      setAccountNumber('');
      setConfirmAccountNumber('');
      setIfscCode('');
      setBranchName('');
      setAccountType('CURRENT');
      setOpeningBalance('0');
      setOpeningBalanceDate(new Date().toISOString().split('T')[0]);
      setUpiId(activeCompany?.upiId || '');
      setIsDefault(false);
      setDescription('');
    }
    setFormErrors({});
  }, [editingAccount, activeCompany, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const errors: { [key: string]: string } = {};

    if (!bankName.trim()) {
      errors.bankName = 'Bank name is required';
    }

    if (!accountNumber.trim()) {
      errors.accountNumber = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(accountNumber.trim())) {
      errors.accountNumber = 'Account number must be 9 to 18 digits';
    }

    if (!editingAccount && accountNumber !== confirmAccountNumber) {
      errors.confirmAccountNumber = 'Account numbers do not match';
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!cleanIfsc) {
      errors.ifscCode = 'IFSC Code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      errors.ifscCode = 'Valid Indian IFSC required (e.g. SBIN0001234, 5th character must be 0)';
    }

    if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId.trim())) {
      errors.upiId = 'Invalid UPI ID format (expected user@bank / e.g. name@okhdfcbank)';
    }

    const parsedBalance = parseFloat(openingBalance);
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      errors.openingBalance = 'Opening balance must be 0 or a positive number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSelectPresetBank = (preset: { name: string; ifscPrefix: string }) => {
    setBankName(preset.name);
    if (!ifscCode || ifscCode.length < 5) {
      setIfscCode(preset.ifscPrefix);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await saveBankAccount({
        ...(editingAccount ? { accountId: editingAccount.accountId } : {}),
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim() || activeCompany?.name || 'Company Account',
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        branchName: branchName.trim(),
        accountType,
        openingBalance: parseFloat(openingBalance) || 0,
        openingBalanceDate,
        upiId: upiId.trim(),
        isDefault,
        description: description.trim()
      });

      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Failed to save bank account:', err);
      setFormErrors({ submit: err.message || 'Failed to save bank account. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="bank-modal-title" className="text-base font-bold text-gray-900 dark:text-white">
                {editingAccount ? 'Edit Bank Account' : 'Create New Bank Account'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Register bank account coordinates for business payments, auto-reconciliation, and invoices
              </p>
            </div>
          </div>
          <button
            id="btn-close-bank-modal"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formErrors.submit && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Quick Bank Presets */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">
              Popular Banks (Quick Select)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {POPULAR_BANKS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPresetBank(preset)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer ${
                    bankName === preset.name
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                      : 'bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bank Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                Bank Name *
              </label>
              <input
                id="input-bank-name"
                type="text"
                required
                value={bankName}
                onChange={(e) => {
                  setBankName(e.target.value);
                  if (formErrors.bankName) setFormErrors({ ...formErrors, bankName: '' });
                }}
                placeholder="e.g. State Bank of India, HDFC Bank"
                className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  formErrors.bankName ? 'border-rose-500' : 'border-gray-200 dark:border-zinc-700'
                }`}
              />
              {formErrors.bankName && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.bankName}</p>
              )}
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                Account Holder Name
              </label>
              <input
                id="input-account-holder"
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder={activeCompany?.name || 'Company Name'}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                Account Number *
              </label>
              <input
                id="input-account-number"
                type="text"
                required
                value={accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setAccountNumber(val);
                  if (formErrors.accountNumber) setFormErrors({ ...formErrors, accountNumber: '' });
                }}
                placeholder="e.g. 38291048291"
                className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  formErrors.accountNumber ? 'border-rose-500' : 'border-gray-200 dark:border-zinc-700'
                }`}
              />
              {formErrors.accountNumber && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.accountNumber}</p>
              )}
            </div>

            {/* Confirm Account Number (for new accounts) */}
            {!editingAccount ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                  Re-enter Account Number *
                </label>
                <input
                  id="input-confirm-account-number"
                  type="text"
                  required
                  value={confirmAccountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setConfirmAccountNumber(val);
                    if (formErrors.confirmAccountNumber) setFormErrors({ ...formErrors, confirmAccountNumber: '' });
                  }}
                  placeholder="Repeat account number"
                  className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    formErrors.confirmAccountNumber ? 'border-rose-500' : 'border-gray-200 dark:border-zinc-700'
                  }`}
                />
                {confirmAccountNumber && accountNumber === confirmAccountNumber && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Account numbers match
                  </p>
                )}
                {formErrors.confirmAccountNumber && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.confirmAccountNumber}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                  Branch Location
                </label>
                <input
                  id="input-branch-name-alt"
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Main Ring Road Branch"
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* IFSC Code */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                IFSC Code *
              </label>
              <input
                id="input-ifsc-code"
                type="text"
                required
                maxLength={11}
                value={ifscCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  setIfscCode(val);
                  if (formErrors.ifscCode) setFormErrors({ ...formErrors, ifscCode: '' });
                }}
                placeholder="e.g. SBIN0001234"
                className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-xl text-xs font-mono font-bold text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  formErrors.ifscCode ? 'border-rose-500' : 'border-gray-200 dark:border-zinc-700'
                }`}
              />
              <p className="text-[10px] text-gray-400 mt-1">11 alphanumeric characters (5th character is 0)</p>
              {formErrors.ifscCode && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.ifscCode}</p>
              )}
            </div>

            {/* Branch Name if not in editing mode */}
            {!editingAccount && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                  Branch Location
                </label>
                <input
                  id="input-branch-name"
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Industrial Area Branch, Surat"
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Account Type */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                Account Type *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['CURRENT', 'SAVINGS', 'OD_CC'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      accountType === type
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-gray-300'
                    }`}
                  >
                    {type === 'CURRENT' && 'Current A/c'}
                    {type === 'SAVINGS' && 'Savings A/c'}
                    {type === 'OD_CC' && 'OD / CC'}
                  </button>
                ))}
              </div>
            </div>

            {/* Opening Balance */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                Opening Balance (₹)
              </label>
              <input
                id="input-opening-balance"
                type="number"
                min="0"
                step="any"
                value={openingBalance}
                onChange={(e) => {
                  setOpeningBalance(e.target.value);
                  if (formErrors.openingBalance) setFormErrors({ ...formErrors, openingBalance: '' });
                }}
                placeholder="0"
                className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  formErrors.openingBalance ? 'border-rose-500' : 'border-gray-200 dark:border-zinc-700'
                }`}
              />
              {formErrors.openingBalance && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.openingBalance}</p>
              )}
            </div>

            {/* Opening Balance Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                Opening Balance As On Date
              </label>
              <input
                id="input-opening-date"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* UPI ID / VPA */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                UPI ID / VPA (Optional)
              </label>
              <div className="relative">
                <input
                  id="input-bank-upi"
                  type="text"
                  value={upiId}
                  onChange={(e) => {
                    setUpiId(e.target.value);
                    if (formErrors.upiId) setFormErrors({ ...formErrors, upiId: '' });
                  }}
                  placeholder="e.g. company@okhdfcbank"
                  className={`w-full p-2.5 pl-8 bg-gray-50 dark:bg-zinc-800 border rounded-xl text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    formErrors.upiId ? 'border-rose-500' : 'border-gray-200 dark:border-zinc-700'
                  }`}
                />
                <QrCode className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Used to generate dynamic payment QR codes on sales invoices</p>
              {formErrors.upiId && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.upiId}</p>
              )}
            </div>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
              Account Purpose / Notes (Optional)
            </label>
            <input
              id="input-bank-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Main supplier vendor payments, statutory GST tax payments"
              className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Default Account Checkbox */}
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
            <input
              id="checkbox-is-default"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="checkbox-is-default" className="text-xs text-gray-800 dark:text-zinc-200 cursor-pointer">
              <span className="font-bold block">Set as Primary Bank Account for Invoices & Receipts</span>
              <span className="text-[11px] text-gray-500 dark:text-zinc-400 block mt-0.5">
                When checked, these bank details and UPI QR code will print automatically on the footer of all customer tax invoices and quotation PDFs.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              id="btn-cancel-bank-modal"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-bank-modal"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingAccount ? 'Update Bank Account' : 'Create Bank Account'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
