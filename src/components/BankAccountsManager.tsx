import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  CreditCard, 
  Star, 
  Check, 
  Copy, 
  Eye, 
  EyeOff, 
  Edit3, 
  Trash2, 
  QrCode, 
  ArrowUpRight,
  ShieldCheck,
  Landmark
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BankAccount } from '../types';
import { BankAccountsModal } from './BankAccountsModal';

interface BankAccountsManagerProps {
  onOpenModal?: () => void;
}

export const BankAccountsManager: React.FC<BankAccountsManagerProps> = () => {
  const { 
    bankAccounts, 
    activeCompany, 
    deleteBankAccount, 
    setDefaultBankAccount, 
    formatCurrency 
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [revealedAccounts, setRevealedAccounts] = useState<{ [key: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleToggleReveal = (accountId: string) => {
    setRevealedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (account: BankAccount) => {
    const confirmMsg = `Are you sure you want to delete ${account.bankName} (${account.accountNumber})?`;
    if (window.confirm(confirmMsg)) {
      await deleteBankAccount(account.accountId);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    await setDefaultBankAccount(accountId);
  };

  // Mask helper
  const maskAccountNumber = (accNo: string) => {
    if (!accNo) return '';
    if (accNo.length <= 4) return accNo;
    const lastFour = accNo.slice(-4);
    const masked = '•'.repeat(Math.min(accNo.length - 4, 8));
    return `${masked} ${lastFour}`;
  };

  const totalOpeningBalance = (bankAccounts || []).reduce((sum, b) => sum + (b.openingBalance || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="bank-accounts-manager-title" className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              Registered Bank Accounts ({bankAccounts.length})
            </h3>
            {bankAccounts.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                Total Initial: {formatCurrency(totalOpeningBalance)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Manage company bank accounts for client invoice payments, transfers, and ledger accounting.
          </p>
        </div>

        <button
          id="btn-create-bank-account"
          type="button"
          onClick={handleCreateNew}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/15 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Bank Account</span>
        </button>
      </div>

      {/* Account Cards Grid */}
      {bankAccounts.length === 0 ? (
        <div className="bg-gray-50/70 dark:bg-zinc-800/30 border-2 border-dashed border-gray-200 dark:border-zinc-700/60 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
            No Bank Accounts Created Yet
          </h4>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto mb-4">
            Add your business current or savings account. Your primary account details and UPI QR code will print directly on customer invoices.
          </p>
          <button
            id="btn-empty-create-bank"
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Bank Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bankAccounts.map((account) => {
            const isRevealed = revealedAccounts[account.accountId];
            const isPrimary = account.isDefault;

            return (
              <div
                key={account.accountId}
                className={`relative rounded-2xl p-5 border transition-all ${
                  isPrimary
                    ? 'bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/20 dark:from-zinc-900 dark:via-zinc-900 dark:to-blue-950/20 border-blue-300 dark:border-blue-800 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 shadow-xs'
                }`}
              >
                {/* Top row: Bank name & badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${
                      isPrimary 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{account.bankName}</span>
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 uppercase">
                          {account.accountType === 'CURRENT' && 'Current Account'}
                          {account.accountType === 'SAVINGS' && 'Savings Account'}
                          {account.accountType === 'OD_CC' && 'OD / CC Account'}
                          {!account.accountType && 'Bank Account'}
                        </span>
                        {account.branchName && (
                          <span className="text-[10px] text-gray-500 dark:text-zinc-400 truncate max-w-[140px]">
                            • {account.branchName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isPrimary ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      Primary Invoice A/C
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(account.accountId)}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline cursor-pointer shrink-0"
                    >
                      Make Primary
                    </button>
                  )}
                </div>

                {/* Account Details Box */}
                <div className="p-3.5 bg-gray-50/80 dark:bg-zinc-800/60 rounded-xl space-y-2 mb-4 text-xs">
                  {/* Account Number */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-semibold">Account No:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {isRevealed ? account.accountNumber : maskAccountNumber(account.accountNumber)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReveal(account.accountId)}
                        title={isRevealed ? "Hide full account number" : "Show full account number"}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded hover:bg-gray-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(account.accountNumber, `acc_${account.accountId}`)}
                        title="Copy account number"
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded hover:bg-gray-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                      >
                        {copiedId === `acc_${account.accountId}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* IFSC Code */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-semibold">IFSC Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {account.ifscCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(account.ifscCode, `ifsc_${account.accountId}`)}
                        title="Copy IFSC code"
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded hover:bg-gray-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                      >
                        {copiedId === `ifsc_${account.accountId}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Holder Name */}
                  {account.accountHolderName && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-semibold">Holder:</span>
                      <span className="font-medium text-gray-800 dark:text-zinc-200">
                        {account.accountHolderName}
                      </span>
                    </div>
                  )}

                  {/* Opening Balance */}
                  {account.openingBalance > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/50 dark:border-zinc-700/50">
                      <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-semibold">Opening Balance:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(account.openingBalance)}
                      </span>
                    </div>
                  )}

                  {/* UPI ID */}
                  {account.upiId && (
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/50 dark:border-zinc-700/50">
                      <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-semibold flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-gray-400" /> UPI ID:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {account.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(account.upiId!, `upi_${account.accountId}`)}
                          title="Copy UPI ID"
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded hover:bg-gray-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                        >
                          {copiedId === `upi_${account.accountId}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800/80">
                  <span className="text-[10px] text-gray-400 truncate max-w-[170px]">
                    {account.description || 'Verified Business A/C'}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(account)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                      title="Edit bank account"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      className="p-1.5 text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors cursor-pointer"
                      title="Delete bank account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bank Account Modal */}
      <BankAccountsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingAccount={editingAccount}
      />
    </div>
  );
};
