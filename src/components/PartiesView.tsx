/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { statesOfIndia } from '../translations';
import { 
  Users, 
  UserSquare, 
  Plus, 
  Trash2, 
  CreditCard,
  Phone,
  FileDown,
  Printer,
  X,
  Calendar,
  TrendingUp,
  Wallet,
  ChevronRight,
  UserCheck,
  Search,
  Building,
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare
} from 'lucide-react';
import { Customer, Supplier, SalesInvoice, PurchaseBill, LedgerTransaction } from '../types';
import jsPDF from 'jspdf';
import { numberToWords } from '../utils/numberToWords';

export const PartiesView: React.FC = () => {
  const isInsideIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  const triggerPrinter = (elementId: string) => {
    // If inside an iframe, the browser's sandboxing blocks window.print() completely.
    // To solve this, we open a clean, non-sandboxed popup, clone the target markup, transfer stylesheets, and print.
    if (isInsideIframe) {
      try {
        const printableElement = document.getElementById(elementId);
        if (!printableElement) {
          window.print();
          return;
        }

        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) {
          alert("Pop-up block detected! Please allow pop-ups for this site, or open this application in a new tab (using the button in the top right) to print directly.");
          window.print();
          return;
        }

        // Write template HTML. We wrap the cloned innerHTML with a div having the exact same ID so that
        // internal CSS rules from Tailwind/index.css match and render perfectly.
        printWindow.document.write(`
          <!DOCTYPE html>
          <html class="light">
          <head>
            <title>Print Document - Bharat GST Billing</title>
          </head>
          <body class="bg-white text-black p-4 md:p-8">
            <div id="${elementId}" class="max-w-4xl mx-auto">
              ${printableElement.innerHTML}
            </div>
            <script>
              window.onload = function() {
                window.focus();
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
          </html>
        `);

        // Copy all stylesheets
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
          printWindow.document.head.appendChild(el.cloneNode(true));
        });

        // Add a print window override stylesheet at the end of head to ensure elements are visible during printing
        const overrideStyle = printWindow.document.createElement('style');
        overrideStyle.textContent = `
          /* Explicitly override visibility rules in the standalone popup context */
          .statement-print-header {
            display: block !important;
            visibility: visible !important;
          }
          .statement-print-header * {
            visibility: visible !important;
          }
          @media print {
            body, body * {
              visibility: visible !important;
              opacity: 1 !important;
            }
            .statement-print-header {
              display: block !important;
              visibility: visible !important;
            }
            .print\\:hidden,
            #btn-close-statement-modal, 
            #btn-print-statement, 
            #btn-download-statement-pdf,
            #btn-statement-preset-all,
            #btn-statement-preset-month,
            #btn-statement-preset-30,
            #btn-statement-preset-custom,
            #stmt-start-date,
            #stmt-end-date,
            #btn-close-invoice-modal,
            #btn-print-invoice,
            #btn-download-invoice-pdf,
            #btn-close-purchase-modal,
            #btn-print-purchase,
            #btn-download-purchase-pdf,
            #btn-close-receipt-modal,
            #btn-print-receipt,
            #btn-download-receipt-pdf {
              display: none !important;
            }
          }
          /* Ensure backgrounds and text colors print gracefully */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Adjust overlay modal elements to layout properly on printed paper without dark overlays */
            #statement-modal-overlay,
            #invoice-print-modal-overlay,
            #purchase-print-modal-overlay,
            #receipt-print-modal-overlay {
              position: relative !important;
              inset: auto !important;
              max-height: none !important;
              overflow: visible !important;
              height: auto !important;
              width: 100% !important;
              display: block !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              background-color: white !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            /* Ensure text reads deep charcoal/black in print */
            .dark #statement-modal-overlay,
            .dark #invoice-print-modal-overlay,
            .dark #purchase-print-modal-overlay,
            .dark #receipt-print-modal-overlay,
            .dark #statement-modal-overlay *,
            .dark #invoice-print-modal-overlay *,
            .dark #purchase-print-modal-overlay *,
            .dark #receipt-print-modal-overlay * {
              color: #000000 !important;
              border-color: #e2e8f0 !important;
            }
        `;
        printWindow.document.head.appendChild(overrideStyle);

        printWindow.document.close();
        return;
      } catch (err) {
        console.warn("Iframe popup print fallback failed:", err);
      }
    }

    // Default top-level print
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  const { 
    customers, 
    suppliers, 
    transactions,
    activeCompany,
    saveCustomer, 
    saveSupplier, 
    deleteCustomer, 
    deleteSupplier,
    recordLedgerPayment,
    invoices,
    purchases,
    formatCurrency,
    countryConfig,
    t 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'SUPPLIERS' | 'CREDIT_SALES' | 'CREDIT_PURCHASE' | 'PAYMENTS'>('CUSTOMERS');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Credit summary search and filtering
  const [creditSearchQuery, setCreditSearchQuery] = useState('');
  const [creditFilterMode, setCreditFilterMode] = useState<'ALL' | 'OWED' | 'ZERO'>('ALL');
  
  // Party-wise bills list modal state
  const [selectedPartyForBills, setSelectedPartyForBills] = useState<{ type: 'CUSTOMER' | 'SUPPLIER'; data: any } | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any | null>(null);
  const [selectedPurchaseForModal, setSelectedPurchaseForModal] = useState<any | null>(null);
  
  // Payment Registration inline state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentType, setPaymentType] = useState<'PAYMENT_RECEIVED' | 'PAYMENT_MADE'>('PAYMENT_RECEIVED');
  const [paymentEntityId, setPaymentEntityId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Unified Form State (Customer & Supplier share fields)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [gstType, setGstType] = useState<'GST_REGULAR' | 'GST_COMPOSITION' | 'CONSUMER' | 'UNREGISTERED'>('CONSUMER');
  const [gstin, setGstin] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<LedgerTransaction | null>(null);

  // Computed filters for the Credit Balance Sheet Tab
  const filteredCustomersCredit = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(creditSearchQuery.toLowerCase()) || 
                          (c.phone && c.phone.includes(creditSearchQuery)) || 
                          (c.state && c.state.toLowerCase().includes(creditSearchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (creditFilterMode === 'OWED') return c.outstandingBalance > 0;
      if (creditFilterMode === 'ZERO') return c.outstandingBalance === 0;
      return true;
    });
  }, [customers, creditSearchQuery, creditFilterMode]);

  const filteredSuppliersCredit = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(creditSearchQuery.toLowerCase()) ||
                          (s.phone && s.phone.includes(creditSearchQuery)) ||
                          (s.state && s.state.toLowerCase().includes(creditSearchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (creditFilterMode === 'OWED') return s.outstandingBalance > 0;
      if (creditFilterMode === 'ZERO') return s.outstandingBalance === 0;
      return true;
    });
  }, [suppliers, creditSearchQuery, creditFilterMode]);

  const totalCustomerReceivableSum = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingBalance > 0 ? c.outstandingBalance : 0), 0);
  }, [customers]);

  const totalSupplierPayableSum = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.outstandingBalance > 0 ? s.outstandingBalance : 0), 0);
  }, [suppliers]);

  // Party credit ledger statement state
  const [selectedPartyForStatement, setSelectedPartyForStatement] = useState<{ type: 'CUSTOMER' | 'SUPPLIER'; data: any } | null>(null);
  const [statementPreset, setStatementPreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'CUSTOM'>('ALL');
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');

  // Apply statement presets
  const handleStatementPresetChange = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'CUSTOM') => {
    setStatementPreset(preset);
    const today = new Date();
    if (preset === 'ALL') {
      setStatementStartDate('');
      setStatementEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      setStatementStartDate(`${year}-${month}-01`);
      setStatementEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'LAST_30_DAYS') {
      const priorDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStatementStartDate(priorDate.toISOString().split('T')[0]);
      setStatementEndDate(today.toISOString().split('T')[0]);
    }
  };

  // Computations for Statement Ledger
  const startingBalance = useMemo(() => {
    if (!selectedPartyForStatement) return 0;
    const party = selectedPartyForStatement.data;
    const profileOpening = party.openingBalance || 0;
    
    if (!statementStartDate) return profileOpening;
    
    // Sum of all transactions prior to statementStartDate
    const startLimit = new Date(statementStartDate);
    const priorTxs = transactions.filter(t => 
      t.entityId === (selectedPartyForStatement.type === 'SUPPLIER' ? party.supplierId : party.customerId) &&
      new Date(t.date) < startLimit
    );
    
    let bal = profileOpening;
    priorTxs.forEach(t => {
      if (selectedPartyForStatement.type === 'SUPPLIER') {
        if (t.type === 'PURCHASE') {
          bal += t.amount;
        } else if (t.type === 'PAYMENT_MADE') {
          bal -= t.amount;
        }
      } else {
        if (t.type === 'SALE') {
          bal += t.amount;
        } else if (t.type === 'PAYMENT_RECEIVED') {
          bal -= t.amount;
        }
      }
    });
    
    return bal;
  }, [selectedPartyForStatement, statementStartDate, transactions]);

  const statementPeriodTransactions = useMemo(() => {
    if (!selectedPartyForStatement) return [];
    const party = selectedPartyForStatement.data;
    const partyId = selectedPartyForStatement.type === 'SUPPLIER' ? party.supplierId : party.customerId;

    const filtered = transactions.filter(t => {
      if (t.entityId !== partyId) return false;
      const txDate = new Date(t.date);
      if (statementStartDate && txDate < new Date(statementStartDate)) return false;
      if (statementEndDate) {
        const endLimit = new Date(statementEndDate);
        endLimit.setHours(23, 59, 59, 999);
        if (txDate > endLimit) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentBal = startingBalance;
    return filtered.map(t => {
      if (selectedPartyForStatement.type === 'SUPPLIER') {
        if (t.type === 'PURCHASE') {
          currentBal += t.amount;
        } else if (t.type === 'PAYMENT_MADE') {
          currentBal -= t.amount;
        }
      } else {
        if (t.type === 'SALE') {
          currentBal += t.amount;
        } else if (t.type === 'PAYMENT_RECEIVED') {
          currentBal -= t.amount;
        }
      }
      return {
        ...t,
        runningBalanceAfterTx: currentBal
      };
    });
  }, [selectedPartyForStatement, transactions, statementStartDate, statementEndDate, startingBalance]);

  // Summaries
  const totalTransactionsInPeriodSum = useMemo(() => {
    return statementPeriodTransactions
      .filter(t => t.type === 'PURCHASE' || t.type === 'SALE')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [statementPeriodTransactions]);

  const totalPaymentsMadeInPeriodSum = useMemo(() => {
    return statementPeriodTransactions
      .filter(t => t.type === 'PAYMENT_MADE' || t.type === 'PAYMENT_RECEIVED')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [statementPeriodTransactions]);

  const currentOutstandingDebt = useMemo(() => {
    return startingBalance + totalTransactionsInPeriodSum - totalPaymentsMadeInPeriodSum;
  }, [startingBalance, totalTransactionsInPeriodSum, totalPaymentsMadeInPeriodSum]);

  // Launch a WhatsApp reminder helper for customer outstanding payments
  const handleWhatsAppReminder = (customer: Customer) => {
    if (!customer.phone) {
      alert("This customer does not have a registered phone number. Please edit their profile first.");
      return;
    }
    const cleanPhone = customer.phone.replace(/[^\d+]/g, '');
    const txtMsg = `Dear ${customer.name},\n\nThis is a friendly reminder from *${activeCompany?.name || 'our billing desk'}* regarding your outstanding balance.\n\nPending Balance: *${formatCurrency(customer.outstandingBalance)}*.\n\nPlease arrange for the payment at your convenience.\n\nThank you for your business!`;
    const shareUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(txtMsg)}`;
    window.open(shareUrl, '_blank');
  };

  // Download statement as a high-fidelity PDF 
  const downloadStatementPDF = (party: any, partyType: 'CUSTOMER' | 'SUPPLIER') => {
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
    doc.text(activeCompany?.name || 'Bharat GST Billing', headerLeft, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Account Ledger Statement of Credit / Outstanding', headerLeft, y + 5);

    // Date/Time sequence
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Statement Period:`, 130, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const startStr = statementStartDate ? new Date(statementStartDate).toLocaleDateString('en-IN') : 'All Time';
    const endStr = statementEndDate ? new Date(statementEndDate).toLocaleDateString('en-IN') : 'Present';
    doc.text(`${startStr} to ${endStr}`, 130, y + 5);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN').substring(0, 5)}`, 130, y + 10);

    y += 18;

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);
    y += 8;

    // Party Information Columns
    // Column Left: Company info (Inflow payee / Billing head)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('STATEMENT FROM (Merchant):', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 5);
    doc.text(activeCompany?.address || 'Billing address', lMargin, y + 10);
    doc.text(`GSTIN: ${activeCompany?.gstin || 'N/A'}`, lMargin, y + 15);
    doc.text(`Phone: ${activeCompany?.phone || 'N/A'}`, lMargin, y + 20);

    // Column Right: Party details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(partyType === 'SUPPLIER' ? 'SUPPLIER / VENDOR DETAILS:' : 'CUSTOMER / CLIENT DETAILS:', 115, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(party.name, 115, y + 5);
    doc.text(party.address || 'No communication address on file', 115, y + 10, { maxWidth: 80 });
    doc.text(`GSTIN/UIN: ${party.gstin || 'Unregistered Party (URP)'}`, 115, y + 20);
    doc.text(`Contact Phone: ${party.phone || 'N/A'}`, 115, y + 25);

    y += 35;

    // Dynamic Summary Block in PDF
    doc.setFillColor(248, 250, 252);
    doc.rect(lMargin, y, 180, 15, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(lMargin, y, 180, 15, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('OPENING BAL (A)', lMargin + 5, y + 5);
    doc.text(partyType === 'SUPPLIER' ? 'TOTAL PURCHASES (B)' : 'TOTAL SALES (B)', lMargin + 50, y + 5);
    doc.text(partyType === 'SUPPLIER' ? 'TOTAL PAID (C)' : 'TOTAL RECEIVED (C)', lMargin + 95, y + 5);
    doc.text('NET OUTSTANDING (A+B-C)', lMargin + 138, y + 5);

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`INR ${startingBalance.toFixed(2)}`, lMargin + 5, y + 11);
    doc.text(`INR ${totalTransactionsInPeriodSum.toFixed(2)}`, lMargin + 50, y + 11);
    doc.text(`INR ${totalPaymentsMadeInPeriodSum.toFixed(2)}`, lMargin + 95, y + 11);
    
    doc.setTextColor(partyType === 'SUPPLIER' ? 220 : 15, partyType === 'SUPPLIER' ? 38 : 116, partyType === 'SUPPLIER' ? 38 : 59); // Color highlights
    doc.text(`INR ${currentOutstandingDebt.toFixed(2)}`, lMargin + 138, y + 11);

    y += 22;

    // Table Headers
    doc.setFillColor(30, 41, 59); // Slate Dark Header
    doc.rect(lMargin, y, 180, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Date', lMargin + 3, y + 5);
    doc.text('Tx Type', lMargin + 25, y + 5);
    doc.text('Reference No', lMargin + 55, y + 5);
    doc.text(partyType === 'SUPPLIER' ? 'Debit (Payment)' : 'Credit (Cleared)', lMargin + 95, y + 5);
    doc.text(partyType === 'SUPPLIER' ? 'Credit (Bills)' : 'Debit (Invoices)', lMargin + 125, y + 5);
    doc.text('Outstanding (INR)', lMargin + 155, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    // Draw Starting Balance Line
    doc.setDrawColor(241, 245, 249);
    doc.line(lMargin, y, 195, y);
    doc.setFont('helvetica', 'bold');
    doc.text(statementStartDate ? new Date(statementStartDate).toLocaleDateString('en-IN') : 'Beginning', lMargin + 3, y + 5);
    doc.text('OPENING BALANCE', lMargin + 25, y + 5);
    doc.text('-', lMargin + 55, y + 5);
    doc.text('-', lMargin + 95, y + 5);
    doc.text('-', lMargin + 125, y + 5);
    doc.text(startingBalance.toFixed(2), lMargin + 155, y + 5);
    doc.setFont('helvetica', 'normal');
    y += 7;

    // Rows
    statementPeriodTransactions.forEach((tx) => {
      // Create new page if overflows page bounds
      if (y > 265) {
        doc.addPage();
        y = 20;
        // Draw Header bar again
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 8, 'F');
        y += 8;
      }

      doc.line(lMargin, y, 195, y);
      doc.text(new Date(tx.date).toLocaleDateString('en-IN'), lMargin + 3, y + 5);
      
      let typeLabel = '';
      if (tx.type === 'PURCHASE') typeLabel = 'Purchase Bill';
      else if (tx.type === 'SALE') typeLabel = 'Sales Invoice';
      else if (tx.type === 'PAYMENT_RECEIVED') typeLabel = 'Receipt Recv';
      else if (tx.type === 'PAYMENT_MADE') typeLabel = 'Payment Paid';

      doc.text(typeLabel, lMargin + 25, y + 5);
      doc.text(tx.referenceNo || 'Voucher', lMargin + 55, y + 5);
      
      if (partyType === 'SUPPLIER') {
        const debitAmt = tx.type === 'PAYMENT_MADE' ? tx.amount.toFixed(2) : '-';
        const creditAmt = tx.type === 'PURCHASE' ? tx.amount.toFixed(2) : '-';
        doc.text(debitAmt, lMargin + 95, y + 5);
        doc.text(creditAmt, lMargin + 125, y + 5);
      } else {
        const creditAmt = tx.type === 'PAYMENT_RECEIVED' ? tx.amount.toFixed(2) : '-';
        const debitAmt = tx.type === 'SALE' ? tx.amount.toFixed(2) : '-';
        doc.text(creditAmt, lMargin + 95, y + 5);
        doc.text(debitAmt, lMargin + 125, y + 5);
      }

      doc.text(tx.runningBalanceAfterTx.toFixed(2), lMargin + 155, y + 5);
      y += 7;
    });

    // Draw End Line separator
    doc.setDrawColor(30, 41, 59);
    doc.line(lMargin, y, 195, y);
    y += 6;

    // Bottom signatures & bank account details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const bankDesc = activeCompany?.bankName 
      ? `Bank: ${activeCompany.bankName}, A/C: ${activeCompany.bankAccountNo}, IFSC: ${activeCompany.bankIfsc}`
      : 'E & O.E. Payments subject to business credit timeline limitations.';
    doc.text(bankDesc, lMargin, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('For ' + (activeCompany?.name || 'Bharat GST Billing'), 145, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('Authorized Signatory', 145, y + 18);

    doc.save(`${partyType}_Statement_${party.name.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0,10)}.pdf`);
  };

  const downloadSalesInvoicePDF = (invData: any) => {
    const doc = new jsPDF();
    const lMargin = 15;
    let y = 20;

    doc.setFillColor(30, 41, 59); // Charcoal deep slate
    doc.rect(0, 0, 210, 8, 'F');

    const hasLogo = !!activeCompany?.logoUrl;
    const headerLeft = hasLogo ? 38 : lMargin;

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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'TAX INVOICE', headerLeft, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('India GST Tax Invoice', headerLeft, y + 5);

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

    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILL FROM (Supplier):', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 5);
    doc.text(activeCompany?.address || 'Corporate Billing Address', lMargin, y + 10);
    doc.text(`GSTIN/UIN: ${activeCompany?.gstin || 'N/A'}`, lMargin, y + 15);
    doc.text(`Phone: ${activeCompany?.phone || 'N/A'}`, lMargin, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILL TO (Recipient):', 115, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(invData.customerName, 115, y + 5);
    doc.text(invData.billingAddress || 'No billing address provided', 112, y + 10, { maxWidth: 83 });
    doc.text(`GSTIN/UIN: ${invData.customerGstin || 'URP (Consumer)'}`, 115, y + 20);

    y += 32;

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
    doc.text('Total (Rs)', lMargin + 168, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    invData.items.forEach((item: any, index: number) => {
      const cleanSub = (item.price * item.qty) - item.discount;
      doc.text(String(index + 1), lMargin + 2, y + 5);
      doc.text(item.name.substring(0, 32), lMargin + 12, y + 5);
      doc.text(item.hsnCode || 'N/A', lMargin + 65, y + 5);
      doc.text(`${item.qty} ${item.unit || 'PCS'}`, lMargin + 82, y + 5);
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

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Declare: The tax coordinates and items outline matches absolute compliance standard of CGST/SGST Act 2017.', lMargin, y);
    doc.text('This is a computer generated document, no manual signature is required.', lMargin, y + 4);

    doc.save(`GST_Invoice_${invData.invoiceNumber || 'File'}.pdf`);
  };

  const downloadPurchaseBillPDF = (purData: any) => {
    const doc = new jsPDF();
    const lMargin = 15;
    let y = 20;

    doc.setFillColor(30, 41, 59); // Charcoal deep slate
    doc.rect(0, 0, 210, 8, 'F');

    const hasLogo = !!activeCompany?.logoUrl;
    const headerLeft = hasLogo ? 38 : lMargin;

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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'PURCHASE VOUCHER', headerLeft, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Inward Supply / Purchase Bill Log Entry', headerLeft, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Supplier Invoice No: ${purData.billNumber || 'N/A'}`, 125, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Inward Date: ${new Date(purData.date).toLocaleDateString('en-IN')}`, 125, y + 5);
    doc.text(`Payment Status: ${purData.paymentStatus}`, 125, y + 10);

    y += 18;

    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('INWARD TO (Receiver):', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 5);
    doc.text(activeCompany?.address || 'Corporate Billing Address', lMargin, y + 10);
    doc.text(`GSTIN/UIN: ${activeCompany?.gstin || 'N/A'}`, lMargin, y + 15);
    doc.text(`Phone: ${activeCompany?.phone || 'N/A'}`, lMargin, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('INWARD FROM (Supplier/Vendor):', 115, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(purData.supplierName, 115, y + 5);
    doc.text(`Supplier ID: ${purData.supplierId}`, 115, y + 10);
    doc.text(`GSTIN/UIN: ${purData.supplierGstin || 'URP (Consumer)'}`, 115, y + 15);

    y += 32;

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
    doc.text('Total (Rs)', lMargin + 168, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    purData.items.forEach((item: any, index: number) => {
      const cleanSub = (item.price * item.qty) - item.discount;
      doc.text(String(index + 1), lMargin + 2, y + 5);
      doc.text(item.name.substring(0, 32), lMargin + 12, y + 5);
      doc.text(item.hsnCode || 'N/A', lMargin + 65, y + 5);
      doc.text(`${item.qty} ${item.unit || 'PCS'}`, lMargin + 82, y + 5);
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Statement Summary:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Payment Mode Option: Inward Supply Ledger Record`, lMargin, y + 5);
    doc.text(`Logged In Company Database Accurately`, lMargin, y + 10);

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
    doc.text(`INR ${purData.subTotal.toFixed(2)}`, 165, y + 5);
    doc.text(`INR ${purData.cgstTotal.toFixed(2)}`, 165, y + 10);
    doc.text(`INR ${purData.sgstTotal.toFixed(2)}`, 165, y + 15);
    doc.text(`INR ${purData.igstTotal.toFixed(2)}`, 165, y + 20);
    doc.text(`INR ${purData.discountTotal.toFixed(2)}`, 165, y + 25);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`INR ${purData.grandTotal.toFixed(2)}`, 165, y + 32);

    y += 42;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Declare: Inward inventory validation confirms stock logs updating cleanly.', lMargin, y);
    doc.text('Tax credentials correspond directly to those submitted under GSTR-2.', lMargin, y + 4);

    doc.save(`Purchase_Bill_${purData.billNumber || 'File'}.pdf`);
  };

  const downloadReceiptPDF = (tx: LedgerTransaction) => {
    const doc = new jsPDF();
    const lMargin = 20;
    let y = 25;

    // Head Accent
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 10, 'F');

    const hasLogo = !!activeCompany?.logoUrl;
    const headerLeft = hasLogo ? 43 : lMargin;

    if (activeCompany?.logoUrl) {
      try {
        let format = 'PNG';
        if (activeCompany.logoUrl.includes('image/jpeg') || activeCompany.logoUrl.includes('image/jpg')) {
          format = 'JPEG';
        } else if (activeCompany.logoUrl.includes('image/webp')) {
          format = 'WEBP';
        }
        doc.addImage(activeCompany.logoUrl, format, lMargin, 14, 18, 18);
      } catch (logoErr) {
        console.warn('Failed to draw company logo on PDF:', logoErr);
      }
    }

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(30, 41, 59);
    doc.text(tx.type === 'PAYMENT_RECEIVED' ? 'PAYMENT RECEIPT' : 'PAYMENT VOUCHER', headerLeft, y);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Official Transaction Confirmation', headerLeft, y + 6);

    // Date & Receipt No
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Receipt No: ${tx.referenceNo}`, 140, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(tx.date).toLocaleDateString('en-IN')}`, 140, y + 6);

    y += 20;
    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 190, y);
    y += 10;

    // Company & Client Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('FROM:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    const companyLines = [
      activeCompany?.name || 'Company Name',
      activeCompany?.address || '',
      `Phone: ${activeCompany?.phone || 'N/A'}`,
      `GSTIN: ${activeCompany?.gstin || 'N/A'}`
    ].filter(l => l !== '');
    doc.text(companyLines, lMargin, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('TO / FOR:', 130, y);
    doc.setFont('helvetica', 'normal');
    doc.text(tx.entityName, 130, y + 5);
    doc.text(`Party ID: ${tx.entityId}`, 130, y + 10);

    y += 35;
    
    // Receipt body
    doc.setFillColor(248, 250, 252);
    doc.rect(lMargin, y, 170, 40, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(lMargin, y, 170, 40, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Amount Received:', lMargin + 5, y + 12);
    doc.setFontSize(16);
    doc.setTextColor(15, 116, 59); // Green for money
    doc.text(formatCurrency(tx.amount), lMargin + 5, y + 25);

    doc.setFont('helvetica', 'normal');
    const amtInWords = numberToWords(tx.amount);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`(In Words: ${amtInWords})`, lMargin + 5, y + 30);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text('Mode:', lMargin + 100, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.text(tx.paymentMode.replace('_', ' '), lMargin + 115, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.text('Description:', lMargin + 5, y + 34);
    doc.setFontSize(9);
    doc.text(tx.description || 'Ledger Settlement', lMargin + 30, y + 34, { maxWidth: 130 });

    y += 60;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('For ' + (activeCompany?.name || 'Authorized Signatory'), 130, y);
    doc.line(130, y + 8, 190, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Authorized Signature', 145, y + 12);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated receipt. E & O.E.', lMargin, y + 25);

    doc.save(`Receipt_${tx.referenceNo}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Firm or Client name is required!');
      return;
    }

    try {
      if (activeTab === 'CUSTOMERS') {
        await saveCustomer({
          customerId: editingId || undefined,
          name,
          phone,
          email,
          address,
          state,
          gstType,
          gstin: gstType !== 'CONSUMER' ? gstin : '',
          openingBalance,
          outstandingBalance: editingId ? 0 : openingBalance // Handle adjustment later
        });
        alert('Customer Profile Saved!');
      } else {
        await saveSupplier({
          supplierId: editingId || undefined,
          name,
          phone,
          email,
          address,
          state,
          gstin: gstin,
          openingBalance,
          outstandingBalance: editingId ? 0 : openingBalance
        });
        alert('Supplier Vendor Profile Saved!');
      }

      handleCloseForm();
    } catch (err) {
      alert('Operation failed. Review console.');
    }
  };

  const handleEdit = (party: any) => {
    setEditingId(party.customerId || party.supplierId);
    setName(party.name);
    setPhone(party.phone || '');
    setEmail(party.email || '');
    setAddress(party.address || '');
    setState(party.state);
    setGstin(party.gstin || '');
    setOpeningBalance(party.openingBalance || 0);
    if (party.gstType) setGstType(party.gstType);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string, nameName: string) => {
    if (confirm(`Are you sure you want to delete ${activeTab === 'CUSTOMERS' ? 'Customer' : 'Supplier'} Party: "${nameName}"?`)) {
      try {
        if (activeTab === 'CUSTOMERS') {
          await deleteCustomer(id);
        } else {
          await deleteSupplier(id);
        }
      } catch (err) {
        alert('Could not delete account. Validate permissions.');
      }
    }
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setState('Maharashtra');
    setGstType('CONSUMER');
    setGstin('');
    setOpeningBalance(0);
  };

  // Submit Ledger Payment Balance Adjustment
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEntityId) {
      alert('Choose target account profile.');
      return;
    }
    if (paymentAmount <= 0) {
      alert('Amount must be positive value.');
      return;
    }

    try {
      let entityName = '';
      let partyData: any = null;
      if (paymentType === 'PAYMENT_RECEIVED') {
        partyData = customers.find(c => c.customerId === paymentEntityId);
        entityName = partyData?.name || '';
      } else {
        partyData = suppliers.find(s => s.supplierId === paymentEntityId);
        entityName = partyData?.name || '';
      }

      const referenceNo = 'RCPT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      const txPayload: LedgerTransaction = {
        transactionId: 'manual_' + Date.now(),
        type: paymentType,
        referenceId: 'manual_receipt',
        referenceNo,
        entityId: paymentEntityId,
        entityName,
        amount: paymentAmount,
        date: new Date(paymentDate).toISOString(),
        paymentMode,
        description: paymentNotes || 'Ledger balance alignment adjustment'
      };

      await recordLedgerPayment(txPayload);

      alert('Payment ledger update recorded! Balance adjusted.');
      
      // Auto-open receipt modal for printing
      setSelectedTxForReceipt(txPayload);
      
      setShowPaymentForm(false);
      setPaymentAmount(0);
      setPaymentEntityId('');
      setPaymentNotes('');
    } catch (err) {
      alert('Register payment failed.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toggles bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* Toggle switch tabs */}
            <div className="flex flex-wrap bg-gray-100 dark:bg-zinc-800 p-1.5 rounded-xl w-full sm:w-auto gap-1">
          <button
            id="tab-toggle-customers"
            onClick={() => { setActiveTab('CUSTOMERS'); handleCloseForm(); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg hover:cursor-pointer transition-colors justify-center ${
              activeTab === 'CUSTOMERS' ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow' : 'text-gray-500 hover:text-gray-750'
            }`}
          >
            <Users className="w-4 h-4" />
            Customers
          </button>
          
          <button
            id="tab-toggle-suppliers"
            onClick={() => { setActiveTab('SUPPLIERS'); handleCloseForm(); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg hover:cursor-pointer transition-colors justify-center ${
              activeTab === 'SUPPLIERS' ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow' : 'text-gray-500 hover:text-gray-750'
            }`}
          >
            <UserSquare className="w-4 h-4" />
            Suppliers
          </button>

          <button
            id="tab-toggle-payments"
            onClick={() => { setActiveTab('PAYMENTS'); handleCloseForm(); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg hover:cursor-pointer transition-colors justify-center ${
              activeTab === 'PAYMENTS' ? 'bg-white dark:bg-zinc-900 text-purple-600 shadow' : 'text-gray-500 hover:text-gray-750'
            }`}
          >
            <Wallet className="w-4 h-4 text-purple-500" />
            Receipts List
          </button>

          <button
            id="tab-toggle-credit-sales"
            onClick={() => { setActiveTab('CREDIT_SALES'); handleCloseForm(); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg hover:cursor-pointer transition-colors justify-center ${
              activeTab === 'CREDIT_SALES' ? 'bg-white dark:bg-zinc-900 text-blue-650 shadow' : 'text-gray-500 hover:text-gray-750'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            Receivables (Owed)
          </button>

          <button
            id="tab-toggle-credit-purchase"
            onClick={() => { setActiveTab('CREDIT_PURCHASE'); handleCloseForm(); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg hover:cursor-pointer transition-colors justify-center ${
              activeTab === 'CREDIT_PURCHASE' ? 'bg-white dark:bg-zinc-900 text-blue-650 shadow' : 'text-gray-500 hover:text-gray-750'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-orange-500" />
            Payables (Payable)
          </button>
        </div>

        {/* Double-action buttons */}
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            id="btn-parties-payment-modal"
            onClick={() => { setShowPaymentForm(!showPaymentForm); setShowAddForm(false); }}
            className="w-1/2 sm:w-auto px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 hover:cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment Entry
          </button>
          
          <button
            id="btn-parties-add"
            onClick={() => { handleCloseForm(); setShowAddForm(true); setShowPaymentForm(false); }}
            className="w-1/2 sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 hover:cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'CUSTOMERS' ? t('addCustomer') : t('addSupplier')}
          </button>
        </div>

      </div>

      {/* Inline Section: Record payments form alignment */}
      {showPaymentForm && (
        <form onSubmit={handlePaymentSubmit} className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-800 p-6 rounded-2xl shadow">
          <h4 id="payment-receipt-title" className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4">
            Record Ledger Bill/Payment Adjustment Receipt
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            
            {/* Type */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Receipt Direction</label>
              <select
                id="payment-v-type"
                value={paymentType}
                onChange={(e: any) => {
                  setPaymentType(e.target.value);
                  setPaymentEntityId('');
                }}
                className="w-full p-2 border border-gray-205 dark:border-zinc-800 dark:bg-zinc-900 rounded-lg"
              >
                <option value="PAYMENT_RECEIVED">Payment Inflow (From Customer)</option>
                <option value="PAYMENT_MADE">Payment Outflow (To Supplier)</option>
              </select>
            </div>

            {/* Target party selection */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Account Profile</label>
              <select
                id="payment-v-entity"
                required
                value={paymentEntityId}
                onChange={(e) => setPaymentEntityId(e.target.value)}
                className="w-full p-2 border border-gray-205 dark:border-zinc-800 dark:bg-zinc-900 rounded-lg font-bold"
              >
                <option value="">-- Choose Party --</option>
                {paymentType === 'PAYMENT_RECEIVED' 
                  ? customers.map((c, idx) => <option key={idx} value={c.customerId}>{c.name} (Bal: {formatCurrency(c.outstandingBalance)})</option>)
                  : suppliers.map((s, idx) => <option key={idx} value={s.supplierId}>{s.name} (Bal: {formatCurrency(s.outstandingBalance)})</option>)
                }
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Amount ({countryConfig.currencySymbol}) *</label>
              <input
                id="payment-v-amount"
                type="number"
                min="1"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-gray-205 dark:border-zinc-800 dark:bg-zinc-900 rounded-lg text-emerald-600 font-extrabold"
              />
            </div>

            {/* Mode */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Mode</label>
              <select
                id="payment-v-mode"
                value={paymentMode}
                onChange={(e: any) => setPaymentMode(e.target.value)}
                className="w-full p-2 border border-gray-205 dark:border-zinc-800 dark:bg-zinc-900 rounded-lg"
              >
                <option value="CASH">CASH</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI (BHIM / PhonePe)</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Recorded Date</label>
              <input
                id="payment-v-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2 border border-gray-205 dark:border-zinc-800 dark:bg-zinc-900 rounded-lg"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-5 flex gap-2">
              <input
                id="payment-v-desc"
                type="text"
                placeholder="Narrative summary e.g. Bill payment cleared for ledger sync"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full p-2 border border-gray-205 dark:border-zinc-800 dark:bg-zinc-900 rounded-lg"
              />
              <button
                id="payment-v-submit"
                type="submit"
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg hover:cursor-pointer font-bold"
              >
                Post Ledger Receipt
              </button>
            </div>

          </div>
        </form>
      )}

      {/* Adding profile inline forms */}
      {showAddForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <h3 id="form-parties-title" className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">
            {editingId ? 'Modify Account Information' : `Register New ${activeTab === 'CUSTOMERS' ? 'Customer Account' : 'Supplier / Vendor Profile'}`}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PARTY / FIRM NAME *</label>
                <input
                  id="form-p-firm"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Patel Distributors"
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">MOBILE PHONE</label>
                <input
                  id="form-p-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="91xxxxxxxx"
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">EMAIL ADDRESS</label>
                <input
                  id="form-p-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">STATE / UT OF SUPPLY</label>
                <select
                  id="form-p-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white"
                >
                  {statesOfIndia.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>

              {activeTab === 'CUSTOMERS' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">GST REGISTRY CLASSIFICATION</label>
                  <select
                    id="form-p-gsttype"
                    value={gstType}
                    onChange={(e: any) => setGstType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="CONSUMER">Consumer (B2C)</option>
                    <option value="GST_REGULAR">Regular GST Registered (B2B)</option>
                    <option value="GST_COMPOSITION">Composition Taxpayer</option>
                    <option value="UNREGISTERED">Unregistered Business (B2C Large)</option>
                  </select>
                </div>
              )}

              {(activeTab === 'SUPPLIERS' || gstType !== 'CONSUMER') && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">15-Digit GSTIN Number</label>
                  <input
                    id="form-p-gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="24AAAAP1234A1Z1"
                    className={`w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border rounded-lg text-xs font-mono font-bold focus:outline-none ${
                      gstin
                        ? /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)
                          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 focus:border-emerald-500'
                          : 'border-yellow-500 text-yellow-600 focus:border-yellow-500'
                        : 'border-gray-205 dark:border-zinc-800 text-blue-600 focus:border-indigo-500'
                    }`}
                  />
                  {gstin && (
                    <p className="text-[10px] mt-1 font-sans">
                      {/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin) ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Valid Indian GSTIN format standard</span>
                      ) : (
                        <span className="text-yellow-600 dark:text-yellow-500 font-semibold">⚠ Expected 15-digit layout: State(2) + PAN(10) + Entity(1) + Z(1) + Checksum(1)</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">OPENING BALANCE SETUP ({countryConfig.currencySymbol})</label>
                  <input
                    id="form-p-open"
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="Opening Balance"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white font-bold"
                  />
                </div>
              )}

            </div>

            <div className="flex gap-2">
              <textarea
                id="form-p-address"
                placeholder="Billing/Shipping physical address details"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 text-xs rounded-lg text-gray-900 dark:text-white h-12"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                id="form-p-close"
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs rounded-lg font-semibold hover:cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                id="form-p-submit"
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-bold hover:cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Display Tables lists */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        
        {activeTab === 'CUSTOMERS' ? (
          customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs">
              <Users className="w-12 h-12 text-gray-300 stroke-1 mb-2" />
              Your customer profiles will display here. No profiles yet.
            </div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-850 bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Customer Account</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Supply Location / {countryConfig.taxName || 'GSTIN'}</th>
                    <th className="py-3 px-4 text-right">Outstanding Bal ({countryConfig.currencySymbol})</th>
                    <th className="py-3 px-4 text-center">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/40 text-gray-600 dark:text-zinc-300">
                  {customers.map((c, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/5 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-[13px] text-gray-900 dark:text-white block">{c.name}</span>
                        <span className="bg-blue-50 dark:bg-blue-900/10 text-blue-600 px-1 py-0.5 rounded text-[8px] mt-1 inline-block uppercase font-black">
                          {c.gstType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{c.phone || 'N/A'}</div>
                        <div className="text-gray-400 truncate w-40">{c.email || 'N/A'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-gray-800 dark:text-zinc-200 block">{c.state}</span>
                        {c.gstin ? (
                          <span className="font-mono text-blue-600 font-bold block mt-0.5">{c.gstin}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 block mt-0.5">Consumer Registry</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-sm text-gray-950 dark:text-white">
                        {formatCurrency(c.outstandingBalance)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          {c.outstandingBalance > 0 && (
                            <button
                              id={`btn-whatsapp-cand-${idx}`}
                              onClick={() => handleWhatsAppReminder(c)}
                              className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg border border-emerald-100/40 hover:cursor-pointer transition-colors flex items-center gap-1"
                              title="Send WhatsApp outstanding reminder"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400 font-bold" />
                              WhatsApp
                            </button>
                          )}
                          <button
                            id={`btn-statement-cand-${idx}`}
                            onClick={() => {
                              setSelectedPartyForStatement({ type: 'CUSTOMER', data: c });
                              handleStatementPresetChange('ALL');
                            }}
                            className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-100/40 hover:cursor-pointer transition-colors"
                          >
                            Statement
                          </button>
                          <button
                            id={`btn-bills-cand-${idx}`}
                            onClick={() => {
                              setSelectedPartyForBills({ type: 'CUSTOMER', data: c });
                            }}
                            className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase rounded-lg border border-indigo-100/40 hover:cursor-pointer transition-colors"
                          >
                            View Bills
                          </button>
                          <button
                            id={`btn-edit-cand-${idx}`}
                            onClick={() => handleEdit(c)}
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 rounded hover:cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            id={`btn-delete-cand-${idx}`}
                            onClick={() => handleDelete(c.customerId, c.name)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded hover:cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'SUPPLIERS' ? (
          suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs">
              <UserSquare className="w-12 h-12 text-gray-300 stroke-1 mb-2" />
              Your registered supplier vendor accounts display here.
            </div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-850 bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Supplier Firm</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">State & {countryConfig.taxName || 'GSTIN'}</th>
                    <th className="py-3 px-4 text-right">Outstanding Bal ({countryConfig.currencySymbol})</th>
                    <th className="py-3 px-4 text-center">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/40 text-gray-600 dark:text-zinc-300">
                  {suppliers.map((s, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/5 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-[13px] text-gray-900 dark:text-white">
                        {s.name}
                        <span className="block text-[9px] text-gray-400 mt-1 font-mono uppercase">ID: {s.supplierId}</span>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{s.phone || 'N/A'}</div>
                        <div className="text-gray-400 truncate w-40">{s.email || 'N/A'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-gray-800 dark:text-zinc-200 block">{s.state}</span>
                        {s.gstin ? (
                          <span className="font-mono text-amber-600 font-bold block mt-0.5">{s.gstin}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 block mt-0.5">Unregistered Vendor</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-sm text-red-600">
                        {formatCurrency(s.outstandingBalance)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          <button
                            id={`btn-statement-vend-${idx}`}
                            onClick={() => {
                              setSelectedPartyForStatement({ type: 'SUPPLIER', data: s });
                              handleStatementPresetChange('ALL');
                            }}
                            className="px-2 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:hover:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase rounded-lg border border-teal-100/40 hover:cursor-pointer transition-colors"
                          >
                            Statement
                          </button>
                          <button
                            id={`btn-bills-vend-${idx}`}
                            onClick={() => {
                              setSelectedPartyForBills({ type: 'SUPPLIER', data: s });
                            }}
                            className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase rounded-lg border border-indigo-100/40 hover:cursor-pointer transition-colors"
                          >
                            View Bills
                          </button>
                          <button
                            id={`btn-edit-vend-${idx}`}
                            onClick={() => handleEdit(s)}
                            className="p-1.5 bg-gray-50 hover:bg-gray-105 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 rounded hover:cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            id={`btn-delete-vend-${idx}`}
                            onClick={() => handleDelete(s.supplierId, s.name)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded hover:cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'CREDIT_SALES' ? (
          /* CREDIT_SALES (LENAHAI / RECEIVABLE OUTSTANDING LEDGER) */
          <div className="space-y-6">
            
            {/* Action Bar inside tab */}
            <div className="p-5 border-b border-gray-150/40 dark:border-zinc-800/40 bg-gray-50/30 dark:bg-zinc-850/5 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
                {/* Search query field */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={creditSearchQuery}
                    onChange={(e) => setCreditSearchQuery(e.target.value)}
                    placeholder="Search credit sales by client name, phone or state..."
                    className="w-full text-xs font-medium border border-gray-200 dark:border-zinc-805 dark:bg-zinc-950 py-2.5 pl-10 pr-4 rounded-xl focus:border-blue-500 focus:outline-hidden text-gray-800 dark:text-zinc-150"
                  />
                  {creditSearchQuery && (
                    <button
                      onClick={() => setCreditSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter mode toggles */}
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0 gap-1">
                  <button
                    onClick={() => setCreditFilterMode('ALL')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors hover:cursor-pointer ${
                      creditFilterMode === 'ALL' ? 'bg-white dark:bg-zinc-950 text-gray-950 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-750'
                    }`}
                  >
                    All Accounts
                  </button>
                  <button
                    onClick={() => setCreditFilterMode('OWED')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors hover:cursor-pointer ${
                      creditFilterMode === 'OWED' ? 'bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-750'
                    }`}
                  >
                    Only Outstanding
                  </button>
                  <button
                    onClick={() => setCreditFilterMode('ZERO')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors hover:cursor-pointer ${
                      creditFilterMode === 'ZERO' ? 'bg-white dark:bg-zinc-950 text-gray-650 dark:text-zinc-450 shadow-xs' : 'text-gray-500 hover:text-gray-750'
                    }`}
                  >
                    Zero Balance
                  </button>
                </div>
              </div>

              {/* Action Button: Print sales report */}
              <button
                id="btn-print-credit-sales"
                onClick={() => triggerPrinter('printable-credit-sales-report')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 hover:cursor-pointer shrink-0 transition-all font-sans"
              >
                <Printer className="w-4 h-4 animate-pulse" />
                Print Sales Outstanding
              </button>
            </div>

            {/* Customer KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 px-6 pt-2 font-sans">
              <div className="bg-emerald-50/20 dark:bg-zinc-850/15 p-4.5 rounded-2xl border border-emerald-100/35 dark:border-zinc-805 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block leading-none">Net Customer Receivables</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 block mt-1.5">{formatCurrency(totalCustomerReceivableSum)}</span>
                <span className="text-[10px] text-gray-400 block mt-1">Total pending balances from credit sales</span>
              </div>

              <div className="bg-sky-50/25 dark:bg-zinc-850/15 p-4.5 rounded-2xl border border-sky-100/20 dark:border-zinc-805 shadow-xs">
                <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest block leading-none">Active Credit Debtors</span>
                <span className="text-xl font-black text-sky-650 dark:text-sky-400 block mt-1.5">{customers.filter(c => c.outstandingBalance > 0).length} Customers</span>
                <span className="text-[10px] text-gray-400 block mt-1">Client accounts currently in credit</span>
              </div>

              <div className="bg-slate-50/40 dark:bg-zinc-850/15 p-4.5 rounded-2xl border border-slate-100/30 dark:border-zinc-850 shadow-xs">
                <span className="text-[10px] font-bold text-gray-450 uppercase tracking-widest block leading-none">Average Pending Balance</span>
                <span className="text-xl font-black text-slate-850 dark:text-zinc-200 block mt-1.5">
                  {formatCurrency(
                    customers.filter(c => c.outstandingBalance > 0).length > 0 
                      ? totalCustomerReceivableSum / customers.filter(c => c.outstandingBalance > 0).length 
                      : 0
                  )}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">Calculated across active debtors</span>
              </div>
            </div>

            {/* Customers Ledger List */}
            <div className="p-6">
              <div className="space-y-3 bg-gray-50/25 dark:bg-zinc-950/15 border border-gray-150/40 dark:border-zinc-800/40 rounded-xl p-5 font-sans">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-emerald-500 rounded-xs"></div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Customers Credit Sales List
                    </h4>
                  </div>
                  <span className="text-[10.5px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md font-black">
                    {filteredCustomersCredit.length} Records
                  </span>
                </div>

                {filteredCustomersCredit.length === 0 ? (
                  <div className="py-16 text-center text-gray-450 text-xs">
                    No matching customer credit accounts.
                  </div>
                ) : (
                  <div className="overflow-x-auto text-[11.5px] text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 text-gray-400 font-extrabold uppercase text-[9px] tracking-widest bg-gray-50/50 dark:bg-zinc-850/5">
                          <th className="py-2.5 px-3 uppercase text-[9px] text-gray-500">Customer Profile</th>
                          <th className="py-2.5 px-3 text-gray-500">State / City</th>
                          <th className="py-2.5 px-3 text-gray-500">Status</th>
                          <th className="py-2.5 px-3 text-right text-gray-500">To Receive</th>
                          <th className="py-2.5 px-3 text-center">Settings & Statements</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-105/55 dark:divide-zinc-800/40 text-gray-650 dark:text-zinc-350">
                        {filteredCustomersCredit.map((c, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/5">
                            <td className="py-3 px-3">
                              <span className="font-extrabold text-gray-900 dark:text-white block text-[13px]">{c.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{c.phone || 'No phone registered'}</span>
                            </td>
                            <td className="py-3 px-3 text-gray-550 dark:text-zinc-400 text-[11px]">
                              {c.state}
                            </td>
                            <td className="py-3 px-3">
                              {c.outstandingBalance > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-black bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 uppercase">
                                  Dues Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-black bg-gray-50 dark:bg-zinc-800 text-gray-450 uppercase">
                                  Settled
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-black font-mono text-[13.5px] text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(c.outstandingBalance)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex gap-2 justify-center items-center">
                                {c.outstandingBalance > 0 && (
                                  <button
                                    onClick={() => handleWhatsAppReminder(c)}
                                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-zinc-805 dark:hover:bg-zinc-700 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg border border-emerald-100/30 hover:cursor-pointer transition-colors flex items-center gap-1"
                                    title="Send WhatsApp outstanding reminder"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    WhatsApp
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedPartyForStatement({ type: 'CUSTOMER', data: c });
                                    handleStatementPresetChange('ALL');
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-zinc-805 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-100/30 hover:cursor-pointer transition-colors"
                                >
                                  Statement
                                </button>
                                <button
                                  onClick={() => setSelectedPartyForBills({ type: 'CUSTOMER', data: c })}
                                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-205 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-[10px] font-black uppercase rounded-lg hover:cursor-pointer transition-colors"
                                >
                                  Bills list
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-205 dark:border-zinc-700 font-bold bg-emerald-50/10 dark:bg-emerald-950/10">
                          <td colSpan={3} className="py-3 px-3 text-left uppercase text-[9.5px] font-black text-gray-550">
                            Total Filtered Receivables
                          </td>
                          <td className="py-3 px-3 text-right font-black text-[14px] text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(
                              filteredCustomersCredit.reduce((sum, c) => sum + (c.outstandingBalance > 0 ? c.outstandingBalance : 0), 0)
                            )}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* DEDICATED PRINTABLE CREDIT SALES REPORT */}
            <div id="printable-credit-sales-report" className="hidden p-6 md:p-10 font-sans tracking-tight text-black bg-white select-text text-[11px]">
              
              {/* Logo / Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-700 pb-5">
                <div className="text-left">
                  <span className="text-[10px] font-black tracking-widest text-emerald-600 uppercase">OFFICIAL COMPILATION</span>
                  <h1 className="text-2xl font-black tracking-tight mt-1 text-slate-900">
                    {activeCompany?.name || 'Bharat GST Bureau'}
                  </h1>
                  {activeCompany?.gstin && (
                    <p className="text-[10.5px] font-mono font-bold text-gray-800 mt-1.5">
                      GSTIN ID: {activeCompany.gstin}
                    </p>
                  )}
                  {activeCompany?.address && (
                    <p className="text-[10.5px] text-gray-650 mt-1 max-w-sm">
                      Address: {activeCompany.address}
                    </p>
                  )}
                  {activeCompany?.phone && (
                    <p className="text-[10.5px] text-gray-650 mt-0.5">
                      Phone Line: {activeCompany.phone} {activeCompany?.email && `• ${activeCompany.email}`}
                    </p>
                  )}
                </div>

                <div className="text-right border-l pl-5 border-gray-250">
                  <div className="flex justify-end gap-1 mb-2">
                    <span className="p-1 px-2 text-[9px] font-black uppercase bg-emerald-600 text-white rounded">CREDIT SALES LEDGER</span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Statement Date</p>
                  <p className="text-xs font-mono font-bold text-gray-900 mt-0.5">
                    {new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                  <p className="text-[10px] uppercase text-gray-400 mt-2">Active Currency</p>
                  <p className="text-xs font-mono font-black text-emerald-600 mt-0.5">
                    {countryConfig.currencyCode || 'INR'} ({countryConfig.currencySymbol || '₹'})
                  </p>
                </div>
              </div>

              {/* Title */}
              <div className="my-6">
                <h2 className="text-lg font-black text-slate-905 text-slate-900 uppercase">Outstanding Credits Report (Receivables)</h2>
                <p className="text-xs text-gray-550 mt-1 leading-relaxed">
                  Dual-ledger representation displaying comprehensive customer receivables (Credit Sales amount to receive) as maintained in corporate systems.
                </p>
              </div>

              {/* Summary box */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 mb-8 rounded-xl">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block leading-none">Total Outstanding Receivables</span>
                  <span className="text-base font-black text-emerald-700 block mt-1.5">{formatCurrency(totalCustomerReceivableSum)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-405 uppercase tracking-widest block leading-none">Active Unsettled Accounts</span>
                  <span className="text-base font-black text-slate-900 block mt-1.5">{customers.filter(c => c.outstandingBalance > 0).length} Clients Pending</span>
                </div>
              </div>

              {/* Detailed list table */}
              <table className="w-full text-left border-collapse mt-4 text-[11px]">
                <thead>
                  <tr className="border-b border-gray-350 font-extrabold uppercase text-[9px] text-gray-500 bg-gray-100">
                    <th className="py-2.5 px-3 uppercase text-[9px] text-gray-500">S.No.</th>
                    <th className="py-2.5 px-3">Client Profile Name</th>
                    <th className="py-2.5 px-3">State / Union Territory</th>
                    <th className="py-2.5 px-3 font-mono">Contact Info</th>
                    <th className="py-2.5 px-3 text-right">Receivable Dues Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.filter(c => c.outstandingBalance > 0).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 font-medium">No outstanding customer accounts found.</td>
                    </tr>
                  ) : (
                    customers.filter(c => c.outstandingBalance > 0).map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-900 block">{c.name}</span>
                          <span className="text-[8.5px] font-mono text-gray-400">ID: {c.customerId}</span>
                        </td>
                        <td className="py-2 px-3 text-gray-700">{c.state}</td>
                        <td className="py-2 px-3 font-mono text-gray-600">{c.phone || 'N/A'}</td>
                        <td className="py-2 px-3 text-right font-black font-mono text-emerald-700">{formatCurrency(c.outstandingBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-gray-50 font-black text-[12px]">
                    <td colSpan={4} className="py-2.5 px-3 uppercase text-[9px] font-black text-gray-500">Gross Total Receivables</td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-700">{formatCurrency(totalCustomerReceivableSum)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signature */}
              <div className="mt-16 flex justify-between items-center border-t border-gray-200 pt-8 text-[10px] text-gray-500">
                <p>System compilation generated via commercial ledger engine. Accounts summary audited successfully.</p>
                <div className="text-center w-48 border-t border-black pt-2 mt-4 text-black font-bold">
                  Authorized Signatory
                </div>
              </div>

            </div>

          </div>
        ) : activeTab === 'PAYMENTS' ? (
          /* ALL PAYMENTS / RECEIPTS VIEW */
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-500" />
                <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-widest">
                  Receipts & Payment Register
                </h3>
              </div>
            </div>

            {transactions.filter(t => t.type === 'PAYMENT_RECEIVED' || t.type === 'PAYMENT_MADE').length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs bg-gray-50/50 dark:bg-zinc-850/10 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                <CreditCard className="w-12 h-12 text-gray-300 stroke-1 mb-2" />
                No payments or receipts recorded yet. Use 'Record Payment Entry' button above.
              </div>
            ) : (
              <div className="border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-800/20 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Receipt No</th>
                      <th className="py-3 px-4">Party Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/40 text-[11.5px]">
                    {transactions
                      .filter(t => t.type === 'PAYMENT_RECEIVED' || t.type === 'PAYMENT_MADE')
                      .map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/5 transition-colors">
                          <td className="py-3 px-4 font-mono">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                          <td className="py-3 px-4 font-bold text-gray-900 dark:text-zinc-100 uppercase">{tx.referenceNo}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold block">{tx.entityName}</span>
                            <span className="text-[10px] text-gray-400 font-mono">ID: {tx.entityId}</span>
                          </td>
                          <td className="py-3 px-4">
                            {tx.type === 'PAYMENT_RECEIVED' ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/40">Received In</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100/40">Paid Out</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-500">{tx.paymentMode}</td>
                          <td className="py-3 px-4 text-right font-black text-gray-950 dark:text-white">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedTxForReceipt(tx)}
                              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-100/40 flex items-center gap-1 mx-auto group"
                            >
                              <Printer className="w-3 h-3 group-hover:scale-110 transition-transform" />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* CREDIT_PURCHASE ACTIVE TAB SECTION (DENAHAI / PAYABLE OUTSTANDING LEDGER) */
          <div className="space-y-6">
            
            {/* Action Bar inside tab */}
            <div className="p-5 border-b border-gray-150/40 dark:border-zinc-800/40 bg-gray-50/30 dark:bg-zinc-850/5 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
                {/* Search query field */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={creditSearchQuery}
                    onChange={(e) => setCreditSearchQuery(e.target.value)}
                    placeholder="Search credit purchases by supplier name, phone or GSTIN..."
                    className="w-full text-xs font-medium border border-gray-200 dark:border-zinc-805 dark:bg-zinc-950 py-2.5 pl-10 pr-4 rounded-xl focus:border-blue-500 focus:outline-hidden text-gray-800 dark:text-zinc-150"
                  />
                  {creditSearchQuery && (
                    <button
                      onClick={() => setCreditSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter mode toggles */}
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0 gap-1">
                  <button
                    onClick={() => setCreditFilterMode('ALL')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors hover:cursor-pointer ${
                      creditFilterMode === 'ALL' ? 'bg-white dark:bg-zinc-950 text-gray-950 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-750'
                    }`}
                  >
                    All Accounts
                  </button>
                  <button
                    onClick={() => setCreditFilterMode('OWED')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors hover:cursor-pointer ${
                      creditFilterMode === 'OWED' ? 'bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-750'
                    }`}
                  >
                    Only Outstanding
                  </button>
                  <button
                    onClick={() => setCreditFilterMode('ZERO')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors hover:cursor-pointer ${
                      creditFilterMode === 'ZERO' ? 'bg-white dark:bg-zinc-950 text-gray-650 dark:text-zinc-450 shadow-xs' : 'text-gray-500 hover:text-gray-750'
                    }`}
                  >
                    Zero Balance
                  </button>
                </div>
              </div>

              {/* Action Button: Print purchases report */}
              <button
                id="btn-print-credit-purchases"
                onClick={() => triggerPrinter('printable-credit-purchases-report')}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-755 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/10 hover:cursor-pointer shrink-0 transition-all font-sans"
              >
                <Printer className="w-4 h-4 animate-pulse" />
                Print Purchase Outstanding
              </button>
            </div>

            {/* Supplier KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 px-6 pt-2 font-sans">
              <div className="bg-orange-50/20 dark:bg-zinc-850/15 p-4.5 rounded-2xl border border-orange-100/35 dark:border-zinc-805 shadow-xs">
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest block leading-none">Net Supplier Liabilities</span>
                <span className="text-xl font-black text-orange-600 dark:text-orange-400 block mt-1.5">{formatCurrency(totalSupplierPayableSum)}</span>
                <span className="text-[10px] text-gray-400 block mt-1">Total outstanding credit purchases</span>
              </div>

              <div className="bg-amber-50/25 dark:bg-zinc-850/15 p-4.5 rounded-2xl border border-amber-100/20 dark:border-zinc-805 shadow-xs">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block leading-none">Active Credit Creditors</span>
                <span className="text-xl font-black text-amber-650 dark:text-amber-450 block mt-1.5">{suppliers.filter(s => s.outstandingBalance > 0).length} Suppliers</span>
                <span className="text-[10px] text-gray-400 block mt-1">Vendor accounts we owe balance to</span>
              </div>

              <div className="bg-slate-50/40 dark:bg-zinc-850/15 p-4.5 rounded-2xl border border-slate-100/30 dark:border-zinc-850 shadow-xs">
                <span className="text-[10px] font-bold text-gray-450 uppercase tracking-widest block leading-none">Average Liability Balance</span>
                <span className="text-xl font-black text-slate-850 dark:text-zinc-200 block mt-1.5">
                  {formatCurrency(
                    suppliers.filter(s => s.outstandingBalance > 0).length > 0 
                      ? totalSupplierPayableSum / suppliers.filter(s => s.outstandingBalance > 0).length 
                      : 0
                  )}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">Calculated across active creditors</span>
              </div>
            </div>

            {/* Suppliers Ledger List */}
            <div className="p-6">
              <div className="space-y-3 bg-gray-50/25 dark:bg-zinc-950/15 border border-gray-150/40 dark:border-zinc-800/40 rounded-xl p-5 font-sans">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-805 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-orange-500 rounded-xs"></div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Suppliers Credit Purchases List
                    </h4>
                  </div>
                  <span className="text-[10.5px] bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-md font-black">
                    {filteredSuppliersCredit.length} Records
                  </span>
                </div>

                {filteredSuppliersCredit.length === 0 ? (
                  <div className="py-16 text-center text-gray-450 text-xs">
                    No matching supplier credit accounts.
                  </div>
                ) : (
                  <div className="overflow-x-auto text-[11.5px] text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 text-gray-400 font-extrabold uppercase text-[9px] tracking-widest bg-gray-50/50 dark:bg-zinc-850/5">
                          <th className="py-2.5 px-3 uppercase text-[9px] text-gray-500">Supplier / Merchant</th>
                          <th className="py-2.5 px-3 text-gray-500">State & GSTIN</th>
                          <th className="py-2.5 px-3 text-gray-500">Status</th>
                          <th className="py-2.5 px-3 text-right text-gray-500">To Pay</th>
                          <th className="py-2.5 px-3 text-center">Settings & Statements</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-105/55 dark:divide-zinc-800/40 text-gray-650 dark:text-zinc-350">
                        {filteredSuppliersCredit.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/5">
                            <td className="py-3 px-3">
                              <span className="font-extrabold text-gray-900 dark:text-white block text-[13px]">{s.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{s.phone || 'No phone registered'}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-gray-550 dark:text-zinc-400 text-[11px] block">{s.state}</span>
                              {s.gstin ? (
                                <span className="font-mono text-orange-500 font-bold block text-[9.5px] mt-0.5">{s.gstin}</span>
                              ) : (
                                <span className="text-[9.5px] text-gray-405 block mt-0.5">Unregistered Vendor</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {s.outstandingBalance > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-black bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 uppercase">
                                  Dues Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-black bg-gray-50 dark:bg-zinc-800 text-gray-450 uppercase">
                                  Settled
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-black font-mono text-[13.5px] text-orange-600 dark:text-orange-400">
                              {formatCurrency(s.outstandingBalance)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex gap-2 justify-center items-center">
                                <button
                                  onClick={() => {
                                    setSelectedPartyForStatement({ type: 'SUPPLIER', data: s });
                                    handleStatementPresetChange('ALL');
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-zinc-805 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-100/30 hover:cursor-pointer transition-colors"
                                >
                                  Statement
                                </button>
                                <button
                                  onClick={() => setSelectedPartyForBills({ type: 'SUPPLIER', data: s })}
                                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-205 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-[10px] font-black uppercase rounded-lg hover:cursor-pointer transition-colors"
                                >
                                  Bills list
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-205 dark:border-zinc-700 font-bold bg-orange-5/10 dark:bg-orange-950/10">
                          <td colSpan={3} className="py-3 px-3 text-left uppercase text-[9.5px] font-black text-gray-550">
                            Total Filtered Payables
                          </td>
                          <td className="py-3 px-3 text-right font-black text-[14px] text-orange-600 dark:text-orange-400">
                            {formatCurrency(
                              filteredSuppliersCredit.reduce((sum, s) => sum + (s.outstandingBalance > 0 ? s.outstandingBalance : 0), 0)
                            )}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* DEDICATED PRINTABLE CREDIT PURCHASES REPORT */}
            <div id="printable-credit-purchases-report" className="hidden p-6 md:p-10 font-sans tracking-tight text-black bg-white select-text text-[11px]">
              
              {/* Logo / Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-700 pb-5">
                <div className="text-left">
                  <span className="text-[10px] font-black tracking-widest text-orange-600 uppercase">OFFICIAL COMPILATION</span>
                  <h1 className="text-2xl font-black tracking-tight mt-1 text-slate-900">
                    {activeCompany?.name || 'Bharat GST Bureau'}
                  </h1>
                  {activeCompany?.gstin && (
                    <p className="text-[10.5px] font-mono font-bold text-gray-800 mt-1.5">
                      GSTIN ID: {activeCompany.gstin}
                    </p>
                  )}
                  {activeCompany?.address && (
                    <p className="text-[10.5px] text-gray-655 mt-1 max-w-sm">
                      Address: {activeCompany.address}
                    </p>
                  )}
                  {activeCompany?.phone && (
                    <p className="text-[10.5px] text-gray-655 mt-0.5">
                      Phone Line: {activeCompany.phone} {activeCompany?.email && `• ${activeCompany.email}`}
                    </p>
                  )}
                </div>

                <div className="text-right border-l pl-5 border-gray-250">
                  <div className="flex justify-end gap-1 mb-2">
                    <span className="p-1 px-2 text-[9px] font-black uppercase bg-orange-600 text-white rounded">SUPPLIERS LEDGER</span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Statement Date</p>
                  <p className="text-xs font-mono font-bold text-gray-900 mt-0.5">
                    {new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                  <p className="text-[10px] uppercase text-gray-400 mt-2">Active Currency</p>
                  <p className="text-xs font-mono font-black text-orange-600 mt-0.5">
                    {countryConfig.currencyCode || 'INR'} ({countryConfig.currencySymbol || '₹'})
                  </p>
                </div>
              </div>

              {/* Title */}
              <div className="my-6">
                <h2 className="text-lg font-black text-slate-900 uppercase">Outstanding Liabilities Report (Payables)</h2>
                <p className="text-xs text-gray-550 mt-1 leading-relaxed">
                  Dual-ledger representation displaying comprehensive supplier payables (Credit Purchases outstanding balance) as maintained in corporate systems.
                </p>
              </div>

              {/* Summary box */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 mb-8 rounded-xl">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block leading-none">Total Outstanding Payables</span>
                  <span className="text-base font-black text-orange-600 block mt-1.5">{formatCurrency(totalSupplierPayableSum)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block leading-none">Active Unsettled Accounts</span>
                  <span className="text-base font-black text-slate-900 block mt-1.5">{suppliers.filter(s => s.outstandingBalance > 0).length} Suppliers Pending</span>
                </div>
              </div>

              {/* Detailed list table */}
              <table className="w-full text-left border-collapse mt-4 text-[11px]">
                <thead>
                  <tr className="border-b border-gray-350 font-extrabold uppercase text-[9px] text-gray-500 bg-gray-100">
                    <th className="py-2.5 px-3 uppercase text-[9px] text-gray-500">S.No.</th>
                    <th className="py-2.5 px-3">Supplier Representative</th>
                    <th className="py-2.5 px-3">GSTIN ID</th>
                    <th className="py-2.5 px-3">State / Union Territory</th>
                    <th className="py-2.5 px-3 font-mono">Contact Info</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Accumulated Dues Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {suppliers.filter(s => s.outstandingBalance > 0).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 font-medium">No outstanding supplier accounts found.</td>
                    </tr>
                  ) : (
                    suppliers.filter(s => s.outstandingBalance > 0).map((s, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 animate-none">
                          <span className="font-bold text-slate-900 block">{s.name}</span>
                          <span className="text-[8.5px] font-mono text-gray-400">ID: {s.supplierId}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-850 font-bold">{s.gstin || 'Unregistered Merchant'}</td>
                        <td className="py-2 px-3 text-gray-700">{s.state}</td>
                        <td className="py-2 px-3 font-mono text-gray-600">{s.phone || 'N/A'}</td>
                        <td className="py-2 px-3 text-right font-black font-mono text-orange-600">{formatCurrency(s.outstandingBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-gray-50 font-black text-[12px]">
                    <td colSpan={5} className="py-2.5 px-3 uppercase text-[9px] font-black text-gray-500">Gross Total Liabilities</td>
                    <td className="py-2.5 px-3 text-right font-black text-orange-600">{formatCurrency(totalSupplierPayableSum)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signature */}
              <div className="mt-16 flex justify-between items-center border-t border-gray-200 pt-8 text-[10px] text-gray-500">
                <p>System compilation generated via commercial ledger engine. Liabilities summary audited successfully.</p>
                <div className="text-center w-48 border-t border-black pt-2 mt-4 text-black font-bold">
                  Authorized Signatory
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* STATEMENT OF ACCOUNT OVERLAY MODAL */}
      {selectedPartyForStatement && (
        <div id="statement-modal-overlay" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-850 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/10 print:hidden">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block mb-0.5">
                  {selectedPartyForStatement.type === 'SUPPLIER' ? 'SUPPLIER LEDGER STATEMENT' : 'CUSTOMER LEDGER STATEMENT'}
                </span>
                <h3 className="text-base font-black text-gray-950 dark:text-white flex items-center gap-2">
                  <span>{selectedPartyForStatement.data.name}</span>
                  {selectedPartyForStatement.data.gstin && (
                    <span className="text-[10px] font-mono font-bold bg-gray-150/80 dark:bg-zinc-800/80 text-gray-600 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-gray-200/50 dark:border-zinc-700/50">
                      {selectedPartyForStatement.data.gstin}
                    </span>
                  )}
                </h3>
              </div>
              <button
                id="btn-close-statement-modal"
                onClick={() => setSelectedPartyForStatement(null)}
                className="p-2 text-gray-400 hover:text-gray-650 dark:hover:text-white rounded-xl bg-gray-100/55 dark:bg-zinc-800/55 hover:cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* Beautiful print-only Header for ledger statement */}
              <div className="statement-print-header hidden border-b-2 border-gray-200 pb-5 mb-6">
                <div className="flex justify-between items-start text-left">
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1">
                      {selectedPartyForStatement.type === 'SUPPLIER' ? 'SUPPLIER LEDGER STATEMENT' : 'CUSTOMER LEDGER STATEMENT'}
                    </span>
                    <h2 className="text-xl font-black text-gray-950 tracking-tight leading-tight">
                      {selectedPartyForStatement.data.name}
                    </h2>
                    {selectedPartyForStatement.data.gstin && (
                      <p className="text-xs font-mono font-bold text-gray-800 mt-1.5">
                        GSTIN: {selectedPartyForStatement.data.gstin}
                      </p>
                    )}
                    {selectedPartyForStatement.data.phone && (
                      <p className="text-xs text-gray-600 mt-1">
                        Phone: {selectedPartyForStatement.data.phone}
                      </p>
                    )}
                    {selectedPartyForStatement.data.email && (
                      <p className="text-xs text-gray-600 mt-1">
                        Email: {selectedPartyForStatement.data.email}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-950 uppercase tracking-tight">
                      {activeCompany?.name || "Bharat GST Billing"}
                    </p>
                    {activeCompany?.gstin && (
                      <p className="text-xs font-mono text-gray-500 mt-0.5">
                        Company GSTIN: {activeCompany.gstin}
                      </p>
                    )}
                    {activeCompany?.address && (
                      <p className="text-[10px] text-gray-500 max-w-xs mt-1 font-medium leading-tight">
                        {activeCompany.address}
                      </p>
                    )}
                    <div className="mt-4 flex flex-col items-end">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Statement Period</span>
                      <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 block mt-1">
                        {statementPreset === 'ALL' && "All Time"}
                        {statementPreset === 'THIS_MONTH' && "This Month"}
                        {statementPreset === 'LAST_30_DAYS' && "Last 30 Days"}
                        {statementPreset === 'CUSTOM' && `${statementStartDate || 'Start'} to ${statementEndDate || 'End'}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-gray-150 flex justify-between items-center text-[10px] text-gray-400 font-bold">
                  <div>
                    Generated On: <span className="font-extrabold text-gray-650">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                  <div>
                    E & O.E. Detailed digital ledger synchronized locally.
                  </div>
                </div>
              </div>

              {/* Date Filters & Controls */}
              <div className="bg-gray-50/80 dark:bg-zinc-850/30 p-4 rounded-xl border border-gray-150/40 dark:border-zinc-800/50 flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between print:hidden">
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    id="btn-statement-preset-all"
                    type="button"
                    onClick={() => handleStatementPresetChange('ALL')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all hover:cursor-pointer ${
                      statementPreset === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200/60 dark:border-zinc-750'
                    }`}
                  >
                    All Time
                  </button>
                  <button
                    id="btn-statement-preset-month"
                    type="button"
                    onClick={() => handleStatementPresetChange('THIS_MONTH')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all hover:cursor-pointer ${
                      statementPreset === 'THIS_MONTH' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200/60 dark:border-zinc-750'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    id="btn-statement-preset-30"
                    type="button"
                    onClick={() => handleStatementPresetChange('LAST_30_DAYS')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all hover:cursor-pointer ${
                      statementPreset === 'LAST_30_DAYS' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200/60 dark:border-zinc-750'
                    }`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    id="btn-statement-preset-custom"
                    type="button"
                    onClick={() => handleStatementPresetChange('CUSTOM')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all hover:cursor-pointer ${
                      statementPreset === 'CUSTOM' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200/60 dark:border-zinc-750'
                    }`}
                  >
                    Custom Dates
                  </button>
                </div>

                {statementPreset === 'CUSTOM' && (
                  <div className="flex items-center gap-2">
                    <input
                      id="stmt-start-date"
                      type="date"
                      value={statementStartDate}
                      onChange={(e) => setStatementStartDate(e.target.value)}
                      className="p-2 border border-gray-205 dark:border-zinc-805 dark:bg-zinc-900 rounded-lg text-xs"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      id="stmt-end-date"
                      type="date"
                      value={statementEndDate}
                      onChange={(e) => setStatementEndDate(e.target.value)}
                      className="p-2 border border-gray-205 dark:border-zinc-805 dark:bg-zinc-900 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                
                <div className="bg-gray-50/50 dark:bg-zinc-800/15 p-4 rounded-xl border border-gray-150/40 dark:border-zinc-800/40">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Opening Balance (A)</span>
                  <span className="text-base font-black text-gray-950 dark:text-white block mt-1.5">
                    {formatCurrency(startingBalance)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5 font-medium leading-none">Starting of query interval</span>
                </div>

                <div className="bg-gray-50/50 dark:bg-zinc-800/15 p-4 rounded-xl border border-gray-150/40 dark:border-zinc-800/40">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                    {selectedPartyForStatement.type === 'SUPPLIER' ? 'Total Purchases (B)' : 'Total Sales (B)'}
                  </span>
                  <span className="text-base font-black text-amber-600 block mt-1.5">
                    + {formatCurrency(totalTransactionsInPeriodSum)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5 font-medium leading-none">Added credit/liability</span>
                </div>

                <div className="bg-gray-50/50 dark:bg-zinc-800/15 p-4 rounded-xl border border-gray-150/40 dark:border-zinc-800/40">
                  <span className="text-[10px] font-bold text-gray-450 uppercase tracking-widest block">
                    {selectedPartyForStatement.type === 'SUPPLIER' ? 'Total Payments Out (C)' : 'Total Receipts In (C)'}
                  </span>
                  <span className="text-base font-black text-emerald-600 block mt-1.5">
                    - {formatCurrency(totalPaymentsMadeInPeriodSum)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5 font-medium leading-none">Cleared account liability</span>
                </div>

                <div className="bg-blue-50/40 dark:bg-zinc-800/40 p-4 rounded-xl border border-blue-150/30 dark:border-zinc-750 shadow-xs">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block">Net Outstanding (A+B-C)</span>
                  <span className={`text-base font-black block mt-1.5 ${selectedPartyForStatement.type === 'SUPPLIER' ? 'text-red-600 dark:text-red-400' : 'text-emerald-705 dark:text-emerald-400'}`}>
                    {formatCurrency(currentOutstandingDebt)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5 font-medium leading-none">Current ledger balance due</span>
                </div>

              </div>

              {/* Entry list ledger */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase block">Account Ledger Entry History</span>
                <div className="border border-gray-150/50 dark:border-zinc-800/60 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/70 dark:bg-zinc-800/30 border-b border-gray-100 dark:border-zinc-800 font-bold uppercase text-[9px] text-gray-400">
                        <th className="py-2.5 px-4 billing-header-print">Date</th>
                        <th className="py-2.5 px-4 billing-header-print">Type</th>
                        <th className="py-2.5 px-4 billing-header-print">Reference No</th>
                        <th className="py-2.5 px-4 text-right billing-header-print">Debit (Clearance)</th>
                        <th className="py-2.5 px-4 text-right billing-header-print">Credit (Bills)</th>
                        <th className="py-2.5 px-4 text-right billing-header-print">Outstanding Balance ({countryConfig.currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50 text-gray-650 dark:text-zinc-300">
                      
                      <tr className="bg-gray-50/15 dark:bg-zinc-850/5 font-semibold text-[10px] text-gray-400">
                        <td className="py-2 px-4 font-mono">{statementStartDate ? new Date(statementStartDate).toLocaleDateString('en-IN') : 'Beginning'}</td>
                        <td className="py-2 px-4 uppercase tracking-wider text-[9px] font-black">OPENING POSITION</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4 text-right">-</td>
                        <td className="py-2 px-4 text-right">-</td>
                        <td className="py-2 px-4 text-right font-bold text-gray-700 dark:text-zinc-200">
                          {formatCurrency(startingBalance)}
                        </td>
                      </tr>

                      {statementPeriodTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-400 font-medium">No ledger transactions recorded within this interval.</td>
                        </tr>
                      ) : (
                        statementPeriodTransactions.map((tx, idx) => {
                          const isPurchase = tx.type === 'PURCHASE';
                          const isSale = tx.type === 'SALE';
                          const isPaymentMade = tx.type === 'PAYMENT_MADE';
                          const isPaymentReceived = tx.type === 'PAYMENT_RECEIVED';

                          let debitVal = '-';
                          let creditVal = '-';

                          if (selectedPartyForStatement.type === 'SUPPLIER') {
                            debitVal = isPaymentMade ? formatCurrency(tx.amount) : '-';
                            creditVal = isPurchase ? formatCurrency(tx.amount) : '-';
                          } else {
                            debitVal = isSale ? formatCurrency(tx.amount) : '-';
                            creditVal = isPaymentReceived ? formatCurrency(tx.amount) : '-';
                          }

                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/5 transition-colors">
                              <td className="py-3 px-4 font-mono">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                              <td className="py-3 px-4 font-bold">
                                {isPurchase && (
                                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-md border border-amber-200/40">Purchase Bill</span>
                                )}
                                {isSale && (
                                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-100/40">Sales Invoice</span>
                                )}
                                {isPaymentMade && (
                                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 rounded-md border border-purple-100/40">Payment Out</span>
                                )}
                                {isPaymentReceived && (
                                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-100/40">Payment In</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white uppercase flex items-center justify-between gap-2">
                                <span>{tx.referenceNo || 'VOUCHER'}</span>
                                {(isPaymentMade || isPaymentReceived) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTxForReceipt(tx);
                                    }}
                                    className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 transition-colors print:hidden flex items-center gap-1 border border-transparent hover:border-blue-100 group"
                                    title="View/Print Receipt"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span className="text-[8px] font-black uppercase hidden group-hover:inline">Receipt</span>
                                  </button>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-gray-500 dark:text-zinc-400">{debitVal}</td>
                              <td className="py-3 px-4 text-right font-mono text-gray-500 dark:text-zinc-400">{creditVal}</td>
                              <td className="py-3 px-4 text-right font-mono font-black text-gray-950 dark:text-white">
                                {formatCurrency(tx.runningBalanceAfterTx)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/10 border-t border-gray-100 dark:border-zinc-850 flex items-center justify-between pointer-events-auto print:hidden">
              <span className="text-[10px] text-gray-400 font-bold hidden sm:inline-block">
                {isInsideIframe ? "💡 If browser printing is blocked, click 'Statement PDF' to the right!" : "E & O.E. Detailed digital ledger synchronized locally."}
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  id="btn-print-statement"
                  type="button"
                  onClick={() => triggerPrinter('statement-modal-overlay')}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-xl border border-gray-200/60 dark:border-zinc-750 flex items-center justify-center gap-1.5 hover:cursor-pointer shadow-xs transition-all text-xs w-full sm:w-auto"
                >
                  <Printer className="w-4 h-4 text-gray-500" />
                  <span>Print Statement</span>
                </button>
                <button
                  id="btn-download-statement-pdf"
                  type="button"
                  onClick={() => downloadStatementPDF(selectedPartyForStatement.data, selectedPartyForStatement.type)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 hover:cursor-pointer shadow-md shadow-blue-500/10 transition-all text-xs w-full sm:w-auto"
                >
                  <FileDown className="w-4 h-4 text-white" />
                  <span>Statement PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PARTY-WISE BILLS OVERLAY MODAL */}
      {selectedPartyForBills && (
        <div id="party-bills-modal-overlay" className="fixed inset-0 z-40 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-850 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 block mb-0.5">
                  {selectedPartyForBills.type === 'SUPPLIER' ? 'SUPPLIER PURCHASE BILLS' : 'CUSTOMER SALES BILLS'}
                </span>
                <h3 className="text-base font-black text-gray-950 dark:text-white flex items-center gap-2">
                  <span>{selectedPartyForBills.data.name}</span>
                  {selectedPartyForBills.data.gstin && (
                    <span className="text-[10px] font-mono font-bold bg-gray-150/80 dark:bg-zinc-800/80 text-gray-600 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-gray-200/50 dark:border-zinc-700/50">
                      {selectedPartyForBills.data.gstin}
                    </span>
                  )}
                </h3>
              </div>
              <button
                id="btn-close-party-bills-modal"
                onClick={() => setSelectedPartyForBills(null)}
                className="p-2 text-gray-400 hover:text-gray-650 dark:hover:text-white rounded-xl bg-gray-100/55 dark:bg-zinc-800/55 hover:cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* Bills List Table */}
              <div className="border border-gray-150/50 dark:border-zinc-800/60 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/70 dark:bg-zinc-800/30 border-b border-gray-100 dark:border-zinc-800 font-bold uppercase text-[9px] text-gray-400">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4 font-bold">Bill/Invoice Number</th>
                      <th className="py-2.5 px-4 text-center font-bold">Items Count</th>
                      <th className="py-2.5 px-4 text-right">Total Amount ({countryConfig.currencySymbol})</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                      <th className="py-2.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50 text-gray-650 dark:text-zinc-300 font-medium">
                    {(() => {
                      const partyId = selectedPartyForBills.type === 'SUPPLIER' 
                        ? selectedPartyForBills.data.supplierId 
                        : selectedPartyForBills.data.customerId;
                      
                      const partyBills = selectedPartyForBills.type === 'SUPPLIER'
                        ? purchases.filter(p => p.supplierId === partyId)
                        : invoices.filter(i => i.customerId === partyId);

                      if (partyBills.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                              No bills generated or recorded for this party.
                            </td>
                          </tr>
                        );
                      }

                      return partyBills.map((bill: any, idx: number) => {
                        const billNum = selectedPartyForBills.type === 'SUPPLIER' ? bill.billNumber : bill.invoiceNumber;
                        const itemsCount = bill.items ? bill.items.length : 0;
                        const grandTotal = bill.grandTotal;
                        const paymentStatus = bill.paymentStatus || 'UNPAID';

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/5 transition-colors">
                            <td className="py-3.5 px-4 font-mono">{new Date(bill.date).toLocaleDateString('en-IN')}</td>
                            <td className="py-3.5 px-4 font-bold font-mono text-gray-900 dark:text-white uppercase">{billNum}</td>
                            <td className="py-3.5 px-4 text-center font-mono">{itemsCount} Items</td>
                            <td className="py-3.5 px-4 text-right font-black text-gray-950 dark:text-white">
                              {formatCurrency(grandTotal)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                paymentStatus === 'PAID' 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                                  : paymentStatus === 'PARTIAL'
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                              }`}>
                                {paymentStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex gap-2 justify-center items-center">
                                <button
                                  id={`btn-viewpartybill-print-${idx}`}
                                  onClick={() => {
                                    if (selectedPartyForBills.type === 'SUPPLIER') {
                                      setSelectedPurchaseForModal(bill);
                                    } else {
                                      setSelectedInvoiceForModal(bill);
                                    }
                                  }}
                                  className="px-2 py-1 bg-gray-50 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-lg border border-gray-200/60 dark:border-zinc-750 flex items-center justify-center gap-1 hover:cursor-pointer shadow-xs transition-all text-[10px]"
                                >
                                  <Printer className="w-3.5 h-3.5 text-gray-500" />
                                  <span>Print / View</span>
                                </button>
                                <button
                                  id={`btn-viewpartybill-pdf-${idx}`}
                                  onClick={() => {
                                    if (selectedPartyForBills.type === 'SUPPLIER') {
                                      downloadPurchaseBillPDF(bill);
                                    } else {
                                      downloadSalesInvoicePDF(bill);
                                    }
                                  }}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black rounded-lg flex items-center justify-center gap-1 hover:cursor-pointer shadow-sm transition-all text-[10px]"
                                >
                                  <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/10 border-t border-gray-100 dark:border-zinc-850 flex items-center justify-between pointer-events-auto">
              <span className="text-[10px] text-gray-400 font-bold hidden sm:inline-block">
                E & O.E. Detailed digital invoices synchronized locally.
              </span>
              <button
                id="btn-close-party-bills-footer"
                type="button"
                onClick={() => setSelectedPartyForBills(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs w-full sm:w-auto"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SALES INVOICE VIEW/PRINT OVERLAY MODAL */}
      {selectedInvoiceForModal && (
        <div id="invoice-print-modal-overlay" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-850 overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/10 print:hidden text-xs">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block mb-0.5">
                  Tax Invoice Viewer
                </span>
                <h3 className="text-base font-black text-gray-950 dark:text-white">
                  Invoice {selectedInvoiceForModal.invoiceNumber}
                </h3>
              </div>
              <button
                id="btn-close-invoice-modal"
                onClick={() => setSelectedInvoiceForModal(null)}
                className="p-2 text-gray-400 hover:text-gray-650 dark:hover:text-white rounded-xl bg-gray-100/55 dark:bg-zinc-800/55 hover:cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Invoice Container */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs print:p-0 print:overflow-visible">
              
              {/* Top Banner Accent for Print */}
              <div className="hidden print:block h-2 bg-slate-850 w-full mb-4"></div>

              {/* Company & Invoice meta Header */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-start gap-4">
                  {activeCompany?.logoUrl && (
                    <img 
                      src={activeCompany.logoUrl} 
                      alt="Logo" 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 object-contain rounded-lg border border-gray-100 dark:border-zinc-850 bg-white"
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-black text-slate-805 dark:text-white print:text-black">{activeCompany?.name || 'TAX INVOICE'}</h1>
                    <p className="text-gray-400 mt-1 max-w-sm print:text-zinc-700">{activeCompany?.address || 'Corporate Billing Office'}</p>
                    <p className="text-gray-400 mt-0.5 print:text-zinc-650">GSTIN: <span className="font-semibold font-mono text-slate-700 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                    {activeCompany?.phone && <p className="text-gray-400 mt-0.5 print:text-zinc-650">Phone: {activeCompany.phone}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-705 dark:text-zinc-300 print:text-black">TAX INVOICE</h2>
                  <div className="mt-2 space-y-1 text-gray-450 dark:text-zinc-400 print:text-zinc-750 font-medium">
                    <p><span className="font-semibold text-slate-850 dark:text-white">Invoice No:</span> <span className="font-mono font-bold text-slate-900 print:text-black">{selectedInvoiceForModal.invoiceNumber}</span></p>
                    <p><span className="font-semibold text-slate-850 dark:text-white">Date:</span> {new Date(selectedInvoiceForModal.date).toLocaleDateString('en-IN')}</p>
                    <p><span className="font-semibold text-slate-850 dark:text-white">State of Supply:</span> {selectedInvoiceForModal.customerState}</p>
                    <p><span className="font-semibold text-slate-850 dark:text-white">Payment Mode:</span> {selectedInvoiceForModal.paymentMode}</p>
                    {selectedInvoiceForModal.ewayBillNo && (
                      <p><span className="font-semibold text-indigo-650 dark:text-indigo-400">E-Way Bill:</span> <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{selectedInvoiceForModal.ewayBillNo}</span></p>
                    )}
                    {selectedInvoiceForModal.vehicleNo && (
                      <p><span className="font-semibold text-slate-855 dark:text-zinc-350">Vehicle No:</span> <span className="font-mono text-gray-700 dark:text-zinc-350">{selectedInvoiceForModal.vehicleNo}</span></p>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-gray-100 dark:border-zinc-800" />

              {/* Bills From/To Details columns */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1 text-gray-500 dark:text-zinc-400">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">SUPPLIER (BILL FROM)</p>
                  <p className="font-black text-slate-900 dark:text-white print:text-black">{activeCompany?.name || 'Corporate Entity'}</p>
                  <p className="print:text-zinc-755">{activeCompany?.address || 'No office address'}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                </div>
                <div className="space-y-1 text-gray-500 dark:text-zinc-400">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">RECIPIENT (BILL TO)</p>
                  <p className="font-black text-slate-900 dark:text-white print:text-black">{selectedInvoiceForModal.customerName}</p>
                  <p className="print:text-zinc-755">{selectedInvoiceForModal.billingAddress || 'No billing address specified'}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{selectedInvoiceForModal.customerGstin || 'URP (Consumer)'}</span></p>
                </div>
              </div>

              {/* Product items list ledger */}
              <table className="w-full text-left border-collapse border border-gray-100 dark:border-zinc-800 font-sans">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800 text-slate-605 dark:text-zinc-300 font-bold uppercase text-[9px] border-b border-gray-100 dark:border-zinc-800">
                    <th className="py-2 px-3 border border-gray-100 dark:border-zinc-800">S.No</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800">Product Description</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800">HSN</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Qty</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Rate</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Discount</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-center">GST Rate</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Total ({countryConfig.currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-850/50 text-gray-650 dark:text-zinc-300">
                  {selectedInvoiceForModal.items.map((item: any, idx: number) => (
                    <tr key={idx} className="print:text-black hover:bg-gray-50/20 dark:hover:bg-zinc-800/10">
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 font-mono text-center">{idx + 1}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 font-mono text-center text-gray-400 print:text-zinc-700">{item.hsnCode}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono">{item.qty} {item.unit || 'PCS'}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono">{formatCurrency(item.price)}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono">{formatCurrency(item.discount)}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-center font-mono font-bold text-slate-700 print:text-black">{item.gstRate}%</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono font-bold text-slate-900 print:text-black">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bottom Totals Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start pt-2 font-sans">
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/10 rounded-xl space-y-1.5 border border-gray-150/40 dark:border-zinc-800/50 print:border-none print:p-0">
                    <p className="text-[10px] font-bold text-gray-450 uppercase tracking-widest leading-none">BANK ACCT TRANSFER DETAILS</p>
                    <p className="text-[11px] text-slate-800 dark:text-zinc-300 print:text-black"><span className="font-semibold text-gray-450">Bank Name:</span> {activeCompany?.bankName || 'N/A'}</p>
                    <p className="text-[11px] text-slate-800 dark:text-zinc-300 print:text-black"><span className="font-semibold text-gray-450">Account No:</span> {activeCompany?.bankAccountNo || 'N/A'}</p>
                    <p className="text-[11px] text-slate-800 dark:text-zinc-300 print:text-black"><span className="font-semibold text-gray-450">IFSC Code:</span> {activeCompany?.bankIfsc || 'N/A'}</p>
                    <p className="text-[11px] text-slate-800 dark:text-zinc-300 print:text-black"><span className="font-semibold text-gray-450">Branch:</span> {activeCompany?.bankBranch || 'N/A'}</p>
                    {activeCompany?.upiId && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono"><span className="font-semibold text-gray-450 font-sans">VPA:</span> {activeCompany.upiId}</p>
                    )}
                  </div>

                  {activeCompany?.upiId && (
                    <div className="print:hidden p-3 bg-indigo-50/35 dark:bg-zinc-850 rounded-xl border border-indigo-100/50 dark:border-zinc-800 flex items-center gap-4">
                      <div className="p-1 bg-white rounded-lg border border-gray-150">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=95x95&margin=2&data=${encodeURIComponent(
                            `upi://pay?pa=${activeCompany.upiId}&pn=${encodeURIComponent(activeCompany.name)}&am=${selectedInvoiceForModal.grandTotal}&cu=INR&tn=${selectedInvoiceForModal.invoiceNumber}`
                          )}`}
                          alt="Dynamic UPI QR Code"
                          className="w-16 h-16 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-left font-sans">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 block mb-0.5">📲 Dynamic GST scan-to-pay</span>
                        <p className="text-gray-500 dark:text-zinc-400 text-[10px] leading-snug">
                          Scan with your choice of UPI Client App (BHIM, GooglePay, PhonePe, Paytm) to clear ledger balance instantly.
                        </p>
                        <p className="text-[10px] font-mono text-gray-800 dark:text-zinc-3 font-semibold mt-1">VPA: {activeCompany.upiId}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-505">
                    <span>Taxable Subtotal:</span>
                    <span className="font-semibold text-gray-900 dark:text-white print:text-black">{formatCurrency(selectedInvoiceForModal.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-505">
                    <span>{countryConfig.stateTaxShorthand || 'CGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedInvoiceForModal.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-505">
                    <span>{countryConfig.stateTaxShorthand || 'SGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedInvoiceForModal.sgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-505">
                    <span>{countryConfig.centralTaxShorthand || 'IGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedInvoiceForModal.igstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-505">
                    <span>Discount:</span>
                    <span className="font-mono text-red-500">- {formatCurrency(selectedInvoiceForModal.discountTotal)}</span>
                  </div>
                  <div className="border-t border-gray-150 dark:border-zinc-800 pt-2 flex justify-between text-base font-black text-slate-900 dark:text-white print:text-black">
                    <span>Grand Total:</span>
                    <span className="text-blue-600 dark:text-blue-400 print:text-black">{formatCurrency(selectedInvoiceForModal.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold print:text-black">
                    <span>Paid Amount:</span>
                    <span>{formatCurrency(selectedInvoiceForModal.receivedAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Declaration and Signature Blocks */}
              <div className="pt-6 border-t border-gray-100 dark:border-zinc-850 flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-400 gap-4">
                <div className="max-w-md text-left leading-normal">
                  <p className="font-semibold text-gray-500">Declaration / Terms:</p>
                  <p>1. Supply mapping corresponds with GSTR-1 parameters. Interest of 18% charged on delayed settlements.</p>
                  <p>2. Computer compiled voucher audit record, manual verification signature waived under GST Act.</p>
                </div>
                <div className="text-center sm:text-right space-y-8 w-44">
                  <span className="block border-b border-gray-200 dark:border-zinc-800 pb-1 text-slate-800 dark:text-zinc-200 print:text-black font-semibold">FOR {activeCompany?.name || 'Tax Inward Supplier'}</span>
                  <span className="block font-bold uppercase tracking-wider text-[8px] text-slate-450 pt-2">Authorized Signatory</span>
                </div>
              </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/10 border-t border-gray-100 dark:border-zinc-850 flex items-center justify-between pointer-events-auto print:hidden">
              <span className="text-[10px] text-gray-400 font-bold hidden sm:inline-block">
                {isInsideIframe ? "💡 If browser printing is blocked, click 'Download PDF' to the right!" : "E & O.E. Standard India GST-Compliant Tax Invoice."}
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  id="btn-print-invoice"
                  type="button"
                  onClick={() => triggerPrinter('invoice-print-modal-overlay')}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-xl border border-gray-200/60 dark:border-zinc-750 flex items-center justify-center gap-1.5 hover:pointer-pointer hover:cursor-pointer shadow-xs transition-all text-xs w-full sm:w-auto"
                >
                  <Printer className="w-4 h-4 text-gray-500" />
                  <span>Print Invoice</span>
                </button>
                <button
                  id="btn-download-invoice-pdf"
                  type="button"
                  onClick={() => downloadSalesInvoicePDF(selectedInvoiceForModal)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 hover:pointer-pointer hover:cursor-pointer shadow-md shadow-blue-500/10 transition-all text-xs w-full sm:w-auto"
                >
                  <FileDown className="w-4 h-4 text-white" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PURCHASE BILL VIEW/PRINT OVERLAY MODAL */}
      {selectedPurchaseForModal && (
        <div id="purchase-print-modal-overlay" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-850 overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/10 print:hidden text-xs">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block mb-0.5">
                  Inward Supply Purchase Bill
                </span>
                <h3 className="text-base font-black text-gray-950 dark:text-white">
                  Supplier Bill {selectedPurchaseForModal.billNumber}
                </h3>
              </div>
              <button
                id="btn-close-purchase-modal"
                onClick={() => setSelectedPurchaseForModal(null)}
                className="p-2 text-gray-400 hover:text-gray-650 dark:hover:text-white rounded-xl bg-gray-100/55 dark:bg-zinc-800/55 hover:cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Purchase Container */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs print:p-0 print:overflow-visible">
              
              {/* Top Banner Accent for Print */}
              <div className="hidden print:block h-2 bg-amber-600 w-full mb-4"></div>

              {/* Company & Bill meta Header */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-start gap-4">
                  {activeCompany?.logoUrl && (
                    <img 
                      src={activeCompany.logoUrl} 
                      alt="Logo" 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 object-contain rounded-lg border border-gray-100 dark:border-zinc-850 bg-white"
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-black text-slate-805 dark:text-white print:text-black">{activeCompany?.name || 'PURCHASE VOUCHER'}</h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-1 max-w-sm print:text-zinc-700">{activeCompany?.address || 'Corporate Inward Stock Office'}</p>
                    <p className="text-gray-400 mt-0.5 print:text-zinc-650">GSTIN: <span className="font-semibold font-mono text-slate-700 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                    {activeCompany?.phone && <p className="text-gray-400 mt-0.5 print:text-zinc-650">Phone: {activeCompany.phone}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-amber-600 dark:text-amber-400 print:text-black">PURCHASE BILL ENTRY</h2>
                  <div className="mt-2 space-y-1 text-gray-500 dark:text-zinc-400 print:text-zinc-750 font-medium">
                    <p><span className="font-semibold text-slate-850 dark:text-white">Supplier Invoice No:</span> <span className="font-mono font-bold text-slate-900 print:text-black">{selectedPurchaseForModal.billNumber}</span></p>
                    <p><span className="font-semibold text-slate-850 dark:text-white">Inward Date:</span> {new Date(selectedPurchaseForModal.date).toLocaleDateString('en-IN')}</p>
                    <p><span className="font-semibold text-slate-850 dark:text-white">Payment Status:</span> {selectedPurchaseForModal.paymentStatus}</p>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100 dark:border-zinc-800" />

              {/* Bills From/To Details columns */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1 text-gray-500 dark:text-zinc-400">
                  <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">SUPPLIER (BILL FROM)</p>
                  <p className="font-black text-slate-900 dark:text-white print:text-black">{selectedPurchaseForModal.supplierName}</p>
                  <p>Supplier ID: {selectedPurchaseForModal.supplierId}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{selectedPurchaseForModal.supplierGstin || 'URP (Consumer/Unregistered)'}</span></p>
                </div>
                <div className="space-y-1 text-gray-500 dark:text-zinc-450 font-medium">
                  <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">INWARD TO (BILL RECEIVER)</p>
                  <p className="font-black text-slate-900 dark:text-white print:text-black">{activeCompany?.name || 'Corporate Entity'}</p>
                  <p className="print:text-zinc-750">{activeCompany?.address || 'No office address specified'}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                </div>
              </div>

              {/* Product items list ledger */}
              <table className="w-full text-left border-collapse border border-gray-100 dark:border-zinc-800 font-sans">
                <thead>
                  <tr className="bg-amber-50/55 dark:bg-amber-950/10 text-amber-805 dark:text-amber-400 font-bold uppercase text-[9px] border-b border-gray-100 dark:border-zinc-800">
                    <th className="py-2 px-3 border border-gray-100 dark:border-zinc-800">S.No</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800">Product Description</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800">HSN</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Qty</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Rate</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Discount</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-center">GST Rate</th>
                    <th className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right">Total ({countryConfig.currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-850/50 text-gray-650 dark:text-zinc-300 font-medium">
                  {selectedPurchaseForModal.items.map((item: any, idx: number) => (
                    <tr key={idx} className="print:text-black hover:bg-gray-50/20 dark:hover:bg-zinc-800/10">
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 font-mono text-center">{idx + 1}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 font-mono text-center text-gray-400 print:text-zinc-700">{item.hsnCode}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono">{item.qty} {item.unit || 'PCS'}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono">{formatCurrency(item.price)}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono">{formatCurrency(item.discount)}</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-center font-mono font-bold text-slate-700 print:text-black">{item.gstRate}%</td>
                      <td className="py-2.5 px-3 border border-gray-100 dark:border-zinc-800 text-right font-mono font-bold text-slate-900 print:text-black">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bottom Totals Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start pt-2 font-sans">
                <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/10 rounded-xl space-y-1.5 border border-gray-150/40 dark:border-zinc-800/50 print:border-none print:p-0">
                  <p className="text-[10px] font-bold text-gray-450 uppercase tracking-widest leading-none">INWARD RECORD VERIFICATION</p>
                  <p className="text-[11px] text-slate-655 dark:text-zinc-400 leading-normal">
                    This inward billing voucher records supplies securely added to physical storage catalogs. It operates as the corporate reference log mapping against GST Input Tax Credit ledger.
                  </p>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Taxable Subtotal:</span>
                    <span className="font-semibold text-gray-900 dark:text-white print:text-black">{formatCurrency(selectedPurchaseForModal.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{countryConfig.stateTaxShorthand || 'CGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedPurchaseForModal.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{countryConfig.stateTaxShorthand || 'SGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedPurchaseForModal.sgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{countryConfig.centralTaxShorthand || 'IGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedPurchaseForModal.igstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Discount:</span>
                    <span className="font-mono text-red-500">- {formatCurrency(selectedPurchaseForModal.discountTotal)}</span>
                  </div>
                  <div className="border-t border-gray-150 dark:border-zinc-800 pt-2 flex justify-between text-base font-black text-slate-900 dark:text-white print:text-black">
                    <span>Grand Total Cost:</span>
                    <span className="text-amber-600 dark:text-amber-400 print:text-black">{formatCurrency(selectedPurchaseForModal.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold print:text-black">
                    <span>Paid to Supplier:</span>
                    <span>{formatCurrency(selectedPurchaseForModal.paidAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Declaration and Signature Blocks */}
              <div className="pt-6 border-t border-gray-100 dark:border-zinc-850 flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-400 gap-4">
                <div className="max-w-md text-left leading-normal">
                  <p className="font-semibold text-gray-500">Inward Supply Verification:</p>
                  <p>1. The goods mapped in this bill correspond precisely with the materials accepted and verified.</p>
                  <p>2. Values and CGST/SGST/IGST breakdown are synchronized with our corporate GSTR-2 matching index.</p>
                </div>
                <div className="text-center sm:text-right space-y-8 w-44">
                  <span className="block border-b border-gray-200 dark:border-zinc-800 pb-1 text-slate-800 dark:text-zinc-200 print:text-black font-semibold">STOCK CONTROLLER MANAGER</span>
                  <span className="block font-bold uppercase tracking-wider text-[8px] text-slate-450 pt-2">Verification Authority</span>
                </div>
              </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/10 border-t border-gray-150 dark:border-zinc-850 flex items-center justify-between pointer-events-auto print:hidden">
              <span className="text-[10px] text-gray-400 font-bold hidden sm:inline-block">
                {isInsideIframe ? "💡 If browser printing is blocked, click 'Download PDF' to the right!" : "E & O.E. Verified Purchase Voucher and Stock Log."}
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  id="btn-print-purchase"
                  type="button"
                  onClick={() => triggerPrinter('purchase-print-modal-overlay')}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-xl border border-gray-200/60 dark:border-zinc-750 flex items-center justify-center gap-1.5 hover:pointer-pointer hover:cursor-pointer shadow-xs transition-all text-xs w-full sm:w-auto"
                >
                  <Printer className="w-4 h-4 text-gray-500" />
                  <span>Print Receipt</span>
                </button>
                <button
                  id="btn-download-purchase-pdf"
                  type="button"
                  onClick={() => downloadPurchaseBillPDF(selectedPurchaseForModal)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 hover:pointer-pointer hover:cursor-pointer shadow-md shadow-blue-500/10 transition-all text-xs w-full sm:w-auto"
                >
                  <FileDown className="w-4 h-4 text-white" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* RECEIPT PRINTING OVERLAY MODAL */}
      {selectedTxForReceipt && (
        <div id="receipt-print-modal-overlay" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-850 overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/10 print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight">Payment Receipt</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{selectedTxForReceipt.referenceNo}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTxForReceipt(null)}
                className="p-2 text-gray-400 hover:text-gray-650 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Receipt Preview */}
            <div className="p-8 overflow-y-auto bg-gray-50/10 dark:bg-zinc-900 flex-1">
              <div id="receipt-printable-area" className="bg-white p-10 border border-gray-200 shadow-sm mx-auto max-w-xl text-black font-sans leading-relaxed select-text">
                
                {/* Receipt Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8 text-left gap-4">
                  <div className="flex items-start gap-4">
                    {activeCompany?.logoUrl && (
                      <img 
                        src={activeCompany.logoUrl} 
                        alt="Logo" 
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 object-contain rounded-lg border border-gray-100 bg-white"
                      />
                    )}
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">{activeCompany?.name}</h2>
                      <p className="text-[11px] text-gray-600 mt-1.5 max-w-xs">{activeCompany?.address}</p>
                      <div className="mt-4 space-y-1">
                        {activeCompany?.gstin && <p className="text-[11px] font-mono font-bold text-slate-800">GSTIN: {activeCompany.gstin}</p>}
                        <p className="text-[11px] text-gray-600">Ph: {activeCompany?.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded mb-3">
                      {selectedTxForReceipt.type === 'PAYMENT_RECEIVED' ? 'PAYMENT RECEIPT' : 'PAYMENT VOUCHER'}
                    </span>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Receipt No</p>
                    <p className="text-sm font-mono font-black text-slate-900">{selectedTxForReceipt.referenceNo}</p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-3">Date</p>
                    <p className="text-sm font-mono font-black text-slate-900">{new Date(selectedTxForReceipt.date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                {/* Receipt Body */}
                <div className="space-y-6 text-sm">
                  <div className="flex border-b border-gray-100 pb-4">
                    <span className="w-40 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Party / Client :</span>
                    <span className="flex-1 font-black text-slate-900 uppercase">{selectedTxForReceipt.entityName}</span>
                  </div>
                  
                  <div className="flex items-center border-b border-gray-100 pb-4">
                    <span className="w-40 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Amount In Words :</span>
                    <span className="flex-1 font-semibold italic text-slate-700">{numberToWords(selectedTxForReceipt.amount)}</span>
                  </div>

                  <div className="flex items-center border-b border-gray-100 pb-4 bg-gray-50/50 p-4 rounded-xl">
                    <span className="w-40 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Payment Mode :</span>
                    <span className="flex-1 font-black text-blue-600 uppercase tracking-widest">{selectedTxForReceipt.paymentMode.replace('_', ' ')}</span>
                  </div>

                  <div className="flex border-b border-gray-100 pb-4">
                    <span className="w-40 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Description :</span>
                    <span className="flex-1 font-medium text-slate-600 italic">{selectedTxForReceipt.description || 'Ledger Settlement Payment'}</span>
                  </div>
                </div>

                {/* Big Amount Block */}
                <div className="mt-10 py-6 px-8 border-2 border-slate-900 rounded-2xl flex items-center justify-between bg-slate-50/30">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Amount</span>
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{formatCurrency(selectedTxForReceipt.amount)}</span>
                </div>

                {/* Signature and Footer */}
                <div className="mt-16 flex justify-between items-end gap-10">
                  <div className="text-[10px] text-gray-400 italic">
                    <p>Computer generated document. No physical signature required.</p>
                    <p className="mt-0.5">Thank you for your business!</p>
                  </div>
                  <div className="text-center">
                    <div className="w-40 h-10 border-b border-slate-900 flex items-end justify-center pb-1">
                      {/* Signature Placeholder */}
                    </div>
                    <span className="mt-2 block text-[10px] font-black uppercase text-slate-900">Authorized Signatory</span>
                    <span className="text-[9px] font-bold text-gray-400 block mt-0.5">{activeCompany?.name}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/10 border-t border-gray-150 dark:border-zinc-850 flex items-center justify-end gap-3 print:hidden">
              <button
                id="btn-close-receipt-modal"
                onClick={() => setSelectedTxForReceipt(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                id="btn-print-receipt"
                onClick={() => triggerPrinter('receipt-printable-area')}
                className="px-6 py-2.5 bg-gray-150 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-xl border border-gray-200/60 dark:border-zinc-750 flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                id="btn-download-receipt-pdf"
                onClick={() => downloadReceiptPDF(selectedTxForReceipt)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all text-xs cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
