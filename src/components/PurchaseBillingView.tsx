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
  ArrowRightLeft
} from 'lucide-react';
import { PurchaseItem, PurchaseBill, Supplier } from '../types';

export const PurchaseBillingView: React.FC = () => {
  const { 
    activeCompany, 
    products, 
    suppliers, 
    savePurchaseEntry, 
    savePurchaseReturn,
    saveSupplier,
    formatCurrency,
    countryConfig,
    t 
  } = useApp();

  // Mode state switched between standard entry and debit note returns
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [refBillNo, setRefBillNo] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged Goods');

  // Selected State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [items, setItems] = useState<Omit<PurchaseItem, 'total'>[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [billNumber, setBillNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Inline forms
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppState, setSuppState] = useState(activeCompany?.state || 'Maharashtra');
  const [suppGstin, setSuppGstin] = useState('');

  const activeSupplier = useMemo(() => {
    return suppliers.find(s => s.supplierId === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  // Check GST calculations
  const isInterstate = useMemo(() => {
    if (!activeCompany || !activeSupplier) return false;
    return activeCompany.address?.toLowerCase().includes(activeSupplier.state.toLowerCase()) === false &&
           (activeCompany.state?.toLowerCase() !== activeSupplier.state?.toLowerCase());
  }, [activeCompany, activeSupplier]);

  // Totals calculations
  const totals = useMemo(() => {
    let subTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let discountTotal = 0;

    const computedItems: PurchaseItem[] = items.map(item => {
      const lineSub = (item.price * item.qty) - item.discount;
      const cleanLineSub = Math.max(0, lineSub);
      subTotal += cleanLineSub;
      discountTotal += item.discount;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

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

      const total = parseFloat((cleanLineSub + cgst + sgst + igst).toFixed(2));

      return {
        ...item,
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
  }, [items, isInterstate]);

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
    copy[index].discount = Math.max(0, val);
    setItems(copy);
  };

  const handleUpdateItemPrice = (index: number, val: number) => {
    const copy = [...items];
    copy[index].price = Math.max(0, val);
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
        paymentStatus: (paidAmount >= totals.grandTotal) 
          ? 'PAID' 
          : (paidAmount > 0) 
            ? 'PARTIAL' 
            : 'UNPAID'
      });

      alert('Purchase recorded. Inventory updated successfully!');
      setItems([]);
      setSelectedSupplierId('');
      setPaidAmount(0);
      setBillNumber('');
    } catch (err) {
      alert('Failed to save purchase. Check role-based security settings.');
    }
  };

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
              <div className="flex justify-between text-gray-500">
                <span>Inward {countryConfig.stateTaxShorthand || 'CGST'} {isInterstate ? `(${countryConfig.centralTaxShorthand || 'IGST'} applies)` : ''}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.cgstTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Inward {countryConfig.stateTaxShorthand || 'SGST'} {isInterstate ? `(${countryConfig.centralTaxShorthand || 'IGST'} applies)` : ''}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.sgstTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Inward {countryConfig.centralTaxShorthand || 'IGST'}</span>
                <span className="font-medium text-gray-900 dark:text-white text-orange-500">{formatCurrency(totals.igstTotal)}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-2 flex justify-between text-sm font-bold text-gray-900 dark:text-white">
                <span>Absolute Bill Cost:</span>
                <span className="text-lg text-emerald-600">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            {!isReturnMode && (
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-3 text-xs">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Paid Amount to Vendor ({countryConfig.currencySymbol})</label>
                <input
                  id="inp-purchase-paid"
                  type="number"
                  value={paidAmount}
                  onChange={(e: any) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full p-2 border border-gray-250 dark:border-zinc-800 dark:bg-zinc-900 rounded font-bold"
                  placeholder={`${countryConfig.currencySymbol} Amount Paid`}
                />
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
        <h4 id="purchase-item-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
          Products Bought Inflow List
        </h4>

        {/* Product append select */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            id="sel-purchase-add-product"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                handleAddItem(e.target.value);
                e.target.value = '';
              }
            }}
            className="text-xs p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded-xl"
          >
            <option value="">➕ Select Material/Product to Stock-In...</option>
            {products.map((p, idx) => (
              <option key={idx} value={p.productId}>
                {p.name} - SKU: {p.sku} (Current Stock: {p.currentStock})
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-xs border-2 border-dashed border-gray-150 rounded-2xl">
            <ShoppingBag className="w-10 h-10 text-gray-300 stroke-1 mb-2" />
            No purchase products selected yet.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left text-gray-550 dark:text-zinc-400 border-collapse border border-gray-200 dark:border-zinc-800">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 font-extrabold uppercase text-[9px] tracking-widest bg-gray-100/80 dark:bg-zinc-800/35 text-gray-500">
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Product Description</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">HSN Code</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Qty Buy</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Purchase Cost ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Discount ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850 text-center font-bold">Tax rate (%)</th>
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
                      <input
                        id={`inp-purchase-grid-disc-${idx}`}
                        type="number"
                        value={item.discount}
                        onChange={(e: any) => handleUpdateItemDiscount(idx, parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                        min="0"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center font-bold font-mono text-gray-800 dark:text-zinc-200 font-bold">
                      {item.gstRate}%
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-right font-black font-mono text-[11px] text-gray-905 dark:text-zinc-100">
                      {formatCurrency(((item.price * item.qty) - item.discount) * (1 + item.gstRate / 100))}
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
          </div>
        )}
      </div>

    </div>
  );
};
