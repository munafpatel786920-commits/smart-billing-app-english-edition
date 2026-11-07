/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { statesOfIndia } from '../translations';
import { 
  Plus, 
  Trash2, 
  UserPlus, 
  ShoppingBag, 
  Save, 
  FileText,
  FileCheck,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Search,
  Filter,
  DollarSign,
  X,
  Check,
  PackagePlus
} from 'lucide-react';
import { PurchaseItem, PurchaseBill, Supplier, Product } from '../types';

export const PurchaseBillingView: React.FC = () => {
  const { 
    activeCompany, 
    products, 
    suppliers,
    purchases,
    savePurchaseEntry, 
    updatePurchasePaymentStatus,
    deletePurchaseEntry,
    savePurchaseReturn,
    saveSupplier,
    saveProduct,
    formatCurrency,
    countryConfig,
    t 
  } = useApp();

  // Mode state switched between standard entry and debit note returns
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [refBillNo, setRefBillNo] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged Goods');

  // Selected State for Purchase Entry
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [items, setItems] = useState<Omit<PurchaseItem, 'total'>[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT'>('CASH');
  const [billNumber, setBillNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Search & Filter for Recent Purchase Bills List
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL');

  // Payment record modal for existing purchase bill
  const [payModalPurchase, setPayModalPurchase] = useState<PurchaseBill | null>(null);
  const [payInputAmount, setPayInputAmount] = useState<string>('');
  const [payInputMode, setPayInputMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT'>('CASH');

  // Inline forms
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppState, setSuppState] = useState(activeCompany?.state || 'Maharashtra');
  const [suppGstin, setSuppGstin] = useState('');

  // New Product Modal State (From Purchase Grid Table)
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('General');
  const [newProdHsn, setNewProdHsn] = useState('');
  const [newProdUnit, setNewProdUnit] = useState<'PCS' | 'KG' | 'LITER' | 'BOX' | 'MTR' | 'SET'>('PCS');
  const [newProdPurchasePrice, setNewProdPurchasePrice] = useState<string>('');
  const [newProdSellingPrice, setNewProdSellingPrice] = useState<string>('');
  const [newProdTaxRate, setNewProdTaxRate] = useState<number>(countryConfig.defaultTaxRate ?? 18);
  const [newProdOpeningStock, setNewProdOpeningStock] = useState<string>('0');
  const [newProdSku, setNewProdSku] = useState('');
  const [prodFormError, setProdFormError] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const activeSupplier = useMemo(() => {
    return suppliers.find(s => s.supplierId === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  // Check GST calculations
  const isInterstate = useMemo(() => {
    if (!activeCompany || !activeSupplier) return false;
    const suppState = (activeSupplier.state || '').toLowerCase();
    const compAddress = (activeCompany.address || '').toLowerCase();
    const compState = (activeCompany.state || '').toLowerCase();
    return compAddress.includes(suppState) === false && (compState !== suppState);
  }, [activeCompany, activeSupplier]);

  // Totals calculations
  const totals = useMemo(() => {
    let subTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let discountTotal = 0;

    const computedItems: PurchaseItem[] = items.map(item => {
      const lineGross = parseFloat((item.price * item.qty).toFixed(2));
      let itemDisc = 0;
      if (item.discountType === 'PERCENT') {
        const pct = Math.min(100, Math.max(0, item.discountPercent || 0));
        itemDisc = parseFloat(((lineGross * pct) / 100).toFixed(2));
      } else {
        itemDisc = parseFloat(Math.min(lineGross, Math.max(0, item.discount || 0)).toFixed(2));
      }
      discountTotal += itemDisc;

      const lineSub = lineGross - itemDisc;
      const cleanLineSub = Math.max(0, lineSub);
      subTotal += cleanLineSub;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (countryConfig.taxSystem === 'dual_gst') {
        if (isInterstate) {
          igst = parseFloat(((cleanLineSub * item.gstRate) / 100).toFixed(2));
          igstTotal += igst;
        } else {
          const halfRate = item.gstRate / 2;
          cgst = parseFloat(((cleanLineSub * halfRate) / 100).toFixed(2));
          sgst = parseFloat(((cleanLineSub * halfRate) / 100).toFixed(2));
          cgstTotal += cgst;
          sgstTotal += sgst;
        }
      } else if (countryConfig.taxSystem === 'canadian_gst_pst') {
        if (item.gstRate === 13 || item.gstRate === 15) {
          igst = parseFloat(((cleanLineSub * item.gstRate) / 100).toFixed(2));
          igstTotal += igst;
        } else {
          cgst = parseFloat(((cleanLineSub * 5) / 100).toFixed(2));
          const pstRate = Math.max(0, item.gstRate - 5);
          sgst = parseFloat(((cleanLineSub * pstRate) / 100).toFixed(2));
          cgstTotal += cgst;
          sgstTotal += sgst;
        }
      } else {
        // Single VAT or US Sales Tax:
        const taxVal = parseFloat(((cleanLineSub * item.gstRate) / 100).toFixed(2));
        igst = taxVal;
        igstTotal += taxVal;
      }

      const total = parseFloat((cleanLineSub + cgst + sgst + igst).toFixed(2));

      return {
        ...item,
        discount: itemDisc,
        discountPercent: item.discountType === 'PERCENT'
          ? (item.discountPercent || 0)
          : (lineGross > 0 ? parseFloat(((itemDisc / lineGross) * 100).toFixed(2)) : 0),
        discountType: item.discountType || 'FLAT',
        cgst,
        sgst,
        igst,
        total
      };
    });

    const grandTotal = parseFloat((subTotal + cgstTotal + sgstTotal + igstTotal).toFixed(2));

    return {
      items: computedItems,
      subTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      discountTotal,
      grandTotal
    };
  }, [items, isInterstate, countryConfig]);

  // Product creation directly from Purchase Grid Table
  const handleOpenNewProductModal = () => {
    setNewProdName('');
    setNewProdCategory('General');
    setNewProdHsn('');
    setNewProdUnit('PCS');
    setNewProdPurchasePrice('');
    setNewProdSellingPrice('');
    setNewProdTaxRate(countryConfig.defaultTaxRate ?? 18);
    setNewProdOpeningStock('0');
    setNewProdSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setProdFormError('');
    setShowAddProductModal(true);
  };

  const handleCreateAndAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      setProdFormError('Please enter a product name');
      return;
    }

    const pPrice = parseFloat(newProdPurchasePrice) || 0;
    const sPrice = parseFloat(newProdSellingPrice) || 0;
    const stockQty = Math.max(0, parseFloat(newProdOpeningStock) || 0);
    const taxRate = parseFloat(newProdTaxRate as any) || 0;
    const newId = 'prod_' + Date.now();
    const generatedSku = newProdSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const hsnVal = newProdHsn.trim() || '9999';

    setIsSavingProduct(true);
    setProdFormError('');

    try {
      const newProduct: Product = {
        productId: newId,
        name: newProdName.trim(),
        category: newProdCategory.trim() || 'General',
        sku: generatedSku,
        hsnCode: hsnVal,
        unit: newProdUnit,
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        gstRate: taxRate,
        openingStock: stockQty,
        currentStock: stockQty,
        lowStockThreshold: 5,
      };

      await saveProduct(newProduct);

      // Immediately append as line item into current purchase bill items
      setItems(prev => [
        ...prev,
        {
          productId: newId,
          name: newProduct.name,
          hsnCode: newProduct.hsnCode,
          qty: 1,
          unit: newProduct.unit,
          price: newProduct.purchasePrice,
          discount: 0,
          discountPercent: 0,
          discountType: 'FLAT',
          gstRate: newProduct.gstRate,
          cgst: 0,
          sgst: 0,
          igst: 0
        }
      ]);

      setShowAddProductModal(false);
    } catch (err: any) {
      setProdFormError(err.message || 'Failed to save product');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleAddItem = (productId: string) => {
    const prod = products.find(p => p.productId === productId);
    if (!prod) return;

    const existingIdx = items.findIndex(item => item.productId === productId);
    if (existingIdx > -1) {
      const copy = [...items];
      copy[existingIdx].qty += 1;
      setItems(copy);
    } else {
      setItems([
        ...items,
        {
          productId: prod.productId,
          name: prod.name,
          hsnCode: prod.hsnCode,
          qty: 1,
          unit: prod.unit,
          price: prod.purchasePrice, // Default to purchase price
          discount: 0,
          gstRate: prod.gstRate,
          cgst: 0,
          sgst: 0,
          igst: 0
        }
      ]);
    }
  };

  const handleUpdateItemQty = (index: number, val: number) => {
    const copy = [...items];
    copy[index].qty = Math.max(1, val);
    setItems(copy);
  };

  const handleUpdateItemDiscount = (index: number, val: number) => {
    const copy = [...items];
    const item = copy[index];
    const lineGross = item.price * item.qty;
    if (item.discountType === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, val));
      item.discountPercent = pct;
      item.discount = parseFloat(((lineGross * pct) / 100).toFixed(2));
    } else {
      const flat = Math.min(lineGross, Math.max(0, val));
      item.discount = flat;
      item.discountPercent = lineGross > 0 ? parseFloat(((flat / lineGross) * 100).toFixed(2)) : 0;
    }
    setItems(copy);
  };

  const handleToggleDiscountType = (index: number, forceType?: 'FLAT' | 'PERCENT') => {
    const copy = [...items];
    const item = copy[index];
    const lineGross = item.price * item.qty;
    const targetType = forceType || (item.discountType === 'PERCENT' ? 'FLAT' : 'PERCENT');
    item.discountType = targetType;
    if (targetType === 'PERCENT') {
      item.discountPercent = lineGross > 0 ? parseFloat(((item.discount / lineGross) * 100).toFixed(2)) : (item.discountPercent || 0);
    }
    setItems(copy);
  };

  const handleUpdateItemPrice = (index: number, val: number) => {
    const copy = [...items];
    copy[index].price = Math.max(0, val);
    setItems(copy);
  };

  const handleUpdateItemTaxRate = (index: number, val: number) => {
    const copy = [...items];
    copy[index].gstRate = Math.max(0, val);
    setItems(copy);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName) return;
    try {
      const inlineId = 'supp_' + Math.random().toString(36).substr(2, 9);
      await saveSupplier({
        supplierId: inlineId,
        name: suppName,
        phone: suppPhone,
        email: suppEmail,
        address: suppAddress,
        state: suppState,
        gstin: suppGstin,
        openingBalance: 0,
        outstandingBalance: 0
      });
      setSelectedSupplierId(inlineId);
      
      setSuppName('');
      setSuppPhone('');
      setSuppEmail('');
      setSuppAddress('');
      setSuppGstin('');
      setShowAddSupplier(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePurchase = async () => {
    if (!activeCompany) {
      alert('Please select or create a company first.');
      return;
    }
    if (!selectedSupplierId) {
      alert('Select Supplier profile first.');
      return;
    }
    if (!billNumber && !isReturnMode) {
      alert('Supplier Bill/Invoice Number is mandatory.');
      return;
    }
    if (items.length === 0) {
      alert('Select at least one product row to record.');
      return;
    }

    try {
      if (isReturnMode) {
        await savePurchaseReturn({
          referenceBillNo: refBillNo,
          date: new Date(purchaseDate).toISOString(),
          supplierId: selectedSupplierId,
          supplierName: activeSupplier?.name || '',
          supplierGstin: activeSupplier?.gstin || '',
          items: totals.items,
          subTotal: totals.subTotal,
          cgstTotal: totals.cgstTotal,
          sgstTotal: totals.sgstTotal,
          igstTotal: totals.igstTotal,
          grandTotal: totals.grandTotal,
          reason: returnReason,
          financialYear: activeCompany?.financialYear || '2026-2027'
        });

        alert('Debit Note (Purchase Return) registered and inventory adjusted!');
        setItems([]);
        setSelectedSupplierId('');
        setPaidAmount(0);
        setBillNumber('');
        setRefBillNo('');
        setReturnReason('Damaged Goods');
        return;
      }

      await savePurchaseEntry({
        billNumber: billNumber,
        date: new Date(purchaseDate).toISOString(),
        supplierId: selectedSupplierId,
        supplierName: activeSupplier?.name || '',
        supplierGstin: activeSupplier?.gstin || '',
        items: totals.items,
        subTotal: totals.subTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
        paidAmount: paidAmount,
        paymentStatus: (paidAmount >= totals.grandTotal && totals.grandTotal > 0) 
          ? 'PAID' 
          : (paidAmount > 0) 
            ? 'PARTIAL' 
            : 'UNPAID',
        paymentMode: paymentMode
      });

      alert('Purchase recorded. Inventory updated successfully!');
      setItems([]);
      setSelectedSupplierId('');
      setPaidAmount(0);
      setBillNumber('');
      setPaymentMode('CASH');
    } catch (err) {
      alert('Failed to save purchase. Check role-based security settings.');
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalPurchase) return;

    const amt = parseFloat(payInputAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      await updatePurchasePaymentStatus(payModalPurchase.purchaseId, amt, payInputMode);
      alert(`Payment of ${formatCurrency(amt)} recorded successfully for Bill ${payModalPurchase.billNumber}!`);
      setPayModalPurchase(null);
      setPayInputAmount('');
    } catch (err) {
      alert('Failed to record payment. Please try again.');
    }
  };

  const filteredPurchaseList = useMemo(() => {
    if (!purchases || !Array.isArray(purchases)) return [];
    return purchases.filter(p => {
      const q = purchaseSearch.toLowerCase().trim();
      const matchesSearch = !q || p.billNumber?.toLowerCase().includes(q) || p.supplierName?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || (p.paymentStatus || 'UNPAID') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchases, purchaseSearch, statusFilter]);

  return (
    <div className="space-y-6">

      {/* Mode Switch Tab Bar */}
      <div className="flex border-b border-gray-150/45 dark:border-zinc-800 gap-2 overflow-x-auto pb-0.5 print:hidden">
        <button
          id="btn-purchase-invoice-mode"
          type="button"
          onClick={() => setIsReturnMode(false)}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap hover:cursor-pointer flex items-center gap-1.5 ${
            !isReturnMode
              ? `border-blue-600 text-blue-600 bg-blue-50/10` 
              : 'border-transparent text-gray-400 hover:text-gray-500'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Standard Purchase Bill</span>
        </button>
        <button
          id="btn-purchase-return-mode"
          type="button"
          onClick={() => setIsReturnMode(true)}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap hover:cursor-pointer flex items-center gap-1.5 ${
            isReturnMode
              ? `border-fuchsia-500 text-fuchsia-500 bg-fuchsia-50/10` 
              : 'border-transparent text-gray-400 hover:text-gray-500'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Purchase Return / Debit Note (Debit Supplier)</span>
        </button>
      </div>

      {/* Top control split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Supplier Select/Invoice Info (2 Cold spans) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 id="supp-panel-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
              Purchase Invoice & Supplier Account
            </h4>
            <button
              id="btn-trigger-add-supplier-modal"
              onClick={() => setShowAddSupplier(!showAddSupplier)}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline hover:cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Quick Add Supplier
            </button>
          </div>

          {/* Quick Dynamic inline add supplier */}
          {showAddSupplier && (
            <form onSubmit={handleCreateSupplier} className="p-4 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-205 dark:border-zinc-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Supplier Firm Name *</label>
                  <input
                    id="inp-inline-supp-name"
                    type="text"
                    required
                    value={suppName}
                    onChange={(e) => setSuppName(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Mobile Phone</label>
                  <input
                    id="inp-inline-supp-phone"
                    type="text"
                    value={suppPhone}
                    onChange={(e) => setSuppPhone(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Email ID</label>
                  <input
                    id="inp-inline-supp-email"
                    type="email"
                    value={suppEmail}
                    onChange={(e) => setSuppEmail(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Supplier State</label>
                  <select
                    id="sel-inline-supp-state"
                    value={suppState}
                    onChange={(e) => setSuppState(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  >
                    {statesOfIndia.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">15-Digit Indian GSTIN</label>
                  <input
                    id="inp-inline-supp-gstin"
                    type="text"
                    value={suppGstin}
                    onChange={(e) => setSuppGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AAAAP1234A1Z1"
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded font-mono text-blue-600"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <textarea
                  id="txa-inline-supp-address"
                  placeholder="Supplier detailed firm address"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded h-10"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  id="btn-cancel-inline-supp"
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-inline-supp"
                  type="submit"
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Supplier select */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                Choose Supplier firm *
              </label>
              <select
                id="sel-purchase-supplier"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full text-sm p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-850 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="">-- Choose Vendor/Supplier --</option>
                {suppliers.map((v, idx) => (
                  <option key={idx} value={v.supplierId}>
                    {v.name} {v.gstin ? `(${v.gstin})` : '(No GST)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Bill Number */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                {isReturnMode ? 'Debit Note Reference' : 'Supplier Invoice No. *'}
              </label>
              <input
                id="inp-purchase-bill-no"
                type="text"
                required={!isReturnMode}
                value={isReturnMode ? refBillNo : billNumber}
                onChange={(e) => isReturnMode ? setRefBillNo(e.target.value.toUpperCase()) : setBillNumber(e.target.value.toUpperCase())}
                placeholder={isReturnMode ? "e.g. PR-REF" : "Bill No."}
                className="w-full text-sm p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-850 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            
            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                {isReturnMode ? 'Debit Note Date' : 'Purchase Date'}
              </label>
              <input
                id="inp-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full text-sm p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-850 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            {activeSupplier && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-900/5 rounded-xl border border-amber-100/40 dark:border-amber-900/10 text-xs flex flex-col justify-center text-gray-600 dark:text-zinc-300">
                <span className="font-semibold text-gray-700">Vendor State: {activeSupplier.state}</span>
                {activeSupplier.gstin && <p className="font-mono text-amber-600 mt-1">{countryConfig.taxName || 'GSTIN'}: {activeSupplier.gstin}</p>}
                <p className="mt-1"> Outstanding balance: {formatCurrency(activeSupplier.outstandingBalance)}</p>
              </div>
            )}

          </div>

          {/* Conditional Purchase Return details */}
          {isReturnMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-fuchsia-50/20 dark:bg-zinc-800/20 rounded-xl border border-fuchsia-100/30 dark:border-zinc-800 text-xs">
              <div>
                <label className="block text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-1.5 uppercase tracking-wider font-sans">
                  Original Bill/Invoice No
                </label>
                <input
                  id="inp-debitnote-original-bill"
                  type="text"
                  placeholder="e.g. BIL-9992 or Cash inward"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value.toUpperCase())}
                  className="w-full text-sm p-2.5 bg-white dark:bg-zinc-900 border border-fuchsia-200/55 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-fuchsia-400 text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-1.5 uppercase tracking-wider font-sans">
                  Reason for Purchase Return
                </label>
                <select
                  id="sel-debitnote-reason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full text-sm p-2.5 bg-white dark:bg-zinc-900 border border-fuchsia-200/55 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-fuchsia-400 text-gray-900 dark:text-white font-sans"
                >
                  <option value="Damaged Goods">Damaged Goods / Material</option>
                  <option value="Defective Product">Defective Product / Hardware</option>
                  <option value="Incorrect Item Sent">Incorrect Item / Excess Quantity</option>
                  <option value="Short Supply">Under-supplied or Short supply</option>
                  <option value="Pricing adjustment">Pricing Difference / Rate discrepancy</option>
                  <option value="Other">Other / Miscellaneous</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Financial calculations */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h4 id="calc-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
              Tax allocation sum
            </h4>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Items Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subTotal)}</span>
              </div>
              {countryConfig.taxSystem === 'dual_gst' ? (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>Inward Central GST (CGST) {isInterstate ? `(IGST applies)` : ''}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Inward State GST (SGST) {isInterstate ? `(IGST applies)` : ''}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.sgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Inward Integrated GST (IGST)</span>
                    <span className="font-medium text-gray-900 dark:text-white text-orange-500">{formatCurrency(totals.igstTotal)}</span>
                  </div>
                </>
              ) : countryConfig.taxSystem === 'canadian_gst_pst' ? (
                <>
                  {totals.cgstTotal > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Inward GST (5%)</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.cgstTotal)}</span>
                    </div>
                  )}
                  {totals.sgstTotal > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Inward PST</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.sgstTotal)}</span>
                    </div>
                  )}
                  {totals.igstTotal > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Inward HST</span>
                      <span className="font-medium text-gray-900 dark:text-white text-orange-500">{formatCurrency(totals.igstTotal)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-gray-500">
                  <span>Inward {countryConfig.taxName} ({countryConfig.currencySymbol})</span>
                  <span className="font-medium text-gray-900 dark:text-white text-orange-500 font-bold">{formatCurrency(totals.igstTotal)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-2 flex justify-between text-sm font-bold text-gray-900 dark:text-white">
                <span>Absolute Bill Cost:</span>
                <span className="text-lg text-emerald-600">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            {!isReturnMode && (
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-3 text-xs space-y-3">
                {/* Dynamic Payment Status Badge & Controls */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment Status</label>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide flex items-center gap-1 ${
                      paidAmount >= totals.grandTotal && totals.grandTotal > 0
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : paidAmount > 0
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    }`}>
                      {paidAmount >= totals.grandTotal && totals.grandTotal > 0 ? (
                        <><span>✓</span><span>PAID IN FULL</span></>
                      ) : paidAmount > 0 ? (
                        <><span>⏳</span><span>PARTIAL ({formatCurrency(paidAmount)})</span></>
                      ) : (
                        <><span>✕</span><span>UNPAID / CREDIT</span></>
                      )}
                    </span>
                  </div>

                  {/* Preset Quick Status Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaidAmount(totals.grandTotal);
                        if (paymentMode === 'CREDIT') setPaymentMode('CASH');
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                        paidAmount >= totals.grandTotal && totals.grandTotal > 0
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                      }`}
                    >
                      <span>✓ Full Paid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (paidAmount === 0 || paidAmount >= totals.grandTotal) {
                          setPaidAmount(parseFloat((totals.grandTotal / 2).toFixed(2)));
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                        paidAmount > 0 && paidAmount < totals.grandTotal
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
                      }`}
                    >
                      <span>⏳ Partial</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaidAmount(0);
                        setPaymentMode('CREDIT');
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                        paidAmount === 0
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100'
                      }`}
                    >
                      <span>✕ Unpaid</span>
                    </button>
                  </div>
                </div>

                {/* Paid Amount Field */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Paid Amount to Vendor ({countryConfig.currencySymbol})
                  </label>
                  <input
                    id="inp-purchase-paid"
                    type="number"
                    min="0"
                    max={totals.grandTotal}
                    value={paidAmount}
                    onChange={(e: any) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full p-2 border border-gray-250 dark:border-zinc-800 dark:bg-zinc-900 rounded font-bold text-xs"
                    placeholder={`${countryConfig.currencySymbol} Amount Paid`}
                  />
                  {paidAmount < totals.grandTotal && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                      Remaining Balance Due: {formatCurrency(Math.max(0, totals.grandTotal - paidAmount))}
                    </p>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    id="sel-purchase-payment-mode"
                    value={paymentMode}
                    onChange={(e: any) => setPaymentMode(e.target.value)}
                    className="w-full p-2 border border-gray-250 dark:border-zinc-800 dark:bg-zinc-900 rounded text-xs font-bold"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="BANK_TRANSFER">🏦 Bank Transfer / NEFT</option>
                    <option value="UPI">📱 BHIM UPI</option>
                    <option value="CREDIT">🤝 Accounts Credit</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            id="btn-purchase-save"
            onClick={handleSavePurchase}
            className={`w-full py-3 text-white font-semibold text-sm rounded-xl mt-6 transition-all shadow-md flex items-center justify-center gap-2 hover:cursor-pointer ${
              isReturnMode 
                ? 'bg-fuchsia-600 hover:bg-fuchsia-700 shadow-fuchsia-500/10' 
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
            }`}
          >
            {isReturnMode ? <ArrowRightLeft className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {isReturnMode ? 'Record Debit Note (Purchase Return)' : 'Inward Stock & Record Purchase'}
          </button>
        </div>

      </div>

      {/* Product rows adding */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h4 id="purchase-item-title" className="text-sm font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-2">
              <span>Purchase Inward Grid Table</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full lowercase">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              Select existing inventory items or create a new product directly from this purchase grid.
            </p>
          </div>
          <button
            type="button"
            id="btn-purchase-create-new-product"
            onClick={handleOpenNewProductModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all hover:cursor-pointer shrink-0"
            title="Create a new product right from this purchase grid table"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ Create New Product</span>
          </button>
        </div>

        {/* Product append select */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="flex-1">
            <select
              id="sel-purchase-add-product"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '__CREATE_NEW__') {
                  handleOpenNewProductModal();
                  e.target.value = '';
                  return;
                }
                if (e.target.value) {
                  handleAddItem(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">➕ Select Material/Product to Stock-In...</option>
              <option value="__CREATE_NEW__" className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                ✨ ➕ [Create New Product & Stock-In to Grid]
              </option>
              {products.map((p, idx) => (
                <option key={idx} value={p.productId}>
                  {p.name} - SKU: {p.sku} ({countryConfig.hsnLabel}: {p.hsnCode}) | Stock: {p.currentStock} {p.unit || 'Units'}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleOpenNewProductModal}
            className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap hover:cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Quick Create Item</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400 text-xs border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-zinc-600 stroke-1 mb-2" />
            <p className="font-bold text-gray-700 dark:text-zinc-200 text-sm mb-1">No purchase products selected yet</p>
            <p className="text-gray-500 dark:text-zinc-400 mb-4 max-w-sm">
              Choose an existing item from inventory or create a new product to purchase directly.
            </p>
            <button
              type="button"
              onClick={handleOpenNewProductModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors hover:cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Create New Product for Purchase</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left text-gray-550 dark:text-zinc-400 border-collapse border border-gray-200 dark:border-zinc-800">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 font-extrabold uppercase text-[9px] tracking-widest bg-gray-100/80 dark:bg-zinc-800/35 text-gray-500">
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Product Description</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">{countryConfig.hsnLabel}</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Qty Buy</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Purchase Cost ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Discount ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850 text-center font-bold">{countryConfig.taxName} rate (%)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850 text-right">Cost ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-zinc-800/50">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-150/20 dark:hover:bg-zinc-850/10 transition-colors even:bg-gray-50/40 dark:even:bg-zinc-900/10">
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 font-bold text-gray-800 dark:text-zinc-200">
                      {item.name}
                      <span className="block text-[9px] text-gray-400 font-mono mt-0.5">ID: {item.productId}</span>
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 font-mono text-[11px] text-gray-650 dark:text-zinc-350">{item.hsnCode}</td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50">
                      <input
                        id={`inp-purchase-grid-qty-${idx}`}
                        type="number"
                        value={item.qty}
                        onChange={(e: any) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                        className="w-16 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 text-center rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                        min="1"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50">
                      <input
                        id={`inp-purchase-grid-price-${idx}`}
                        type="number"
                        value={item.price}
                        onChange={(e: any) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                        min="0"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50">
                      <div className="flex items-center gap-1">
                        <select
                          value={item.discountType || 'FLAT'}
                          onChange={(e) => handleToggleDiscountType(idx, e.target.value as 'FLAT' | 'PERCENT')}
                          className={`p-1 text-[11px] font-extrabold rounded border cursor-pointer ${
                            item.discountType === 'PERCENT'
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          }`}
                          title="Discount Mode: Percentage % or Currency Amount"
                        >
                          <option value="PERCENT">% Percent</option>
                          <option value="FLAT">{countryConfig.currencySymbol} Amount</option>
                        </select>

                        <input
                          id={`inp-purchase-grid-disc-${idx}`}
                          type="number"
                          value={item.discountType === 'PERCENT' ? (item.discountPercent !== undefined && item.discountPercent !== 0 ? item.discountPercent : '') : (item.discount !== undefined && item.discount !== 0 ? item.discount : '')}
                          onChange={(e: any) => handleUpdateItemDiscount(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                          min="0"
                          max={item.discountType === 'PERCENT' ? 100 : undefined}
                        />
                      </div>
                      {totals.items[idx]?.discount > 0 && (
                        <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 font-semibold">
                          {item.discountType === 'PERCENT'
                            ? `= -${formatCurrency(totals.items[idx].discount)}`
                            : `= -${totals.items[idx].discountPercent}%`}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          id={`inp-purchase-grid-tax-${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.gstRate}
                          onChange={(e: any) => handleUpdateItemTaxRate(idx, Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 rounded text-xs font-bold font-mono text-center focus:border-blue-500 focus:outline-hidden"
                          title={`Enter manual ${countryConfig.taxName} rate %`}
                        />
                        <span className="text-[11px] font-bold text-gray-500">%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-right font-black font-mono text-[11px] text-gray-905 dark:text-zinc-100">
                      {formatCurrency(totals.items[idx]?.total ?? 0)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        id={`btn-purchase-grid-remove-${idx}`}
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 px-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-md border border-red-100/40 hover:cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quick action bar below table */}
            <div className="mt-3 pt-3 border-t border-gray-150 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
                {items.length} line item{items.length > 1 ? 's' : ''} in purchase bill
              </span>
              <button
                type="button"
                onClick={handleOpenNewProductModal}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition-colors hover:cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create & Stock-In Another Product</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECENT PURCHASES & PAYMENT STATUS MANAGEMENT SECTION */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-150 dark:border-zinc-800">
          <div>
            <h4 id="recent-purchases-title" className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>Recent Purchase Bills & Payment Status</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                {filteredPurchaseList.length} Records
              </span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Track paid, partial, and unpaid purchase bills, and record vendor payments in real-time.
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                placeholder="Search Bill No or Supplier..."
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl w-48 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs p-1.5 px-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl font-bold text-gray-700 dark:text-zinc-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">✓ Paid Bills</option>
              <option value="PARTIAL">⏳ Partial Paid</option>
              <option value="UNPAID">✕ Unpaid Bills</option>
            </select>
          </div>
        </div>

        {/* Purchase Bills Table */}
        {filteredPurchaseList.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-xs italic">
            No purchase records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 dark:bg-zinc-800/40 text-[9px] font-extrabold uppercase text-gray-500 tracking-wider border-b border-gray-200 dark:border-zinc-800">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Bill No.</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-right">Paid Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Payment Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-zinc-800/50">
                {filteredPurchaseList.map((pur) => {
                  const currentPaid = pur.paidAmount || 0;
                  const balanceDue = Math.max(0, pur.grandTotal - currentPaid);
                  const status = pur.paymentStatus || (currentPaid >= pur.grandTotal ? 'PAID' : currentPaid > 0 ? 'PARTIAL' : 'UNPAID');

                  return (
                    <tr key={pur.purchaseId} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/20 transition-colors">
                      <td className="py-3 px-3 font-mono text-gray-600 dark:text-zinc-400">
                        {new Date(pur.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-gray-900 dark:text-white uppercase">
                        {pur.billNumber}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-800 dark:text-zinc-200">
                        {pur.supplierName}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-gray-900 dark:text-white">
                        {formatCurrency(pur.grandTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(currentPaid)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(balanceDue)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          status === 'PAID'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : status === 'PARTIAL'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}>
                          {status === 'PAID' ? '✓ PAID' : status === 'PARTIAL' ? '⏳ PARTIAL' : '✕ UNPAID'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {status !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayModalPurchase(pur);
                                setPayInputAmount(balanceDue.toFixed(2));
                                setPayInputMode('CASH');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Record Payment</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete purchase bill ${pur.billNumber}?`)) {
                                deletePurchaseEntry(pur.purchaseId);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Delete Purchase Bill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL FOR PURCHASE BILL */}
      {payModalPurchase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-gray-150 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-850/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Record Supplier Payment</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bill No: <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{payModalPurchase.billNumber}</span> ({payModalPurchase.supplierName})
                </p>
              </div>
              <button
                onClick={() => setPayModalPurchase(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-5 space-y-4">
              {/* Summary Stats */}
              <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200 dark:border-zinc-700/60 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] uppercase text-gray-400 font-bold block">Grand Total</span>
                  <span className="font-black text-gray-900 dark:text-white mt-0.5 block">{formatCurrency(payModalPurchase.grandTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-gray-400 font-bold block">Already Paid</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{formatCurrency(payModalPurchase.paidAmount || 0)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-gray-400 font-bold block">Balance Due</span>
                  <span className="font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
                    {formatCurrency(Math.max(0, payModalPurchase.grandTotal - (payModalPurchase.paidAmount || 0)))}
                  </span>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                  Payment Amount ({countryConfig.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={payModalPurchase.grandTotal - (payModalPurchase.paidAmount || 0)}
                  required
                  value={payInputAmount}
                  onChange={(e) => setPayInputAmount(e.target.value)}
                  className="w-full p-2.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl font-bold text-gray-900 dark:text-white"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPayInputAmount((payModalPurchase.grandTotal - (payModalPurchase.paidAmount || 0)).toFixed(2))}
                    className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded border border-emerald-300 cursor-pointer"
                  >
                    Pay Full Balance ({formatCurrency(payModalPurchase.grandTotal - (payModalPurchase.paidAmount || 0))})
                  </button>
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">
                  Payment Mode *
                </label>
                <select
                  value={payInputMode}
                  onChange={(e: any) => setPayInputMode(e.target.value)}
                  className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl font-bold text-gray-900 dark:text-white"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="BANK_TRANSFER">🏦 Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">📱 BHIM UPI</option>
                  <option value="CREDIT">🤝 Accounts Credit</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPayModalPurchase(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Save Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CREATE NEW PRODUCT MODAL (From Purchase Grid Table) */}
      {/* ------------------------------------------------------------- */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="p-4 px-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-850">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <PackagePlus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Create New Product (Purchase Grid Table)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Saves to inventory master and adds immediately as an active row in this purchase bill.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAndAddProduct} className="p-6 overflow-y-auto space-y-4 text-xs">
              {prodFormError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-medium">
                  {prodFormError}
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">
                  Product Name *
                </label>
                <input
                  id="inp-purchase-newprod-name"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Raw Material Batch A, Hardware Parts, Cement Bag"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    Category
                  </label>
                  <input
                    id="inp-purchase-newprod-category"
                    type="text"
                    placeholder="e.g. Raw Materials, Spares, Goods"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    Unit of Measurement
                  </label>
                  <select
                    id="sel-purchase-newprod-unit"
                    value={newProdUnit}
                    onChange={(e: any) => setNewProdUnit(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="LITER">LITER (Liters)</option>
                    <option value="BOX">BOX (Boxes / Cartons)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="SET">SET (Sets / Kits)</option>
                  </select>
                </div>
              </div>

              {/* Purchase Price & Selling Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">
                    Purchase Cost ({countryConfig.currencySymbol}) *
                  </label>
                  <input
                    id="inp-purchase-newprod-purchase-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={newProdPurchasePrice}
                    onChange={(e) => setNewProdPurchasePrice(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    Selling Price ({countryConfig.currencySymbol})
                  </label>
                  <input
                    id="inp-purchase-newprod-selling-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProdSellingPrice}
                    onChange={(e) => setNewProdSellingPrice(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tax Rate & HSN */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">
                    {countryConfig.taxName} Rate (%)
                  </label>
                  <div className="space-y-1.5">
                    <input
                      id="inp-purchase-newprod-tax-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newProdTaxRate}
                      onChange={(e) => setNewProdTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <div className="flex flex-wrap gap-1">
                      {(countryConfig.taxRates || [0, 5, 12, 18, 28]).map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setNewProdTaxRate(rate)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            newProdTaxRate === rate
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    {countryConfig.hsnLabel}
                  </label>
                  <input
                    id="inp-purchase-newprod-hsn"
                    type="text"
                    placeholder="e.g. 9988, 8471"
                    value={newProdHsn}
                    onChange={(e) => setNewProdHsn(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <span className="block text-[9px] text-gray-400 mt-1">Default: 9999 if left blank</span>
                </div>
              </div>

              {/* Initial Stock & SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    Existing Stock Before Purchase
                  </label>
                  <input
                    id="inp-purchase-newprod-stock"
                    type="number"
                    min="0"
                    value={newProdOpeningStock}
                    onChange={(e) => setNewProdOpeningStock(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <span className="block text-[9px] text-gray-400 mt-1">Stock bought in this bill will be added automatically</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    Item Code / SKU
                  </label>
                  <input
                    id="inp-purchase-newprod-sku"
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Footer / Submit Button */}
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-bold text-xs hover:cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-new-product-purchase-grid"
                  disabled={isSavingProduct}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 hover:cursor-pointer transition-all disabled:opacity-50"
                >
                  {isSavingProduct ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save & Stock-In to Bill</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
