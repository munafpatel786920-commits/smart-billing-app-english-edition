/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  FileText,
  Clock,
  Globe,
  Calculator,
  Percent,
  Eye,
  History,
  FileSearch,
  Coins,
  Landmark,
  ArrowRightLeft,
  Plus,
  Trash2,
  Wallet,
  Building2
} from 'lucide-react';
import { BankAccountsModal } from './BankAccountsModal';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';

export const DashboardView: React.FC = () => {
  const { 
    invoices, 
    purchases, 
    products, 
    transactions, 
    formatCurrency, 
    countryConfig, 
    t,
    capitalInvestments,
    saveCapitalInvestment,
    deleteCapitalInvestment,
    recordLedgerPayment,
    activeCompany,
    expenses,
    customers,
    suppliers,
    bankAccounts
  } = useApp();

  // --------------------------------------------------------
  // STARTUP CAPITAL & CASH / BANK BALANCE DYNAMIC BOOK
  // --------------------------------------------------------
  const totalCapitalInvested = useMemo(() => {
    return (capitalInvestments || []).reduce((sum, item) => sum + item.amount, 0);
  }, [capitalInvestments]);

  const currentCashBalance = useMemo(() => {
    // 1. Starting cash capital invested
    let balance = (capitalInvestments || []).reduce((sum, item) => sum + (item.cashAmount || 0), 0);
    
    // 2. Add cash payments received and subtract cash payments made
    (transactions || []).forEach(tx => {
      if (tx.paymentMode === 'CASH') {
        if (tx.type === 'PAYMENT_RECEIVED') {
          balance += tx.amount;
        } else if (tx.type === 'PAYMENT_MADE') {
          balance -= tx.amount;
        }
      }
    });

    // 3. Deduct expenses paid via CASH
    (expenses || []).forEach(exp => {
      if ((exp.paymentMode || 'CASH') === 'CASH') {
        balance -= exp.amount;
      }
    });

    return balance;
  }, [capitalInvestments, transactions, expenses]);

  const currentBankBalance = useMemo(() => {
    // 1. Starting bank capital invested
    let balance = (capitalInvestments || []).reduce((sum, item) => sum + (item.bankAmount || 0), 0);
    
    // 2. Add bank payments received and subtract bank payments made
    (transactions || []).forEach(tx => {
      if (tx.paymentMode === 'BANK_TRANSFER' || tx.paymentMode === 'UPI') {
        if (tx.type === 'PAYMENT_RECEIVED') {
          balance += tx.amount;
        } else if (tx.type === 'PAYMENT_MADE') {
          balance -= tx.amount;
        }
      }
    });

    // 3. Deduct expenses paid via BANK
    (expenses || []).forEach(exp => {
      if (exp.paymentMode === 'BANK_TRANSFER' || exp.paymentMode === 'UPI') {
        balance -= exp.amount;
      }
    });

    return balance;
  }, [capitalInvestments, transactions, expenses]);

  // State for modals
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Capital Modal States
  const [partnerName, setPartnerName] = useState('');
  const [capitalAmount, setCapitalAmount] = useState('');
  const [cashAllocated, setCashAllocated] = useState('');
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [investmentNotes, setInvestmentNotes] = useState('');

  // Transfer Modal States
  const [transferType, setTransferType] = useState<'CASH_TO_BANK' | 'BANK_TO_CASH'>('CASH_TO_BANK');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNotes, setTransferNotes] = useState('');

  // Auto-allocate cash and bank helper
  const handleCapitalAmountChange = (val: string) => {
    setCapitalAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      const suggestedCash = Math.round(num * 0.2); // 20% cash default
      setCashAllocated(String(suggestedCash));
    } else {
      setCashAllocated('');
    }
  };

  const clearCapitalForm = () => {
    setPartnerName('');
    setCapitalAmount('');
    setCashAllocated('');
    setInvestmentDate(new Date().toISOString().split('T')[0]);
    setInvestmentNotes('');
  };

  const clearTransferForm = () => {
    setTransferAmount('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferNotes('');
  };

  // Handle Capital Save
  const handleCapitalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(capitalAmount);
    const cash = parseFloat(cashAllocated) || 0;
    const bank = amount - cash;

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid Capital amount.");
      return;
    }
    if (cash < 0 || bank < 0) {
      alert("Cash allocation cannot be more than total Capital.");
      return;
    }

    try {
      await saveCapitalInvestment({
        partnerName: partnerName.trim() || 'Owner Capital',
        amount,
        cashAmount: cash,
        bankAmount: bank,
        date: investmentDate,
        description: investmentNotes.trim() || 'Startup Capital Introduced'
      });
      setIsCapitalModalOpen(false);
      clearCapitalForm();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Cash-Bank transfer save
  const handleTransferSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }

    // Balance validation
    if (transferType === 'CASH_TO_BANK' && amount > currentCashBalance) {
      alert(`Inadequate Cash Balance! Available cash balance is only ${formatCurrency(currentCashBalance)}.`);
      return;
    }
    if (transferType === 'BANK_TO_CASH' && amount > currentBankBalance) {
      alert(`Inadequate Bank Balance! Available bank balance is only ${formatCurrency(currentBankBalance)}.`);
      return;
    }

    try {
      const desc = transferNotes.trim() || (transferType === 'CASH_TO_BANK' ? 'Deposited Cash into Bank' : 'Withdrew Cash from Bank');
      
      if (transferType === 'CASH_TO_BANK') {
        // Cash reduction
        await recordLedgerPayment({
          type: 'PAYMENT_MADE',
          referenceId: 'contra_trans',
          referenceNo: 'CONTRA',
          entityId: 'contra',
          entityName: 'Self (Deposit to Bank)',
          amount,
          date: transferDate,
          paymentMode: 'CASH',
          description: `Internal Transfer: ${desc}`
        });

        // Bank addition
        await recordLedgerPayment({
          type: 'PAYMENT_RECEIVED',
          referenceId: 'contra_trans',
          referenceNo: 'CONTRA',
          entityId: 'contra',
          entityName: 'Self (Deposit to Bank)',
          amount,
          date: transferDate,
          paymentMode: 'BANK_TRANSFER',
          description: `Internal Transfer: ${desc}`
        });
      } else {
        // Bank reduction
        await recordLedgerPayment({
          type: 'PAYMENT_MADE',
          referenceId: 'contra_trans',
          referenceNo: 'CONTRA',
          entityId: 'contra',
          entityName: 'Self (Withdrawal to Cash)',
          amount,
          date: transferDate,
          paymentMode: 'BANK_TRANSFER',
          description: `Internal Transfer: ${desc}`
        });

        // Cash addition
        await recordLedgerPayment({
          type: 'PAYMENT_RECEIVED',
          referenceId: 'contra_trans',
          referenceNo: 'CONTRA',
          entityId: 'contra',
          entityName: 'Self (Withdrawal to Cash)',
          amount,
          date: transferDate,
          paymentMode: 'CASH',
          description: `Internal Transfer: ${desc}`
        });
      }

      setIsTransferModalOpen(false);
      clearTransferForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCapitalDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this Capital Investment? It will update balances immediately.")) {
      try {
        await deleteCapitalInvestment(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const contraTransfers = useMemo(() => {
    return (transactions || []).filter(tx => tx.entityId === 'contra' && tx.type === 'PAYMENT_MADE');
  }, [transactions]);

  // 1. Calculations: Sales Today
  const salesToday = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return invoices
      .filter(inv => inv.date.startsWith(todayStr))
      .reduce((sum, inv) => sum + inv.grandTotal, 0);
  }, [invoices]);

  // Calculations: Purchases Today
  const purchasesToday = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return purchases
      .filter(pur => pur.date.startsWith(todayStr))
      .reduce((sum, pur) => sum + pur.grandTotal, 0);
  }, [purchases]);

  // Calculations: Current Stock Value (Purchase Price * Stock)
  const currentStockValue = useMemo(() => {
    return products.reduce((sum, prod) => {
      const stock = Math.max(0, prod.currentStock);
      return sum + (stock * prod.purchasePrice);
    }, 0);
  }, [products]);

  // Calculations: Low Stock Catalog Alerts
  const lowStockProducts = useMemo(() => {
    return products.filter(prod => prod.currentStock <= prod.lowStockThreshold);
  }, [products]);

  // Calculations: Recent Transactions Log
  const recentTx = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  // Calculations: Monthly revenue computations for Recharts
  const monthlyRevenueData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataMap: Record<string, { month: string, Sales: number, Purchases: number }> = {};
    
    // Initialize current year months
    const currentYear = new Date().getFullYear();
    months.forEach((m, idx) => {
      const key = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
      dataMap[key] = { month: m, Sales: 0, Purchases: 0 };
    });

    invoices.forEach(inv => {
      if (inv.date) {
        try {
          const d = new Date(inv.date);
          if (!isNaN(d.getTime())) {
            const invYear = d.getFullYear();
            if (invYear === currentYear) {
              const monthIdx = d.getMonth();
              const monthKey = `${currentYear}-${String(monthIdx + 1).padStart(2, '0')}`;
              if (dataMap[monthKey]) {
                dataMap[monthKey].Sales += inv.grandTotal;
              }
            }
          }
        } catch (e) {
          console.error("Error parsing invoice date for chart:", inv.date, e);
        }
      }
    });

    purchases.forEach(pur => {
      if (pur.date) {
        try {
          const d = new Date(pur.date);
          if (!isNaN(d.getTime())) {
            const purYear = d.getFullYear();
            if (purYear === currentYear) {
              const monthIdx = d.getMonth();
              const monthKey = `${currentYear}-${String(monthIdx + 1).padStart(2, '0')}`;
              if (dataMap[monthKey]) {
                dataMap[monthKey].Purchases += pur.grandTotal;
              }
            }
          }
        } catch (e) {
          console.error("Error parsing purchase date for chart:", pur.date, e);
        }
      }
    });

    return Object.values(dataMap);
  }, [invoices, purchases]);

  // Calculations: Simple top selling items aggregates
  const topSellingProducts = useMemo(() => {
    const salesCount: Record<string, { name: string, quantity: number, earnings: number }> = {};
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!salesCount[item.productId]) {
          salesCount[item.productId] = { name: item.name, quantity: 0, earnings: 0 };
        }
        salesCount[item.productId].quantity += item.qty;
        salesCount[item.productId].earnings += item.total;
      });
    });

    return Object.values(salesCount)
      .sort((a,b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [invoices]);

  const totalReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingBalance > 0 ? c.outstandingBalance : 0), 0);
  }, [customers]);

  const totalPayables = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.outstandingBalance > 0 ? s.outstandingBalance : 0), 0);
  }, [suppliers]);

  const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-6">
      
      {/* Top statistics highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Sales Today */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">{t('todaySales')}</span>
            <h3 id="stat-sales-today" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">
              {formatCurrency(salesToday)}
            </h3>
            <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-time Inflow</span>
            </div>
          </div>
          <div className="p-3.5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI: Purchase Today */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">{t('todayPurchases')}</span>
            <h3 id="stat-purchases-today" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">
              {formatCurrency(purchasesToday)}
            </h3>
            <div className="flex items-center gap-1 text-orange-500 text-xs font-semibold mt-2">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Inventory Outward</span>
            </div>
          </div>
          <div className="p-3.5 bg-orange-50 dark:bg-orange-900/10 rounded-2xl text-orange-500 dark:text-orange-400">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* KPI: Total Stock Valuation */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">{t('stockValue')}</span>
            <h3 id="stat-stock-valuation" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">
              {formatCurrency(currentStockValue)}
            </h3>
            <div className="flex items-center gap-1 text-blue-600 text-xs font-semibold mt-2">
              <Boxes className="w-3.5 h-3.5" />
              <span>{products.length} Products master</span>
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* KPI: Low stock warnings */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">{t('lowStockAlerts')}</span>
            <h3 id="stat-low-stock-count" className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white mt-1">
              {lowStockProducts.length}
            </h3>
            <div className={`flex items-center gap-1 text-xs font-semibold mt-2 ${lowStockProducts.length > 0 ? 'text-rose-500 animate-pulse' : 'text-gray-500'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lowStockProducts.length > 0 ? 'Action required soon' : 'All stocks healthy'}</span>
            </div>
          </div>
          <div className={`p-3.5 rounded-2xl ${lowStockProducts.length > 0 ? 'bg-rose-50 dark:bg-rose-900/10 text-rose-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* STARTUP CAPITAL INVESTMENT & LIVE CASH-BANK MANAGEMENT PANEL */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col items-start w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-800/80 pb-5 mb-5 w-full">
          <div>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-extrabold uppercase px-2.5 py-1 rounded-full border border-indigo-500/30 tracking-widest">
              Business Startup Accounts 
            </span>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mt-2 flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              Business Accounts & Capital
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-medium">
              Manage your initial startup capital and track cash/bank contra transfers to run the business.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCapitalModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Invest Capital
            </button>
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-700 dark:text-white text-xs font-bold border border-gray-200 dark:border-zinc-700 rounded-xl transition-all cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />
              Cash ⇋ Bank Transfer (Contra)
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3.5 py-2 text-xs font-bold bg-gray-50 hover:bg-gray-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-750 text-gray-600 dark:text-zinc-350 rounded-xl transition-all cursor-pointer"
            >
              {showHistory ? "Hide Records" : "Show Details"}
            </button>
          </div>
        </div>

        {/* 3 accounts balances grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
          
          {/* Card 1: Total Capital */}
          <div className="bg-gray-50/50 dark:bg-zinc-950/40 rounded-xl p-5 border border-gray-100 dark:border-zinc-800/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Total Capital Invested</span>
                <span className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Coins className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-4 font-mono">
                {formatCurrency(totalCapitalInvested)}
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-4 leading-normal">
              Total funds invested by business owners to run operations.
            </p>
          </div>

          {/* Card 2: Cash Balance */}
          <div className="bg-gray-50/50 dark:bg-zinc-950/40 rounded-xl p-5 border border-gray-100 dark:border-zinc-800/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Cash in Hand</span>
                <span className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <h3 className={`text-3xl font-extrabold tracking-tight mt-4 font-mono ${currentCashBalance < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatCurrency(currentCashBalance)}
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-4 leading-normal">
              Live physical cash drawer balance based on real-time cash sales, payments, and expenses.
            </p>
          </div>

          {/* Card 3: Bank Account Balance */}
          <div className="bg-gray-50/50 dark:bg-zinc-950/40 rounded-xl p-5 border border-gray-100 dark:border-zinc-800/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Bank Balance</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsBankModalOpen(true)}
                    title="Create / Add Bank Account"
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Add Bank</span>
                  </button>
                  <span className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Landmark className="w-4 h-4" />
                  </span>
                </div>
              </div>
              <h3 className={`text-3xl font-extrabold tracking-tight mt-4 font-mono ${currentBankBalance < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {formatCurrency(currentBankBalance)}
              </h3>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-700 dark:text-zinc-300 font-semibold uppercase tracking-wider truncate">
                  {activeCompany?.bankName || (bankAccounts.length > 0 ? bankAccounts[0].bankName : "No Linked Bank A/C")}
                </p>
                {bankAccounts.length > 1 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded">
                    +{bankAccounts.length - 1} more
                  </span>
                )}
              </div>
              {activeCompany?.bankAccountNo && (
                <p className="text-[9px] text-gray-500 dark:text-zinc-500 font-mono">
                  A/C: {activeCompany.bankAccountNo} • IFSC: {activeCompany.bankIfsc || 'N/A'}
                </p>
              )}
              <p className="text-[10px] text-gray-500 dark:text-zinc-500 leading-normal">
                Digital receipts and payments via UPI, Net Banking, and Bank Transfers.
              </p>
            </div>
          </div>

        </div>

        {/* Real-time statistics logs (Shown conditionally) */}
        {showHistory && (
          <div className="mt-6 pt-6 w-full border-t border-gray-100 dark:border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            
            {/* Capital Log */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                Capital Investment List
              </h3>
              {capitalInvestments.length === 0 ? (
                <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 text-center text-xs text-gray-500 dark:text-zinc-500">
                  No capital investments registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black/10">
                  <table className="w-full text-xs text-left text-gray-700 dark:text-zinc-300">
                    <thead className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-black/30 border-b border-gray-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">Investor</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Cash / Bank (Allocation)</th>
                        <th className="py-2.5 px-3 text-right">Total Amount</th>
                        <th className="py-2.5 px-3 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                      {capitalInvestments.map((cap) => (
                        <tr key={cap.investmentId} className="hover:bg-gray-50 dark:hover:bg-zinc-800/10">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-gray-800 dark:text-zinc-200">{cap.partnerName}</div>
                            <div className="text-[10px] text-gray-500 dark:text-zinc-500 truncate max-w-[150px]">{cap.description}</div>
                          </td>
                          <td className="py-2 px-3 font-mono text-gray-500 dark:text-zinc-400">{cap.date}</td>
                          <td className="py-2 px-3 text-right text-[10px] text-gray-500 dark:text-zinc-400">
                            <div>Cash: {formatCurrency(cap.cashAmount || 0)}</div>
                            <div>Bank: {formatCurrency(cap.bankAmount || 0)}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(cap.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleCapitalDelete(cap.investmentId)}
                              className="p-1 hover:text-red-500 transition-colors text-gray-400 dark:text-zinc-500 cursor-pointer"
                              title="Delete Investment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Contra Transfers Log */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />
                Contra Transfers List
              </h3>
              {contraTransfers.length === 0 ? (
                <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 text-center text-xs text-gray-500 dark:text-zinc-500">
                  No contra transfers registered.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black/10">
                  <table className="w-full text-xs text-left text-gray-700 dark:text-zinc-300">
                    <thead className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-black/30 border-b border-gray-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                      {contraTransfers.map((cx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/10">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-gray-800 dark:text-zinc-200">
                              {cx.description?.replace("Internal Transfer:", "") || "Cash Bank Contra"}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase font-bold tracking-wider">
                              {cx.entityName}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-gray-500 dark:text-zinc-400">{cx.date}</td>
                          <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-zinc-200">{formatCurrency(cx.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Graphs / Analytics area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts dynamic line/area chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <h4 id="revenue-chart-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide mb-4">
            {t('monthlyRevenue')} ({new Date().getFullYear()})
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" className="dark:stroke-zinc-800/20" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis 
                  stroke="#94A3B8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val: number) => {
                    if (val === 0) return '0';
                    const symbol = countryConfig.currencySymbol || '₹';
                    if (val >= 100000) return `${symbol}${(val / 100000).toFixed(1)}L`;
                    if (val >= 1000) return `${symbol}${(val / 1000).toFixed(0)}K`;
                    return `${symbol}${val}`;
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    borderRadius: '8px', 
                    border: 'none', 
                    color: '#fff', 
                    fontSize: '12px' 
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Value"]}
                />
                <Bar dataKey="Sales" fill="#6366F1" radius={[4, 4, 0, 0]} name={`Sales Revenue (${countryConfig.currencySymbol})`} />
                <Bar dataKey="Purchases" fill="#F59E0B" radius={[4, 4, 0, 0]} name={`Purchases (${countryConfig.currencySymbol})`} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Demands Breakdown */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <h4 id="top-selling-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide mb-4">
              {t('topProducts')}
            </h4>
            
            {topSellingProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-xs">
                <Boxes className="w-10 h-10 stroke-1 mb-2 text-gray-300" />
                No sales information recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {topSellingProducts.map((item, idx) => {
                  const percentage = Math.min(100, Math.round((item.quantity / Math.max(...topSellingProducts.map(p => p.quantity))) * 100));
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-700 dark:text-zinc-300 truncate w-3/5">{item.name}</span>
                        <span className="font-medium text-gray-500 dark:text-zinc-400">{item.quantity} units sold</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: COLORS[idx % COLORS.length]
                          }}
                        />
                      </div>
                      <div className="flex justify-end text-[10px] text-gray-400">
                        <span>Earned: {formatCurrency(item.earnings)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-zinc-800 flex justify-between items-center text-xs text-gray-500">
            <span>Aggregated automatically</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">GST Compliant</span>
          </div>
        </div>

      </div>

      {/* Bottom Area: Recent Transactions Audit Logs & Low Stock detailed table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ledger Transactions Logs (Left 2 spans) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 id="recent-transactions-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
              {t('recentTx')}
            </h4>
            <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
              Sync: Real-time
            </span>
          </div>

          {recentTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-xs">
              <Clock className="w-10 h-10 stroke-1 mb-2 text-gray-300" />
              Your ledger matches and transactions will display here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-500">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800 text-gray-400 font-semibold uppercase text-[10px] bg-gray-50/50 dark:bg-zinc-800/10">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Entity Name</th>
                    <th className="py-2.5 px-3">Transaction Type</th>
                    <th className="py-2.5 px-3 text-right">Value ({countryConfig.currencySymbol})</th>
                    <th className="py-2.5 px-3 text-center">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/40">
                  {recentTx.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                      <td className="py-3 px-3 font-mono text-gray-400 text-[10px]">
                        {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-800 dark:text-zinc-250">
                        {tx.entityName}
                        <span className="block text-[9px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded w-max mt-0.5 font-mono">
                          Ref: {tx.referenceNo}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[9px] ${
                          tx.type === 'SALE' ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600' :
                          tx.type === 'PAYMENT_RECEIVED' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' :
                          tx.type === 'PURCHASE' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600' :
                          'bg-red-50 dark:bg-red-900/10 text-red-600'
                        }`}>
                          {tx.type === 'SALE' && <ArrowUpRight className="w-3 h-3" />}
                          {tx.type === 'PAYMENT_RECEIVED' && <ArrowUpRight className="w-3 h-3" />}
                          {tx.type === 'PURCHASE' && <ArrowDownLeft className="w-3 h-3" />}
                          {tx.type === 'PAYMENT_MADE' && <ArrowDownLeft className="w-3 h-3" />}
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                         <div className="flex justify-center">
                            <span className="text-[10px] text-gray-400 italic px-2 py-0.5 border border-gray-100 dark:border-zinc-800 rounded-lg">
                               Go to Reports
                            </span>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Watch Panel */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 id="low-stock-pane-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
                Stock Monitor
              </h4>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${lowStockProducts.length > 0 ? 'bg-rose-50 dark:bg-rose-900/10 text-rose-500 animate-pulse' : 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600'}`}>
                {lowStockProducts.length > 0 ? 'Shortage alert' : 'Sufficient'}
              </span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-xs">
                <Boxes className="w-10 h-10 stroke-1 mb-2 text-emerald-500" />
                Awesome, all items are well above active threshholds!
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {lowStockProducts.map((prod, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/5 border border-rose-100 dark:border-rose-900/10">
                    <div className="w-2/3">
                      <span className="font-semibold text-xs text-gray-800 dark:text-zinc-200 block truncate">{prod.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">HSN: {prod.hsnCode} / SKU: {prod.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-rose-500 text-xs block">{prod.currentStock} {prod.unit}</span>
                      <span className="text-[10px] text-gray-400">Min: {prod.lowStockThreshold}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-zinc-800 text-[11px] text-gray-400 text-center">
            Stock update changes live upon inlining Invoices/Bills.
          </div>
        </div>

      </div>

      {/* Outstanding Receivables & Payables Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Receivables (To Collect) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between transition-all hover:border-emerald-200 dark:hover:border-emerald-900/50">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                <ArrowDownLeft className="w-4 h-4" />
              </span>
              Outstanding Receivables
            </h4>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 font-medium">Money you need to collect from customers.</p>
            <div className="mt-4">
              <span className="text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                {formatCurrency(totalReceivables)}
              </span>
            </div>
          </div>
          <div className="hidden sm:block text-right self-end">
             <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
                {customers.filter(c => c.outstandingBalance > 0).length} Customers
             </span>
          </div>
        </div>

        {/* Payables (To Pay) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between transition-all hover:border-rose-200 dark:hover:border-rose-900/50">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </span>
              Outstanding Payables
            </h4>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 font-medium">Money you owe to your suppliers/vendors.</p>
            <div className="mt-4">
              <span className="text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                {formatCurrency(totalPayables)}
              </span>
            </div>
          </div>
          <div className="hidden sm:block text-right self-end">
             <span className="inline-flex items-center gap-1.5 text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
                {suppliers.filter(s => s.outstandingBalance > 0).length} Suppliers
             </span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: INTRODUCE CAPITAL */}
      {/* ------------------------------------------------------------- */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-gray-150 dark:border-zinc-805">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Coins className="w-5 h-5" />
                Introduce Capital
              </h3>
              <button 
                type="button"
                onClick={() => { setIsCapitalModalOpen(false); clearCapitalForm(); }}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-zinc-250 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCapitalSave} className="space-y-4 mt-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-400 block">Partner / Owner Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-400 block">Total Capital Amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 500000"
                    value={capitalAmount}
                    onChange={(e) => handleCapitalAmountChange(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-400 block">Investment Date</label>
                  <input
                    type="date"
                    required
                    value={investmentDate}
                    onChange={(e) => setInvestmentDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-955/20 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/20 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-amber-800 dark:text-amber-400 font-bold block">Cash & Bank Distribution</span>
                  <span className="text-[9px] bg-amber-200/55 dark:bg-amber-950/40 text-amber-700 px-2 py-0.5 rounded-md font-mono">Suggested 20:80 split</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-amber-900/70 dark:text-amber-300 block">Allocated to Cash Amount</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="Cash component"
                      value={cashAllocated}
                      onChange={(e) => setCashAllocated(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-amber-900/70 dark:text-amber-300 block">Allocated to Bank Amount</label>
                    <div className="w-full bg-amber-105/30 dark:bg-zinc-850/70 border border-amber-200 dark:border-amber-900/40 rounded-lg px-2.5 py-1.5 font-mono text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                      <span>{formatCurrency(Math.max(0, (parseFloat(capitalAmount) || 0) - (parseFloat(cashAllocated) || 0)))}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[9.5px] text-amber-700 dark:text-amber-500 block leading-normal pt-1">
                  💡 Not all capital is kept in the bank; allocate some for cash-in-hand operations.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-400 block">Remarks / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel joint startup cash contribution"
                  value={investmentNotes}
                  onChange={(e) => setInvestmentNotes(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsCapitalModalOpen(false); clearCapitalForm(); }}
                  className="w-1/2 py-2.5 text-xs font-bold border border-gray-200 dark:border-zinc-805 rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/15 transition-all cursor-pointer"
                >
                  Save Investment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CASH & BANK CONTRA TRANSFER */}
      {/* ------------------------------------------------------------- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-gray-150 dark:border-zinc-805">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                Cash-Bank Transfer & Contra
              </h3>
              <button 
                type="button"
                onClick={() => { setIsTransferModalOpen(false); clearTransferForm(); }}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-zinc-250 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSave} className="space-y-4 mt-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-gray-400 block">Transfer Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferType('CASH_TO_BANK')}
                    className={`p-3 rounded-xl border font-bold text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      transferType === 'CASH_TO_BANK'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-400'
                        : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-850 text-gray-500 hover:bg-gray-100/70'
                    }`}
                  >
                    <span className="text-[14px]">💵 ➔ 🏦</span>
                    <span>Deposit Cash to Bank</span>
                    <span className="text-[9px] font-medium opacity-80">(Cash to Bank)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferType('BANK_TO_CASH')}
                    className={`p-3 rounded-xl border font-bold text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      transferType === 'BANK_TO_CASH'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-955/20 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-850 text-gray-500 hover:bg-gray-100/70'
                    }`}
                  >
                    <span className="text-[14px]">🏦 ➔ 💵</span>
                    <span>Withdraw Cash from Bank</span>
                    <span className="text-[9px] font-medium opacity-80">(Bank to Cash)</span>
                  </button>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-955/35 p-3 rounded-xl border border-gray-150 dark:border-zinc-800/80 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-gray-450 block uppercase">Available source balance</span>
                  <span className="text-sm font-bold font-mono">
                    {transferType === 'CASH_TO_BANK' ? formatCurrency(currentCashBalance) : formatCurrency(currentBankBalance)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-450 block uppercase">Destination to increase</span>
                  <span className="text-xs text-gray-550 font-bold">
                    {transferType === 'CASH_TO_BANK' ? "🏦 Corporate Account" : "💼 Cash Drawer"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-400 block">Transfer Amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 10000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 font-mono focus:outline-hidden focus:border-indigo-505"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-400 block">Transfer Date</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 font-mono focus:outline-hidden focus:border-indigo-555"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-400 block">Description / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Excess showroom cash deposited into current account"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-indigo-505"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsTransferModalOpen(false); clearTransferForm(); }}
                  className="w-1/2 py-2.5 text-xs font-bold border border-gray-200 dark:border-zinc-805 rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 text-xs font-bold bg-zinc-800 dark:bg-zinc-200 hover:bg-zinc-750 text-white dark:text-zinc-950 rounded-xl shadow-lg transition-all border border-zinc-700 dark:border-zinc-300 cursor-pointer"
                >
                  Submit Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Account Creation Modal */}
      <BankAccountsModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
      />

    </div>
  );
};
