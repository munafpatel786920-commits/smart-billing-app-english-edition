/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Expense } from '../types';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  TrendingUp, 
  Wallet, 
  Sparkles, 
  FileSpreadsheet, 
  ArrowUpDown,
  BookOpen,
  DollarSign,
  PieChart,
  Grid
} from 'lucide-react';
import { jsPDF } from 'jspdf';

const EXPENSE_CATEGORIES = [
  { id: 'Office Rent', label: 'Office / Shop Rent', hi: 'Office Rent' },
  { id: 'Employee Salary', label: 'Employee Salaries & Wages', hi: 'Employee Salary' },
  { id: 'Electricity & Water', label: 'Electricity & Water Utilities', hi: 'Electricity & Water' },
  { id: 'Fuel & Transport', label: 'Fuel, Transport & Logistics', hi: 'Fuel & Transport' },
  { id: 'Office Stationery', label: 'Office Stationery & Printing', hi: 'Office Stationery' },
  { id: 'Refreshments & Food', label: 'Refreshments & Meal Allowance', hi: 'Refreshments & Food' },
  { id: 'Tax & Professional Fees', label: 'Taxes, Audit & Legal Fees', hi: 'Tax & Professional Fees' },
  { id: 'Miscellaneous', label: 'Miscellaneous Expenditures', hi: 'Miscellaneous' }
];

