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
  FileSpreadsheet, 
  Download, 
  Printer, 
  Share2, 
  UserPlus, 
  ShoppingBag, 
  Eye,
  Check, 
  X,
  Mail,
  Send,
  FileCheck,
  ArrowRightLeft,
  Copy,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { InvoiceItem, SalesInvoice, Customer } from '../types';
import jsPDF from 'jspdf';

export const SalesBillingView: React.FC = () => {
  const { 
    activeCompany, 
    products, 
    customers, 
    saveSalesInvoice, 
    saveSalesReturn,
    saveCustomer,
    formatCurrency,
    countryConfig,
    t 
  } = useApp();

  // Mode state toggled between invoice vs credit note
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [refInvoiceNo, setRefInvoiceNo] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged Goods');

  // Selected State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<Omit<InvoiceItem, 'total'>[]>([]);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  // Modal Preview and Sharing state
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null);
  const [activeShareModal, setActiveShareModal] = useState<'whatsapp' | 'email' | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Inline forms
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custState, setCustState] = useState(activeCompany?.state || 'Maharashtra');
  const [custGstType, setCustGstType] = useState<'GST_REGULAR' | 'GST_COMPOSITION' | 'CONSUMER' | 'UNREGISTERED'>('CONSUMER');
  const [custGstin, setCustGstin] = useState('');

  const activeCustomer = useMemo(() => {
    return customers.find(c => c.customerId === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Check GST Type: Intra-state or Inter-state
  const isInterstate = useMemo(() => {
    if (!activeCompany || !activeCustomer) return false;
    // Compares lowercase clean Indian states
    return activeCompany.address?.toLowerCase().includes(activeCustomer.state.toLowerCase()) === false &&
           (activeCompany.state?.toLowerCase() !== activeCustomer.state?.toLowerCase());
  }, [activeCompany, activeCustomer]);

  // Calculations for items list and aggregates
  const totals = useMemo(() => {
    let subTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let discountTotal = 0;

    const computedItems: InvoiceItem[] = items.map(item => {
      // Net Taxable Base = (Qty * Price) - Discount
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

  // Operations: Add line product
  const handleAddItem = (productId: string) => {
    const prod = products.find(p => p.productId === productId);
    if (!prod) return;

    // Check if item already exists
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
          price: prod.sellingPrice,
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

  // Quick Inline Customer Save
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName) return;
    try {
      const inlineId = 'cust_' + Math.random().toString(36).substr(2, 9);
      const newCust: Customer = {
        customerId: inlineId,
        name: custName,
        phone: custPhone,
        email: custEmail,
        address: custAddress,
        state: custState,
        gstType: custGstType,
        gstin: custGstin,
        openingBalance: 0,
        outstandingBalance: 0
      };
      await saveCustomer(newCust);
      setSelectedCustomerId(inlineId);
      
      // Reset forms
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCustAddress('');
      setCustGstin('');
      setShowAddCustomer(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Invoice to Firebase Database
  const handleReviewInvoice = () => {
    if (!activeCustomer || items.length === 0) {
      alert('Must select a customer and add at least one line item to review.');
      return;
    }
    
    // Generate transient invoice for preview modal
    const transientInvoice: SalesInvoice = {
      invoiceId: 'PREVIEW',
      invoiceNumber: 'PREVIEW-ONLY',
      date: new Date(invoiceDate).toISOString(),
      customerId: selectedCustomerId,
      customerName: activeCustomer.name,
      customerGstin: activeCustomer.gstin,
      customerState: activeCustomer.state,
      billingAddress: activeCustomer.address,
      items: totals.items,
      subTotal: totals.subTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      discountTotal: totals.discountTotal,
      grandTotal: totals.grandTotal,
      receivedAmount: receivedAmount,
      paymentStatus: receivedAmount >= totals.grandTotal ? 'PAID' : receivedAmount > 0 ? 'PARTIAL' : 'UNPAID',
      paymentMode,
      notes,
      ewayBillNo,
      vehicleNo,
      financialYear: activeCompany?.financialYear || '2026-2027'
    };

    setPreviewInvoice(transientInvoice);
  };

  const handleSaveInvoice = async () => {
    if (!selectedCustomerId) {
      alert('Please select a Customer first.');
      return;
    }
    if (items.length === 0) {
      alert('Must contain at least one product line item.');
      return;
    }

    try {
      if (isReturnMode) {
        const returnPayload = {
          referenceInvoiceNo: refInvoiceNo,
          date: new Date(invoiceDate).toISOString(),
          customerId: selectedCustomerId,
          customerName: activeCustomer?.name || '',
          customerGstin: activeCustomer?.gstin || '',
          customerState: activeCustomer?.state || '',
          items: totals.items,
          subTotal: totals.subTotal,
          cgstTotal: totals.cgstTotal,
          sgstTotal: totals.sgstTotal,
          igstTotal: totals.igstTotal,
          grandTotal: totals.grandTotal,
          reason: returnReason,
          financialYear: activeCompany?.financialYear || '2026-2027'
        };

        await saveSalesReturn(returnPayload);
        alert('Credit Note (Sales Return) registered successfully!');
        
        // Reset state
        setItems([]);
        setSelectedCustomerId('');
        setReceivedAmount(0);
        setNotes('');
        setRefInvoiceNo('');
        setReturnReason('Damaged Goods');
        setEwayBillNo('');
        setVehicleNo('');
        return;
      }

      const payload = {
        date: new Date(invoiceDate).toISOString(),
        customerId: selectedCustomerId,
        customerName: activeCustomer?.name || '',
        customerGstin: activeCustomer?.gstin || '',
        customerState: activeCustomer?.state || '',
        billingAddress: activeCustomer?.address || '',
        items: totals.items,
        subTotal: totals.subTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
        receivedAmount: receivedAmount,
        paymentStatus: (receivedAmount >= totals.grandTotal) 
          ? 'PAID' 
          : (receivedAmount > 0) 
            ? 'PARTIAL' 
            : 'UNPAID' as 'PAID' | 'PARTIAL' | 'UNPAID',
        paymentMode: paymentMode,
        notes: notes,
        ewayBillNo: ewayBillNo,
        vehicleNo: vehicleNo
      };

      await saveSalesInvoice(payload);
      
      // Auto triggers compile jsPDF invoice download on successful database updates
      generateInvoicePDF(payload as SalesInvoice, true);

      // Clean billing layout state
      setItems([]);
      setSelectedCustomerId('');
      setReceivedAmount(0);
      setNotes('');
      setEwayBillNo('');
      setVehicleNo('');
    } catch (err) {
      alert('Failed to register invoice. Ensure security permissions match.');
    }
  };

  // Native jsPDF GST Compliance Document compilation engine
  const generateInvoicePDF = (invData: SalesInvoice, autoDownload = true) => {
    const doc = new jsPDF();
    const lMargin = 15;
    let y = 20;

    // Head Accent Brand Theme Color
    doc.setFillColor(30, 41, 59); // Charcoal deep slate
    doc.rect(0, 0, 210, 8, 'F');

    const hasLogo = !!activeCompany?.logoUrl;
    const headerLeft = hasLogo ? 38 : lMargin;

    // Draw Brand Logo in top-left corner if configured
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
        console.warn('Failed to draw company logo on PDF:', logoErr);
      }
    }

    // Header Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'TAX INVOICE', headerLeft, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('India GST Tax Invoice', headerLeft, y + 5);

    // Dynamic sequence values
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoice No: ${invData.invoiceNumber || 'DRAFT'}`, 135, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(invData.date).toLocaleDateString('en-IN')}`, 135, y + 5);
    doc.text(`State of Supply: ${invData.customerState}`, 135, y + 10);
    if (invData.ewayBillNo) {
      doc.text(`E-Way Bill: ${invData.ewayBillNo}`, 135, y + 15);
      if (invData.vehicleNo) {
        doc.text(`Vehicle No: ${invData.vehicleNo}`, 135, y + 20);
      }
    } else if (invData.vehicleNo) {
      doc.text(`Vehicle No: ${invData.vehicleNo}`, 135, y + 15);
    }

    y += 24;

    // Border line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);
    y += 8;

    // Column Left: Party Bill From
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILL FROM (Supplier):', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 5);
    doc.text(activeCompany?.address || 'Corporate Billing Address', lMargin, y + 10);
    doc.text(`GSTIN/UIN: ${activeCompany?.gstin || 'N/A'}`, lMargin, y + 15);
    doc.text(`Phone: ${activeCompany?.phone || 'N/A'}`, lMargin, y + 20);

    // Column Right: Party Bill To
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILL TO (Recipient):', 115, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(invData.customerName, 115, y + 5);
    doc.text(invData.billingAddress || 'No billing address provided', 112, y + 10, { maxWidth: 83 });
    doc.text(`GSTIN/UIN: ${invData.customerGstin || 'URP (Consumer)'}`, 115, y + 20);

    y += 32;

    // Items table header
    doc.setFillColor(248, 250, 252);
    doc.rect(lMargin, y, 180, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('S.No', lMargin + 2, y + 5);
    doc.text('Product Description', lMargin + 12, y + 5);
    doc.text('HSN', lMargin + 65, y + 5);
    doc.text('Qty', lMargin + 82, y + 5);
    doc.text('Price', lMargin + 95, y + 5);
    doc.text('Disc', lMargin + 115, y + 5);
    doc.text('GST Rate', lMargin + 130, y + 5);
    doc.text('Tax Val', lMargin + 152, y + 5);
    doc.text('Total (' + countryConfig.currencySymbol + ')', lMargin + 168, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Table rows
    invData.items.forEach((item, index) => {
      const cleanSub = (item.price * item.qty) - item.discount;
      doc.text(String(index + 1), lMargin + 2, y + 5);
      doc.text(item.name.substring(0, 32), lMargin + 12, y + 5);
      doc.text(item.hsnCode, lMargin + 65, y + 5);
      doc.text(`${item.qty} ${item.unit}`, lMargin + 82, y + 5);
      doc.text(item.price.toFixed(2), lMargin + 95, y + 5);
      doc.text(item.discount.toFixed(2), lMargin + 115, y + 5);
      doc.text(`${item.gstRate}%`, lMargin + 130, y + 5);
      doc.text(cleanSub.toFixed(2), lMargin + 152, y + 5);
      doc.text(item.total.toFixed(2), lMargin + 168, y + 5);
      
      y += 8;
    });

    y += 4;
    doc.line(lMargin, y, 195, y);
    y += 6;

    // Bottom financial columns breakdown
    // Col Left: Information
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Bank details for transfer:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Bank Name: ${activeCompany?.bankName || 'N/A'}`, lMargin, y + 5);
    doc.text(`Account No: ${activeCompany?.bankAccountNo || 'N/A'}`, lMargin, y + 10);
    doc.text(`IFSC Code: ${activeCompany?.bankIfsc || 'N/A'}`, lMargin, y + 15);
    doc.text(`Branch: ${activeCompany?.bankBranch || 'N/A'}`, lMargin, y + 20);
    if (activeCompany?.upiId) {
      doc.text(`UPI ID: ${activeCompany.upiId}`, lMargin, y + 25);
    }

    // Col Right: Sum totals
    doc.setFont('helvetica', 'semibold');
    doc.text('Subtotal:', 135, y + 5);
    doc.text('CGST Total:', 135, y + 10);
    doc.text('SGST Total:', 135, y + 15);
    doc.text('IGST Total:', 135, y + 20);
    doc.text('Discount:', 135, y + 25);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Grand Total:', 135, y + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`INR ${invData.subTotal.toFixed(2)}`, 165, y + 5);
    doc.text(`INR ${invData.cgstTotal.toFixed(2)}`, 165, y + 10);
    doc.text(`INR ${invData.sgstTotal.toFixed(2)}`, 165, y + 15);
    doc.text(`INR ${invData.igstTotal.toFixed(2)}`, 165, y + 20);
    doc.text(`INR ${invData.discountTotal.toFixed(2)}`, 165, y + 25);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`INR ${invData.grandTotal.toFixed(2)}`, 165, y + 32);

    y += 42;

    // Footer signature declarations
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Declare: The tax coordinates and items outline matches absolute compliance standard of CGST/SGST Act 2017.', lMargin, y);
    doc.text('This is a computer generated document, no manual signature is required.', lMargin, y + 4);

    if (autoDownload) {
      doc.save(`GST_Invoice_${invData.invoiceNumber || 'File'}.pdf`);
    } else {
      // Print overlay
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    if (!activeCustomer) {
      alert('Select customer details first.');
      return;
    }
    if (items.length === 0) {
      alert('Add at least one item to generate shareable bill message.');
      return;
    }
    setActiveShareModal('whatsapp');
  };

  const handleShareEmail = () => {
    if (!activeCustomer) {
      alert('Select customer details first.');
      return;
    }
    if (items.length === 0) {
      alert('Add at least one item to generate shareable bill message.');
      return;
    }
    setActiveShareModal('email');
  };

  return (
    <div className="space-y-6">

      {/* Mode Switch Tab Bar */}
      <div className="flex border-b border-gray-150/45 dark:border-zinc-800 gap-2 overflow-x-auto pb-0.5 print:hidden">
        <button
          id="btn-sales-invoice-mode"
          type="button"
          onClick={() => setIsReturnMode(false)}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap hover:cursor-pointer flex items-center gap-1.5 ${
            !isReturnMode
              ? `border-blue-600 text-blue-600 bg-blue-50/10` 
              : 'border-transparent text-gray-400 hover:text-gray-500'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Standard Sales Invoice</span>
        </button>
        <button
          id="btn-sales-return-mode"
          type="button"
          onClick={() => setIsReturnMode(true)}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap hover:cursor-pointer flex items-center gap-1.5 ${
            isReturnMode
              ? `border-fuchsia-500 text-fuchsia-500 bg-fuchsia-50/10` 
              : 'border-transparent text-gray-400 hover:text-gray-500'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Sales Return / Credit Note (Debit Customer)</span>
        </button>
      </div>

      {/* Upper Grid panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Customer Selection & General Metadata (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 id="client-panel-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
              Billing Metadata & Recipient
            </h4>
            <button
              id="btn-trigger-add-customer-modal"
              onClick={() => setShowAddCustomer(!showAddCustomer)}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline hover:cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Quick Add Customer
            </button>
          </div>

          {/* Quick Dynamic Inline Add Customer Form */}
          {showAddCustomer && (
            <form onSubmit={handleCreateCustomer} className="p-4 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-200 dark:border-zinc-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Customer Name *</label>
                  <input
                    id="inp-inline-cust-name"
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Mobile Phone</label>
                  <input
                    id="inp-inline-cust-phone"
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="91xxxxxxxx"
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Email</label>
                  <input
                    id="inp-inline-cust-email"
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">State Location</label>
                  <select
                    id="sel-inline-cust-state"
                    value={custState}
                    onChange={(e) => setCustState(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  >
                    {statesOfIndia.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">GST Registration Type</label>
                  <select
                    id="sel-inline-cust-gst"
                    value={custGstType}
                    onChange={(e) => setCustGstType(e.target.value as any)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  >
                    <option value="CONSUMER">Consumer / Unregistered</option>
                    <option value="GST_REGULAR">Regular Taxpayer (B2B)</option>
                    <option value="GST_COMPOSITION">Composition Scheme</option>
                  </select>
                </div>
                {custGstType !== 'CONSUMER' && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">15-Digit GSTIN *</label>
                    <input
                      id="inp-inline-cust-gstin"
                      type="text"
                      required
                      value={custGstin}
                      onChange={(e) => setCustGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 24AAAAP1234A1Z1"
                      className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded text-blue-600 font-mono"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <textarea
                  id="txa-inline-cust-address"
                  placeholder="Billing address"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded h-10"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  id="btn-cancel-inline-cust"
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-inline-cust"
                  type="submit"
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer selector details */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                Select Customer Account *
              </label>
              <select
                id="sel-invoice-customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-sm p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-850 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c, idx) => (
                  <option key={idx} value={c.customerId}>
                    {c.name} ({c.gstin ? 'B2B/GST' : 'B2C'}{c.phone ? `, ${c.phone}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Details */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                {isReturnMode ? 'Credit Note Date' : 'Billing Date'}
              </label>
              <input
                id="inp-invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full text-sm p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-850 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Conditional Sales Return details */}
          {isReturnMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-fuchsia-50/20 dark:bg-zinc-800/20 rounded-xl border border-fuchsia-100/30 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-1.5 uppercase tracking-wider">
                  Original Invoice No. *
                </label>
                <input
                  id="inp-creditnote-original-invoice"
                  type="text"
                  required
                  placeholder="e.g. INV-2026-0004 or Cash"
                  value={refInvoiceNo}
                  onChange={(e) => setRefInvoiceNo(e.target.value)}
                  className="w-full text-sm p-2.5 bg-white dark:bg-zinc-900 border border-fuchsia-200/55 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-fuchsia-400 text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-1.5 uppercase tracking-wider">
                  Reason for Sales Return
                </label>
                <select
                  id="sel-creditnote-reason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full text-sm p-2.5 bg-white dark:bg-zinc-900 border border-fuchsia-200/55 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-fuchsia-400 text-gray-900 dark:text-white"
                >
                  <option value="Damaged Goods">Damaged Goods / Material</option>
                  <option value="Defective Product">Defective Product / Hardware</option>
                  <option value="Incorrect Item Sent">Incorrect Item / Excess Quantity</option>
                  <option value="Customer Dissatisfaction">Customer Return / Refund requested</option>
                  <option value="Under-discounting or Pricing Difference">Pricing / GST Correction</option>
                  <option value="Other">Other / Miscellaneous</option>
                </select>
              </div>
            </div>
          )}

          {activeCustomer && (
            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/5 rounded-xl border border-blue-100/40 dark:border-blue-900/10 text-xs grid grid-cols-2 gap-2 text-gray-600 dark:text-zinc-300">
              <div>
                <span className="font-semibold text-gray-700">Billing Address:</span>
                <p>{activeCustomer.address || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">GST Registration:</span>
                <p>{activeCustomer.gstType.replace('_', ' ')} / State: {activeCustomer.state}</p>
                {activeCustomer.gstin && <p className="font-mono text-blue-600">{activeCustomer.gstin}</p>}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Financial Calculator Breakdown (1 Col) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h4 id="financial-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
              Calculations Summary
            </h4>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Taxable Value (Subtotal)</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{countryConfig.stateTaxShorthand || 'CGST'} Amount {isInterstate ? '(IGST overrides)' : ''}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.cgstTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{countryConfig.stateTaxShorthand || 'SGST'} Amount {isInterstate ? '(IGST overrides)' : ''}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.sgstTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{countryConfig.centralTaxShorthand || 'IGST'} Amount</span>
                <span className="font-medium text-gray-900 dark:text-white text-blue-600">{formatCurrency(totals.igstTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Aggregated Discount</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.discountTotal)}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-2 flex justify-between text-sm font-bold text-gray-900 dark:text-white">
                <span>Invoice Total:</span>
                <span className="text-lg text-blue-600 dark:text-blue-400">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            {totals.grandTotal > 50000 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250/70 p-3 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                <span className="font-extrabold text-[10px] uppercase tracking-wider block">⚠️ E-Way Bill Checklist Requirement</span>
                <p>This invoice (₹{formatCurrency(totals.grandTotal)}) exceeds the ₹50,000 baseline transport rule. Please generate e-Way credentials on the portal and enter the bill serial below.</p>
              </div>
            )}

            <div className="pt-1 grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">E-Way Bill Number</label>
                <input
                  id="inp-invoice-eway"
                  type="text"
                  placeholder="12-digit Number"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value.toUpperCase())}
                  maxLength={12}
                  className="w-full p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded font-mono text-[11px] text-indigo-650 dark:text-indigo-400 font-extrabold focus:outline-none focus:border-indigo-505"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Vehicle / Transport No</label>
                <input
                  id="inp-invoice-vehicle"
                  type="text"
                  placeholder="e.g. MH-12-PQ-9999"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded font-mono text-[11px] text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-505"
                />
              </div>
            </div>

            {!isReturnMode && (
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Paid Status</label>
                  <select
                    id="sel-invoice-payment-mode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">BHIM UPI</option>
                    <option value="CREDIT">Accounts CREDIT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amt Received (Rs)</label>
                  <input
                    id="inp-invoice-received"
                    type="number"
                    value={receivedAmount}
                    onChange={(e: any) => setReceivedAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="INR Received"
                    className="w-full p-2 border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {!isReturnMode && (
              <button
                id="btn-invoice-preview"
                onClick={handleReviewInvoice}
                className="w-full py-3 bg-white dark:bg-zinc-800 hover:bg-gray-50 text-gray-700 dark:text-zinc-200 font-bold text-sm rounded-xl border border-gray-200 dark:border-zinc-700 hover:cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-blue-600" />
                Review & Preview Bill
              </button>
            )}
            <button
              id="btn-invoice-saver"
              onClick={handleSaveInvoice}
              className={`w-full py-3 text-white font-semibold text-sm rounded-xl hover:cursor-pointer transition-colors shadow-md flex items-center justify-center gap-2 ${
                isReturnMode 
                  ? 'bg-fuchsia-600 hover:bg-fuchsia-700 shadow-fuchsia-500/10' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isReturnMode ? 'Finalize & Save Credit Note' : 'Finalize & Save Invoice'}
            </button>
          </div>
          
          {!isReturnMode && (
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-invoice-wa"
                onClick={handleShareWhatsApp}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp Box
              </button>
              <button
                id="btn-invoice-mail"
                onClick={handleShareEmail}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                Share Email
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Grid: Adding Row Products */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
        <h4 id="item-grid-title" className="text-sm font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide">
          Invoice Sales Grid Table
        </h4>

        {/* Product selector helper bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            id="sel-billing-add-product"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                handleAddItem(e.target.value);
                e.target.value = ''; // Reset selector
              }
            }}
            className="text-xs p-2.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded-xl"
          >
            <option value="">➕ Choose Product to Add Line Row...</option>
            {products.map((p, idx) => (
              <option key={idx} value={p.productId} disabled={p.currentStock <= 0}>
                {p.name} (HSN: {p.hsnCode}) - Price: {formatCurrency(p.sellingPrice)} / {p.currentStock} {p.unit || 'Units'} Stock
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-xs border-2 border-dashed border-gray-150 rounded-2xl">
            <ShoppingBag className="w-10 h-10 text-gray-300 stroke-1 mb-2" />
            No active row items. Use selector above to append products into the GST list.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left text-gray-550 dark:text-zinc-400 border-collapse border border-gray-200 dark:border-zinc-800">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 font-extrabold uppercase text-[9px] tracking-widest bg-gray-100/80 dark:bg-zinc-800/35 text-gray-500">
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Product Name</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">HSN Code</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Qty</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Unit Price ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850">Disc ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850 text-center">GST Rate (%)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-850 text-right">Row Total ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
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
                        id={`inp-grid-qty-${idx}`}
                        type="number"
                        value={item.qty}
                        onChange={(e: any) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                        className="w-16 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 text-center rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                        min="1"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50">
                      <input
                        id={`inp-grid-price-${idx}`}
                        type="number"
                        value={item.price}
                        onChange={(e: any) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                        min="0"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50">
                      <input
                        id={`inp-grid-disc-${idx}`}
                        type="number"
                        value={item.discount}
                        onChange={(e: any) => handleUpdateItemDiscount(idx, parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border border-gray-200 dark:border-zinc-750 dark:bg-zinc-900 rounded text-xs font-bold font-mono focus:border-blue-500 focus:outline-hidden"
                        min="0"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center font-bold font-mono text-gray-800 dark:text-zinc-200">
                      {item.gstRate}%
                    </td>
                    <td className="py-2 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-right font-black font-mono text-[11px] text-gray-905 dark:text-zinc-100">
                      {formatCurrency(((item.price * item.qty) - item.discount) * (1 + item.gstRate / 100))}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        id={`btn-grid-remove-${idx}`}
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

      {/* ------------------------------------------------------------- */}
      {/* INVOICE PREVIEW MODAL */}
      {/* ------------------------------------------------------------- */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-850">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                  <Eye className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Tax Invoice Preview</h3>
                  <p className="text-xs text-gray-500">Live compliance breakdown ready for download & print.</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Invoice Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-gray-700 dark:text-zinc-300">
              
              {/* Company & Invoice Top Banner */}
              <div className="flex justify-between items-start border-b border-gray-150 dark:border-zinc-800 pb-5">
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">{activeCompany?.name || 'Company Name'}</h2>
                  <p className="text-gray-500 mt-0.5">{activeCompany?.address || 'Billing Address'}</p>
                  <p className="text-gray-500 font-mono mt-1">GSTIN: <span className="font-bold text-gray-800 dark:text-zinc-200">{activeCompany?.gstin || 'N/A'}</span></p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-black rounded-lg text-xs uppercase tracking-wider">
                    TAX INVOICE
                  </span>
                  <p className="font-mono font-bold mt-2 text-gray-900 dark:text-white">{previewInvoice.invoiceNumber}</p>
                  <p className="text-gray-500 mt-0.5">Date: {new Date(previewInvoice.date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              {/* Customer Bill To */}
              <div className="bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-gray-150 dark:border-zinc-800 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">Bill To (Recipient)</span>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{previewInvoice.customerName}</p>
                  <p className="text-gray-600 dark:text-zinc-400 mt-0.5">{previewInvoice.billingAddress || 'No address provided'}</p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">GSTIN</span>
                  <span className="font-bold text-gray-800 dark:text-zinc-200">{previewInvoice.customerGstin || 'Consumer (URP)'}</span>
                  <p className="text-xs text-gray-500 mt-1">State: {previewInvoice.customerState}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-gray-200 dark:border-zinc-800 rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-zinc-800 text-[10px] font-bold uppercase text-gray-500 tracking-wider border-b border-gray-200 dark:border-zinc-800">
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">HSN</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Disc</th>
                      <th className="py-2.5 px-3 text-center">GST</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-zinc-800 font-medium">
                    {previewInvoice.items.map((it, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/30">
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-zinc-100">{it.name}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-500">{it.hsnCode}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{it.qty} {it.unit || ''}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.price)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.discount)}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{it.gstRate}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="space-y-1 text-xs text-gray-600 dark:text-zinc-400">
                  <p>Subtotal: <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{formatCurrency(previewInvoice.subTotal)}</span></p>
                  <p>CGST Total: <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{formatCurrency(previewInvoice.cgstTotal)}</span> | SGST Total: <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{formatCurrency(previewInvoice.sgstTotal)}</span> | IGST Total: <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{formatCurrency(previewInvoice.igstTotal)}</span></p>
                  <p>Payment Mode: <span className="font-bold uppercase text-indigo-600">{previewInvoice.paymentMode}</span> ({previewInvoice.paymentStatus})</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-widest block">Grand Total</span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(previewInvoice.grandTotal)}</span>
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 px-6 bg-gray-50 dark:bg-zinc-850 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 text-gray-700 dark:text-zinc-300 font-bold rounded-xl text-xs hover:cursor-pointer transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={() => generateInvoicePDF(previewInvoice, true)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 hover:cursor-pointer transition-colors shadow-md"
              >
                <Download className="w-4 h-4" />
                Download PDF Bill
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* WHATSAPP & EMAIL SHARE MODALS */}
      {/* ------------------------------------------------------------- */}
      {activeShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            
            <div className="p-4 px-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-850">
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-lg text-white ${activeShareModal === 'whatsapp' ? 'bg-emerald-600' : 'bg-zinc-800'}`}>
                  {activeShareModal === 'whatsapp' ? <Share2 className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {activeShareModal === 'whatsapp' ? 'Share Bill via WhatsApp' : 'Share Bill via Email'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {activeShareModal === 'whatsapp' ? `Send statement to ${activeCustomer?.name}` : `Email bill statement to ${activeCustomer?.name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveShareModal(null); setCopyFeedback(false); }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Generated Message Preview</label>
                <textarea
                  readOnly
                  rows={5}
                  value={
                    activeShareModal === 'whatsapp'
                      ? `Dear ${activeCustomer?.name || 'Customer'}, Tax Invoice from ${activeCompany?.name || 'us'} has been issued. Total Invoice Cost: INR ${totals.grandTotal.toFixed(2)}. Thank you for trading with us!`
                      : `Subject: Tax Invoice Issued - ${activeCompany?.name || 'Company'}\n\nDear ${activeCustomer?.name || 'Customer'},\n\nPlease find the summary of your recent GST Compliant Transaction with us.\nTotal Bill Amount: INR ${totals.grandTotal.toFixed(2)}.\n\nWarm regards,\n${activeCompany?.name || 'Billing Team'}`
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-gray-800 dark:text-zinc-200 focus:outline-none"
                />
              </div>

              {copyFeedback && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Successfully copied content to clipboard!
                </div>
              )}
            </div>

            <div className="p-4 px-6 bg-gray-50 dark:bg-zinc-850 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const textToCopy = activeShareModal === 'whatsapp'
                    ? `Dear ${activeCustomer?.name || 'Customer'}, Tax Invoice from ${activeCompany?.name || 'us'} has been issued. Total Invoice Cost: INR ${totals.grandTotal.toFixed(2)}. Thank you for trading with us!`
                    : `Subject: Tax Invoice Issued - ${activeCompany?.name || 'Company'}\n\nDear ${activeCustomer?.name || 'Customer'},\n\nPlease find the summary of your recent GST Compliant Transaction with us.\nTotal Bill Amount: INR ${totals.grandTotal.toFixed(2)}.\n\nWarm regards,\n${activeCompany?.name || 'Billing Team'}`;
                  navigator.clipboard.writeText(textToCopy);
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 3000);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 text-gray-800 dark:text-zinc-200 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Text
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setActiveShareModal(null); setCopyFeedback(false); }}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold hover:cursor-pointer"
                >
                  Close
                </button>
                {activeShareModal === 'whatsapp' ? (
                  <a
                    href={`https://api.whatsapp.com/send?phone=${activeCustomer?.phone || ''}&text=${encodeURIComponent(`Dear ${activeCustomer?.name || 'Customer'}, Tax Invoice from ${activeCompany?.name || 'us'} has been issued. Total Invoice Cost: INR ${totals.grandTotal.toFixed(2)}. Thank you for trading with us!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open WhatsApp Web
                  </a>
                ) : (
                  <a
                    href={`mailto:${activeCustomer?.email || ''}?subject=${encodeURIComponent(`Tax Invoice Issued - ${activeCompany?.name || 'Company'}`)}&body=${encodeURIComponent(`Dear ${activeCustomer?.name || 'Customer'},\n\nPlease find the summary of your recent GST Compliant Transaction with us.\nTotal Bill Amount: INR ${totals.grandTotal.toFixed(2)}.\n\nWarm regards,\n${activeCompany?.name || 'Billing Team'}`)}`}
                    className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Mail App
                  </a>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