export function ExpensesView() {
  const { 
    expenses, 
    saveExpense, 
    deleteExpense, 
    activeCompany, 
    formatCurrency 
  } = useApp();

  // Search, Filter, Sort and Selection States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // New / Edit Expense Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Miscellaneous');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT'>('CASH');
  const [notes, setNotes] = useState('');

  // Form Validation and Submission Error states
  const [formError, setFormError] = useState('');

  // Calculate high quality metrics dynamically
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    
    // Set up start of this week (Sunday to Sunday or last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let total = 0;
    let today = 0;
    let monthly = 0;

    expenses.forEach((e) => {
      const eAmt = e.amount || 0;
      total += eAmt;

      const eDate = new Date(e.date);
      const eDateStr = e.date ? e.date.substring(0, 10) : '';

      if (eDateStr === todayStr) {
        today += eAmt;
      }
      if (eDate >= startOfMonth) {
        monthly += eAmt;
      }
    });

    return { total, today, monthly };
  }, [expenses]);

  // Format category stats with ratios
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      stats[cat.id] = 0;
    });

    let totalExpenseValue = 0;
    expenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      const val = e.amount || 0;
      stats[cat] = (stats[cat] || 0) + val;
      totalExpenseValue += val;
    });

    return Object.entries(stats).map(([catId, amount]) => {
      const categoryObj = EXPENSE_CATEGORIES.find(c => c.id === catId);
      const percentage = totalExpenseValue > 0 ? (amount / totalExpenseValue) * 1050 : 0; // for graph scaling
      const visualPercent = totalExpenseValue > 0 ? Math.round((amount / totalExpenseValue) * 100) : 0;
      return {
        id: catId,
        name: categoryObj ? categoryObj.label : catId,
        amount,
        percent: visualPercent
      };
    }).sort((a,b) => b.amount - a.amount);
  }, [expenses]);

  // Apply rich filters and search processing
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        // Keyword Search Alignment
        const keywords = `${e.title} ${e.category} ${e.notes || ''}`.toLowerCase();
        const matchesSearch = keywords.includes(searchTerm.toLowerCase());

        // Category Matching
        const matchesCategory = selectedCategory === 'ALL' || e.category === selectedCategory;

        // Payment Mode Matching
        const matchesPayment = selectedPaymentMode === 'ALL' || e.paymentMode === selectedPaymentMode;

        // Date Period Filtering
        let matchesDate = true;
        const recordDateObj = new Date(e.date);
        const recordDateStr = e.date ? e.date.substring(0, 10) : '';
        const todayStr = new Date().toISOString().substring(0, 10);

        if (dateFilter === 'TODAY') {
          matchesDate = recordDateStr === todayStr;
        } else if (dateFilter === 'WEEK') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          matchesDate = recordDateObj >= sevenDaysAgo;
        } else if (dateFilter === 'MONTH') {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          matchesDate = recordDateObj >= startOfMonth;
        } else if (dateFilter === 'CUSTOM') {
          const recordDateMs = new Date(recordDateStr).getTime();
          const startMs = customStartDate ? new Date(customStartDate).getTime() : 0;
          const endMs = customEndDate ? new Date(customEndDate).getTime() : Infinity;
          matchesDate = recordDateMs >= startMs && recordDateMs <= endMs;
        }

        return matchesSearch && matchesCategory && matchesPayment && matchesDate;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
        if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
        if (sortBy === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
        if (sortBy === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
        return 0;
      });
  }, [expenses, searchTerm, selectedCategory, selectedPaymentMode, dateFilter, customStartDate, customEndDate, sortBy]);

  // Handle Form Reset and edit trigger
  const handleOpenNewModal = () => {
    setEditExpenseId(null);
    setTitle('');
    setCategory('Miscellaneous');
    setAmount('');
    setDate(new Date().toISOString().substring(0, 10));
    setPaymentMode('CASH');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setEditExpenseId(exp.expenseId);
    setTitle(exp.title);
    setCategory(exp.category);
    setAmount(String(exp.amount));
    setDate(exp.date ? exp.date.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setPaymentMode(exp.paymentMode);
    setNotes(exp.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Please enter a descriptive title for this expense.');
      return;
    }
    const valAmt = parseFloat(amount);
    if (isNaN(valAmt) || valAmt <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }

    try {
      await saveExpense({
        ...(editExpenseId ? { expenseId: editExpenseId } : {}),
        title: title.trim(),
        category,
        amount: valAmt,
        date: new Date(date).toISOString(),
        paymentMode,
        notes: notes.trim()
      });
      setIsModalOpen(false);
    } catch (saveError) {
      console.error('Failed to preserve expense record:', saveError);
      setFormError('Internal storage sync issue, please retry.');
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Do you really want to delete this expense log?')) {
      try {
        await deleteExpense(id);
      } catch (err) {
        console.error('Failed to remove transaction record:', err);
      }
    }
  };

  // PROFESSIONAL PDF VOUCHER PRINTING with strict UPPER LEFT Logo Alignment!
  const handlePrintExpenseVoucher = (exp: Expense) => {
    const doc = new jsPDF();
    const lMargin = 15;
    let y = 14;

    // Header Stripe for aesthetic
    doc.setFillColor(30, 41, 59); // Slate color
    doc.rect(0, 0, 210, 8, 'F');

    const hasLogo = !!activeCompany?.logoUrl;
    const headerLeft = hasLogo ? 38 : lMargin;

    // BRAND LOGO IN TOP-LEFT IN COMPLIANCE WITH SYSTEM GOALS
    if (activeCompany?.logoUrl) {
      try {
        let format = 'PNG';
        if (activeCompany.logoUrl.includes('image/jpeg') || activeCompany.logoUrl.includes('image/jpg')) {
          format = 'JPEG';
        } else if (activeCompany.logoUrl.includes('image/webp')) {
          format = 'WEBP';
        }
        doc.addImage(activeCompany.logoUrl, format, lMargin, 11, 18, 18);
      } catch (logoErr) {
        console.warn('Failed to draw custom company logo in PDF header:', logoErr);
      }
    }

    // Title / Company Meta Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'Bharat GST Billing', headerLeft, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Expense Debit Voucher', headerLeft, y + 11);

    // Right-aligned Metadata (Voucher ID, Date)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('VOUCHER NO:', 140, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(exp.expenseId ? exp.expenseId.toUpperCase() : 'N/A', 170, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('DATE:', 140, y + 11);
    doc.setFont('helvetica', 'normal');
    const formattedDate = new Date(exp.date).toLocaleDateString();
    doc.text(formattedDate, 170, y + 11);

    y += 24;
    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);

    // Business Identity Cards
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Company Details:', lMargin, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`GSTIN: ${activeCompany?.gstin || 'N/A'}`, lMargin, y + 5);
    doc.text(`Address: ${activeCompany?.address || 'Corporate Billing Office'}`, lMargin, y + 10);
    if(activeCompany?.phone) doc.text(`Phone: ${activeCompany.phone}`, lMargin, y + 15);

    // Debit details container box
    y += 22;
    doc.setFillColor(248, 250, 252);
    doc.rect(lMargin, y, 180, 55, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(lMargin, y, 180, 55, 'D');

    // Title / Description
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Particulars:', lMargin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(exp.title, lMargin + 5, y + 5);

    // Category
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Category:', lMargin + 5, y + 15);
    doc.setFont('helvetica', 'normal');
    const catLabel = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
    doc.text(catLabel?.label || exp.category, lMargin + 5, y + 20);

    // Settlement Mode
    doc.setFont('helvetica', 'bold');
    doc.text('Paid Via:', lMargin + 5, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.text(exp.paymentMode, lMargin + 5, y + 35);

    // Extra Notes
    if (exp.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Remarks:', lMargin + 5, y + 43);
      doc.setFont('helvetica', 'normal');
      doc.text(exp.notes, lMargin + 5, y + 48);
    }

    // Right settlement panel (DEBIT AMOUNT)
    doc.setFillColor(30, 41, 59);
    doc.rect(130, y - 8, 65, 55, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('DEBIT STATEMENT', 140, y);
    doc.text('TOTAL PAID AMOUNT', 140, y + 15);
    
    doc.setFontSize(18);
    doc.text(`Rs. ${exp.amount}`, 140, y + 26);
    
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text('All rates of internal taxes', 140, y + 38);
    doc.text('are settled separately', 140, y + 42);

    // Signatures / Footers
    y += 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    
    // Draw signature line
    doc.setDrawColor(148, 163, 184);
    doc.line(lMargin, y, lMargin + 45, y);
    doc.line(145, y, 190, y);

    doc.text('Receiver Signature', lMargin, y + 5);
    doc.text('Authorized Signatory', 145, y + 5);

    // PDF Metadata / Timestamp
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, lMargin, y + 25);
    doc.text('Systems Integrated Multi-Accounting System', 145, y + 25);

    doc.save(`Voucher_${exp.expenseId || 'EXP'}.pdf`);
  };

  // EXPORT COMPLETE EXPENSES LOG PDF WITH UPPER LEFT LOGO
  const handlePrintAllExpensesReport = () => {
    const doc = new jsPDF();
    const lMargin = 15;
    let y = 14;

    // Header Stripe for aesthetic
    doc.setFillColor(30, 41, 59); // Slate color
    doc.rect(0, 0, 210, 8, 'F');

    const hasLogo = !activeCompany?.logoUrl;
    const headerLeft = activeCompany?.logoUrl ? 38 : lMargin;

    // LOGO IN UPPER LEFT TO ENSURE AESTHETIC COMPLIANCE
    if (activeCompany?.logoUrl) {
      try {
        let format = 'PNG';
        if (activeCompany.logoUrl.includes('image/jpeg') || activeCompany.logoUrl.includes('image/jpg')) {
          format = 'JPEG';
        } else if (activeCompany.logoUrl.includes('image/webp')) {
          format = 'WEBP';
        }
        doc.addImage(activeCompany.logoUrl, format, lMargin, 11, 18, 18);
      } catch (logoErr) {
        console.warn('Failed to draw custom company logo in PDF header:', logoErr);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'Bharat GST Billing', headerLeft, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Comprehensive Expenses Ledger Statement', headerLeft, y + 11);

    y += 24;
    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('REPORT FILTER SETTINGS:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Category: ${selectedCategory}, Payment: ${selectedPaymentMode}, Date Range: ${dateFilter}`, lMargin, y + 5);

    // Draw Table Headers
    y += 15;
    doc.setFillColor(241, 245, 249);
    doc.rect(lMargin, y, 180, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text('Date', lMargin + 2, y + 5);
    doc.text('Expense Title', lMargin + 25, y + 5);
    doc.text('Category', lMargin + 85, y + 5);
    doc.text('Mode', lMargin + 135, y + 5);
    doc.text('Amount (Rs)', 190, y + 5, { align: 'right' });

    doc.line(lMargin, y + 8, 195, y + 8);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    let expenseSumTotal = 0;

    filteredExpenses.forEach((exp, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFillColor(241, 245, 249);
        doc.rect(lMargin, y, 180, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Date', lMargin + 2, y + 5);
        doc.text('Expense Title', lMargin + 25, y + 5);
        doc.text('Category', lMargin + 85, y + 5);
        doc.text('Mode', lMargin + 135, y + 5);
        doc.text('Amount (Rs)', 190, y + 5, { align: 'right' });
        doc.line(lMargin, y + 8, 195, y + 8);
        y += 8;
        doc.setFont('helvetica', 'normal');
      }

      const formattedDt = new Date(exp.date).toLocaleDateString();
      const localizedTitle = exp.title.length > 28 ? `${exp.title.substring(0, 26)}...` : exp.title;
      const catLabel = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
      const localizedCategory = catLabel ? catLabel.label : exp.category;

      doc.text(formattedDt, lMargin + 2, y + 5);
      doc.text(localizedTitle, lMargin + 25, y + 5);
      doc.text(localizedCategory, lMargin + 85, y + 5);
      doc.text(exp.paymentMode, lMargin + 135, y + 5);
      doc.text(`Rs. ${exp.amount}`, 190, y + 5, { align: 'right' });

      expenseSumTotal += exp.amount;
      
      doc.setDrawColor(241, 245, 249);
      doc.line(lMargin, y + 8, 195, y + 8);
      y += 8;
    });

    // Drawing summary row at end
    doc.setFillColor(248, 250, 252);
    doc.rect(lMargin, y + 2, 180, 10, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(lMargin, y + 2, 180, 10, 'D');

    doc.setFont('helvetica', 'bold');
    doc.text('Total Filtered Expenses Sum:', lMargin + 6, y + 8);
    doc.setFontSize(11);
    doc.text(`Rs. ${expenseSumTotal}`, 190, y + 8, { align: 'right' });

    doc.save('Company_Filtered_Expenses.pdf');
  };

  return (
    <div className="space-y-6">
      {/* Upper header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Daily Expenses
            </h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
            Record, audit and manage internal office and trade overhead payments on a daily basis.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handlePrintAllExpensesReport}
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 font-bold transition flex items-center justify-center gap-2 text-sm"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span>Export Report (PDF)</span>
          </button>
          <button
            onClick={handleOpenNewModal}
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-red-600 dark:bg-red-700 hover:bg-red-500 dark:hover:bg-red-600 text-white font-bold transition flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Visual Analytics Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Metric Total Expenses */}
        <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-2xl p-6 shadow-md border border-zinc-850 flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp className="w-24 h-24 text-white" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Total Ledger Overheads
              </p>
            </div>
            <span className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </span>
          </div>
          <div className="mt-6">
            <h3 className="text-3xl font-black tracking-tight">{formatCurrency(metrics.total)}</h3>
            <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
              <span>Overall cumulative expenses registered on {activeCompany?.name || 'this company'}</span>
            </p>
          </div>
        </div>

        {/* Metric Today Expenses */}
        <div className="bg-white dark:bg-zinc-90 w-full border border-gray-150 dark:border-zinc-850 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Today's Spent Log
              </p>
            </div>
            <span className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <Calendar className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-6">
            <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              {formatCurrency(metrics.today)}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1 font-medium dark:text-zinc-400">
              Immediate debit logs captured during active cycle of today
            </p>
          </div>
        </div>

        {/* Metric Monthly Expenses */}
        <div className="bg-white dark:bg-zinc-900 w-full border border-gray-150 dark:border-zinc-850 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Current month total
              </p>
            </div>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Wallet className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-6">
            <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              {formatCurrency(metrics.monthly)}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1 font-medium dark:text-zinc-400">
              Sum of bills validated in current calendar month sequence
            </p>
          </div>
        </div>

      </div>

      {/* Grid distribution visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Category breakdown bar percentages */}
        <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              Expense by Category
            </h2>
          </div>
          
          <div className="space-y-4">
            {categoryStats.map((stat) => (
              <div key={stat.id} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <div className="flex flex-col">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">{stat.name}</span>
                  </div>
                  <span className="text-zinc-800 dark:text-zinc-200 mt-0.5 font-mono">
                    {formatCurrency(stat.amount)} ({stat.percent}%)
                  </span>
                </div>
                
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-red-500 dark:bg-red-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, stat.percent)}%` }}
                  ></div>
                </div>
              </div>
            ))}
            
            {expenses.length === 0 && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-8">
                No active expenses recorded to populate division charts.
              </p>
            )}
          </div>
        </div>

        {/* Search, filters & main Expense Log Ledger */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-850 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-zinc-500" />
                <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Payment Ledger Registry
                </h2>
              </div>
              <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800/40 rounded-lg px-2.5 py-1">
                Showing {filteredExpenses.length} of {expenses.length} records
              </div>
            </div>

            {/* Powerful Multi-Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6 bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800/40 rounded-xl p-4">
              
              {/* Keywords Search */}
              <div className="relative flex flex-col gap-1 sm:col-span-1 md:col-span-2">
                <label className="text-[10px] font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                  Search Keyword
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-zinc-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search titles, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white font-medium"
                >
                  <option value="ALL">All Categories</option>
                  {EXPENSE_CATEGORIES.map(e => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode selector */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                  Payment Mode
                </label>
                <select
                  value={selectedPaymentMode}
                  onChange={(e) => setSelectedPaymentMode(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white font-medium"
                >
                  <option value="ALL">All Payments</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">Bank/NEFT Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>

              {/* Dates Period Select */}
              <div className="flex flex-col gap-1 sm:col-span-1 md:col-span-2">
                <label className="text-[10px] font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                  Date Range
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white font-medium"
                >
                  <option value="ALL">All Time List</option>
                  <option value="TODAY">Today's Debits</option>
                  <option value="WEEK">Last 7 Days</option>
                  <option value="MONTH">This Month Logs</option>
                  <option value="CUSTOM">Custom Date Period</option>
                </select>
              </div>

              {/* Custom Date Inputs */}
              {dateFilter === 'CUSTOM' && (
                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-2 mt-1 sm:mt-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">From</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full p-1 border border-zinc-200 dark:border-zinc-800 rounded text-xs bg-white dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">To</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full p-1 border border-zinc-200 dark:border-zinc-800 rounded text-xs bg-white dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Sorting options */}
              <div className="flex flex-col gap-1 sm:col-span-1 md:col-span-2">
                <label className="text-[10px] font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                  Sorting Hierarchy
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white font-medium"
                >
                  <option value="date_desc">Latest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="amount_desc">Highest Cost</option>
                  <option value="amount_asc">Lowest Cost</option>
                </select>
              </div>

            </div>

            {/* Custom Interactive Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-850/60 text-zinc-500 dark:text-zinc-400 text-xs font-black border-b border-zinc-200 dark:border-zinc-850 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Title Particular</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Credit Amount</th>
                    <th className="py-3 px-4 text-center">Receipts</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
                  {filteredExpenses.map((exp) => {
                    const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                    return (
                      <tr 
                        key={exp.expenseId} 
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-850/50 bg-white dark:bg-zinc-900 dark:text-zinc-100 transition-all duration-150"
                      >
                        <td className="py-3 px-4 font-semibold text-zinc-500 dark:text-zinc-400 font-mono whitespace-nowrap">
                          {exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="font-bold text-zinc-800 dark:text-white leading-relaxed">{exp.title}</p>
                          {exp.notes && (
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-0.5 leading-snug">
                              Note: {exp.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">
                              {catObj ? catObj.label : exp.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black tracking-wide ${
                            exp.paymentMode === 'CASH' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                            exp.paymentMode === 'UPI' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400' :
                            exp.paymentMode === 'BANK_TRANSFER' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' :
                            'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                          }`}>
                            {exp.paymentMode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-zinc-900 dark:text-white font-mono text-sm whitespace-nowrap">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handlePrintExpenseVoucher(exp)}
                            title="Generate Physical Debit Voucher PDF"
                            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-850 hover:bg-zinc-100 hover:text-zinc-900 transition-all shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex justify-end items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(exp)}
                              className="p-1.5 rounded bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 text-zinc-500 dark:text-zinc-300 hover:bg-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                              title="Edit record"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(exp.expenseId)}
                              className="p-1.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 transition"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400 dark:text-zinc-500 font-bold text-sm">
                        No financial records found matching your active range query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

      {/* NEW / EDIT EXPENSE INTERACTIVE DRAWER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal custom Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black tracking-wide uppercase">
                  {editExpenseId ? 'Update Expense Details' : 'Record New Expense'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal custom Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-xs rounded-r-lg font-semibold leading-relaxed">
                  {formError}
                </div>
              )}

              {/* Title / Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>Particular / Title of Expense *</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bought files and staplers for billing office"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white"
                  required
                />
              </div>

              {/* Category, Date & Amount Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Category Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex justify-between">
                    <span>Category *</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white font-semibold"
                  >
                    {EXPENSE_CATEGORIES.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </div>

                {/* Amount field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex justify-between">
                    <span>Amount (Rs.) *</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-bold font-mono focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white"
                    required
                  />
                </div>

                {/* Date Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex justify-between">
                    <span>Transaction Date *</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white"
                    required
                  />
                </div>

                {/* Payment Mode Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex justify-between">
                    <span>Settled Via *</span>
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white"
                  >
                    <option value="CASH">CASH</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER (IMPS/NEFT)</option>
                    <option value="CREDIT">CREDIT</option>
                  </select>
                </div>

              </div>

              {/* Extra Notes / Remarks */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex justify-between">
                  <span>Remarks / Notes (Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Bought reference number, merchant invoice info etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-white"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-150 dark:border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-red-600 dark:bg-red-700 hover:bg-red-500 dark:hover:bg-red-600 text-white font-black text-xs shadow-sm transition-all"
                >
                  Save Record
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

// Icon placeholder helper for modal header close
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={props.className}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
