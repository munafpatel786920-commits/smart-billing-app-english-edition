/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FileCheck, 
  Calendar, 
  ArrowRightLeft, 
  Wallet, 
  Layers, 
  TrendingUp, 
  TrendingDown,
  Download,
  Filter,
  CheckCircle,
  FileDown,
  Printer,
  Eye,
  X
} from 'lucide-react';
import jsPDF from 'jspdf';
import { SalesInvoice, PurchaseBill } from '../types';

const EXPENSE_CATEGORIES = [
  { id: 'Office Rent', label: 'Office / Shop Rent' },
  { id: 'Employee Salary', label: 'Employee Salaries & Wages' },
  { id: 'Electricity & Water', label: 'Electricity & Water Utilities' },
  { id: 'Fuel & Transport', label: 'Fuel, Transport & Logistics' },
  { id: 'Office Stationery', label: 'Office Stationery & Printing' },
  { id: 'Refreshments & Food', label: 'Refreshments & Meal Allowance' },
  { id: 'Tax & Professional Fees', label: 'Taxes, Audit & Legal Fees' },
  { id: 'Miscellaneous', label: 'Miscellaneous Expenditures' }
];

const getCategoryLabel = (catId: string) => {
  const cat = EXPENSE_CATEGORIES.find(c => c.id === catId);
  return cat ? cat.label : catId || 'Miscellaneous';
};

export const ReportsView: React.FC = () => {
  const isInsideIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  const triggerPrinter = (elementId: string) => {
    // If inside an iframe, open a non-sandboxed popup and clone the element html
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
          .reports-print-header {
            display: block !important;
            visibility: visible !important;
          }
          .reports-print-header * {
            visibility: visible !important;
          }
          @media print {
            body, body * {
              visibility: visible !important;
              opacity: 1 !important;
            }
            .reports-print-header {
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
            #btn-download-purchase-pdf {
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
          #purchase-print-modal-overlay {
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
          .dark #statement-modal-overlay *,
          .dark #invoice-print-modal-overlay *,
          .dark #purchase-print-modal-overlay * {
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

    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  const { invoices, purchases, salesReturns, purchaseReturns, products, transactions, activeCompany, formatCurrency, countryConfig, t, expenses, saveExpense, capitalInvestments, customers, suppliers } = useApp();

  // Date Filters State (Daily, Monthly, Yearly, Custom)
  const [filterPreset, setFilterPreset] = useState<'ALL' | 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'>('ALL');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // Report Choosing state switcher
  const [activeReportTab, setActiveReportTab] = useState<'ALL' | 'SALES' | 'SALES_REGISTER' | 'PURCHASE' | 'PURCHASE_REGISTER' | 'RETURNS_REGISTER' | 'PL' | 'LEDGER' | 'EXPENSE'>('ALL');

  // Selected item modal tracking for viewing and printing
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<SalesInvoice | null>(null);
  const [selectedPurchaseForModal, setSelectedPurchaseForModal] = useState<PurchaseBill | null>(null);

  // States for tax payment hub
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [taxPayAmount, setTaxPayAmount] = useState('');
  const [taxPayMode, setTaxPayMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT'>('BANK_TRANSFER');
  const [taxPayDate, setTaxPayDate] = useState(new Date().toISOString().substring(0, 10));
  const [taxChallanRef, setChallanRef] = useState('');
  const [isSubmittingTaxPay, setIsSubmittingTaxPay] = useState(false);
  const [taxPaySuccessMsg, setTaxPaySuccessMsg] = useState('');

  // Native jsPDF GST Compliance Document compilation engine
  const downloadSalesInvoicePDF = (invData: SalesInvoice) => {
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

    y += 18;

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

    invData.items.forEach((item, index) => {
      const cleanSub = (item.price * item.qty) - item.discount;
      doc.text(String(index + 1), lMargin + 2, y + 5);
      doc.text(item.name.substring(0, 32), lMargin + 12, y + 5);
      doc.text(item.hsnCode, lMargin + 65, y + 5);
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

  const downloadPurchaseBillPDF = (purData: PurchaseBill) => {
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

    purData.items.forEach((item, index) => {
      const cleanSub = (item.price * item.qty) - item.discount;
      doc.text(String(index + 1), lMargin + 2, y + 5);
      doc.text(item.name.substring(0, 32), lMargin + 12, y + 5);
      doc.text(item.hsnCode, lMargin + 65, y + 5);
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
    doc.text('Inward Statement Verification:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('The supplies detailed in this bill have been securely accepted', lMargin, y + 5);
    doc.text('and registered in the stock ledger.', lMargin, y + 10);
    doc.text(`Paid to Vendor: INR ${purData.paidAmount.toFixed(2)}`, lMargin, y + 15);
    doc.text(`Outstanding Balance: INR ${(purData.grandTotal - purData.paidAmount).toFixed(2)}`, lMargin, y + 20);

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
    doc.text('Declare: The Input Tax Credit mapped corresponds precisely with the vendor invoices.', lMargin, y);
    doc.text('This is a verified in-app ledger log entry for audit and balance sheet preparation.', lMargin, y + 4);

    doc.save(`Purchase_Bill_${purData.billNumber || 'File'}.pdf`);
  };

  // Normalize dates to calculate metrics
  const activeDateRange = useMemo(() => {
    let start = new Date(0); // Epoch start
    let end = new Date('2100-01-01');

    const todayStr = new Date().toISOString().split('T')[0];
    const curYear = new Date().getFullYear();
    const curMonth = new Date().getMonth(); // 0-indexed

    if (filterPreset === 'DAILY') {
      start = new Date(`${todayStr}T00:00:00Z`);
      end = new Date(`${todayStr}T23:59:59Z`);
    } else if (filterPreset === 'MONTHLY') {
      start = new Date(curYear, curMonth, 1);
      end = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
    } else if (filterPreset === 'YEARLY') {
      start = new Date(curYear, 0, 1);
      end = new Date(curYear, 11, 31, 23, 59, 59);
    } else if (filterPreset === 'CUSTOM' && startDateStr) {
      start = new Date(`${startDateStr}T00:00:00Z`);
      if (endDateStr) {
        end = new Date(`${endDateStr}T23:59:59Z`);
      }
    }

    return { start, end };
  }, [filterPreset, startDateStr, endDateStr]);

  // Filter Sales invoices in range
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate >= activeDateRange.start && invDate <= activeDateRange.end;
    });
  }, [invoices, activeDateRange]);

  // Filter Purchases in range
  const filteredPurchases = useMemo(() => {
    return purchases.filter(pur => {
      const purDate = new Date(pur.date);
      return purDate >= activeDateRange.start && purDate <= activeDateRange.end;
    });
  }, [purchases, activeDateRange]);

  // Filter Expenses in range
  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(exp => {
      const expDate = new Date(exp.date);
      return expDate >= activeDateRange.start && expDate <= activeDateRange.end;
    });
  }, [expenses, activeDateRange]);

  // Filter Sales Returns in range
  const filteredSalesReturns = useMemo(() => {
    return (salesReturns || []).filter(sr => {
      const srDate = new Date(sr.date);
      return srDate >= activeDateRange.start && srDate <= activeDateRange.end;
    });
  }, [salesReturns, activeDateRange]);

  // Filter Purchase Returns in range
  const filteredPurchaseReturns = useMemo(() => {
    return (purchaseReturns || []).filter(pr => {
      const prDate = new Date(pr.date);
      return prDate >= activeDateRange.start && prDate <= activeDateRange.end;
    });
  }, [purchaseReturns, activeDateRange]);

  // Aggregates: Expenses Register
  const expensesSummary = useMemo(() => {
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};
    
    filteredExpenses.forEach(exp => {
      totalExpenses += exp.amount;
      if (exp.category) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      }
    });

    return { totalExpenses, categoryTotals };
  }, [filteredExpenses]);

  // Aggregates: GST Sales Returns Liabilities (GSTR-1 data structures)
  const salesGstSummary = useMemo(() => {
    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalSalesVal = 0;

    filteredInvoices.forEach(inv => {
      taxableAmount += inv.subTotal;
      cgst += inv.cgstTotal;
      sgst += inv.sgstTotal;
      igst += inv.igstTotal;
      totalSalesVal += inv.grandTotal;
    });

    return { taxableAmount, cgst, sgst, igst, totalSalesVal };
  }, [filteredInvoices]);

  // Aggregates: GST Purchases Input Tax Credit (ITC breakdown)
  const purchaseGstSummary = useMemo(() => {
    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalPurchasesVal = 0;

    filteredPurchases.forEach(pur => {
      taxableAmount += pur.subTotal;
      cgst += pur.cgstTotal;
      sgst += pur.sgstTotal;
      igst += pur.igstTotal;
      totalPurchasesVal += pur.grandTotal;
    });

    return { taxableAmount, cgst, sgst, igst, totalPurchasesVal };
  }, [filteredPurchases]);

  // Aggregates: Sales returns summary
  const salesReturnsSummary = useMemo(() => {
    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalReturnsVal = 0;

    filteredSalesReturns.forEach(sr => {
      taxableAmount += sr.subTotal || 0;
      cgst += sr.cgstTotal || 0;
      sgst += sr.sgstTotal || 0;
      igst += sr.igstTotal || 0;
      totalReturnsVal += sr.grandTotal || 0;
    });

    return { taxableAmount, cgst, sgst, igst, totalReturnsVal };
  }, [filteredSalesReturns]);

  // Aggregates: Purchase returns summary
  const purchaseReturnsSummary = useMemo(() => {
    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalReturnsVal = 0;

    filteredPurchaseReturns.forEach(pr => {
      taxableAmount += pr.subTotal || 0;
      cgst += pr.cgstTotal || 0;
      sgst += pr.sgstTotal || 0;
      igst += pr.igstTotal || 0;
      totalReturnsVal += pr.grandTotal || 0;
    });

    return { taxableAmount, cgst, sgst, igst, totalReturnsVal };
  }, [filteredPurchaseReturns]);

  // Dynamic inventory valuation (Cost Price of current inventory stock)
  const currentStockValue = useMemo(() => {
    return (products || []).reduce((sum, p) => sum + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0);
  }, [products]);

  // Initial stock evaluation (Estimated Opening Capital in form of Stock)
  const openingStockValue = useMemo(() => {
    return (products || []).reduce((sum, p) => sum + ((p.openingStock || 0) * (p.purchasePrice || 0)), 0);
  }, [products]);

  // Accounts Receivable (Outstanding money from customers)
  const accountsReceivable = useMemo(() => {
    return (customers || []).reduce((sum, customer) => sum + (customer.outstandingBalance || 0), 0);
  }, [customers]);

  // Accounts Payable (Outstanding money to suppliers)
  const accountsPayable = useMemo(() => {
    return (suppliers || []).reduce((sum, supplier) => sum + (supplier.outstandingBalance || 0), 0);
  }, [suppliers]);

  // Live cash ledger evaluation
  const currentCashBalance = useMemo(() => {
    let balance = (capitalInvestments || []).reduce((sum, item) => sum + (item.cashAmount || 0), 0);
    (transactions || []).forEach(tx => {
      if (tx.paymentMode === 'CASH') {
        if (tx.type === 'PAYMENT_RECEIVED') {
          balance += tx.amount;
        } else if (tx.type === 'PAYMENT_MADE') {
          balance -= tx.amount;
        }
      }
    });
    (expenses || []).forEach(exp => {
      if ((exp.paymentMode || 'CASH') === 'CASH') {
        balance -= exp.amount;
      }
    });
    return balance;
  }, [capitalInvestments, transactions, expenses]);

  // Live bank ledger evaluation
  const currentBankBalance = useMemo(() => {
    let balance = (capitalInvestments || []).reduce((sum, item) => sum + (item.bankAmount || 0), 0);
    (transactions || []).forEach(tx => {
      if (tx.paymentMode === 'BANK_TRANSFER' || tx.paymentMode === 'UPI') {
        if (tx.type === 'PAYMENT_RECEIVED') {
          balance += tx.amount;
        } else if (tx.type === 'PAYMENT_MADE') {
          balance -= tx.amount;
        }
      }
    });
    (expenses || []).forEach(exp => {
      if (exp.paymentMode === 'BANK_TRANSFER' || exp.paymentMode === 'UPI') {
        balance -= exp.amount;
      }
    });
    return balance;
  }, [capitalInvestments, transactions, expenses]);

  // Total introduced startup capital (Cash, Bank + estimated Opening Stock)
  const totalCapitalIntroduced = useMemo(() => {
    const cashBankCapital = (capitalInvestments || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    return cashBankCapital + openingStockValue;
  }, [capitalInvestments, openingStockValue]);

  // Aggregates: Profit & Loss summary (Sales and Purchases exclude GST as per standard accounting)
  const profitAndLoss = useMemo(() => {
    // Net Sales Revenue excluding GST (Taxable value only)
    const revenue = (salesGstSummary.taxableAmount || 0) - (salesReturnsSummary.taxableAmount || 0);
    
    // Accurate COGS calculation based on sold items (ignores unsold inventory entirely!)
    const soldCogs = filteredInvoices.reduce((sum, inv) => {
      return sum + inv.items.reduce((itemSum, item) => {
        const product = (products || []).find(p => p.productId === item.productId);
        return itemSum + (item.qty * ((product?.purchasePrice) || 0));
      }, 0);
    }, 0);

    const returnedCogs = filteredSalesReturns.reduce((sum, ret) => {
      return sum + ret.items.reduce((itemSum, item) => {
        const product = (products || []).find(p => p.productId === item.productId);
        return itemSum + (item.qty * ((product?.purchasePrice) || 0));
      }, 0);
    }, 0);

    const netCogs = soldCogs - returnedCogs;
    
    // Direct Costs represents the cost paid for the goods that were actually SOLD
    const directCosts = netCogs;
    const indirectCosts = expensesSummary.totalExpenses;
    
    // Trading Profit: Net Revenue (Excl. GST) - COGS
    const grossProfit = revenue - directCosts;
    const netProfit = grossProfit - indirectCosts;

    // Tally Style Calculations: Net Purchases excluding GST (Taxable value only)
    const netPurchases = (purchaseGstSummary.taxableAmount || 0) - (purchaseReturnsSummary.taxableAmount || 0);
    const tradingLeftTotal = openingStockValue + netPurchases;
    const tradingRightTotal = revenue + currentStockValue;
    
    const tallyGrossProfit = Math.max(0, tradingRightTotal - tradingLeftTotal);
    const tallyGrossLoss = Math.max(0, tradingLeftTotal - tradingRightTotal);
    const tradingTotal = Math.max(tradingLeftTotal, tradingRightTotal);
    
    const plLeftTotal = tallyGrossLoss + indirectCosts;
    const plRightTotal = tallyGrossProfit;
    
    const tallyNetProfit = Math.max(0, plRightTotal - plLeftTotal);
    const tallyNetLoss = Math.max(0, plLeftTotal - plRightTotal);
    const plTotal = Math.max(plLeftTotal, plRightTotal);

    // Asset Net Asset Valuation Method: (Current Cash + Bank + Stock + Receivable) minus (Payable + Owner's Invested Capital)
    const totalAssets = currentCashBalance + currentBankBalance + currentStockValue + accountsReceivable;
    const totalLiabilities = accountsPayable;
    const netAssetsValuation = totalAssets - totalLiabilities;
    const assetsBasedNetGain = netAssetsValuation - totalCapitalIntroduced;

    return {
      revenue,
      directCosts,
      indirectCosts,
      openingStock: openingStockValue,
      netPurchases,
      closingStock: currentStockValue,
      grossProfit,
      netProfit,
      tallyGrossProfit,
      tallyGrossLoss,
      tradingTotal,
      tallyNetProfit,
      tallyNetLoss,
      plTotal,
      currentCash: currentCashBalance,
      currentBank: currentBankBalance,
      accountsReceivable,
      accountsPayable,
      totalAssets,
      totalLiabilities,
      totalCapital: totalCapitalIntroduced,
      netAssetsValuation,
      assetsBasedNetGain
    };
  }, [salesGstSummary, salesReturnsSummary, purchaseGstSummary, purchaseReturnsSummary, expensesSummary, filteredInvoices, filteredSalesReturns, products, openingStockValue, currentStockValue, currentCashBalance, currentBankBalance, accountsReceivable, accountsPayable, totalCapitalIntroduced]);

  // Net GST / tax liabilities calculation
  const netGstPayable = useMemo(() => {
    const gstr1Total = (salesGstSummary.cgst || 0) + (salesGstSummary.sgst || 0) + (salesGstSummary.igst || 0);
    const gstr2Total = (purchaseGstSummary.cgst || 0) + (purchaseGstSummary.sgst || 0) + (purchaseGstSummary.igst || 0);
    const diff = gstr1Total - gstr2Total;
    return {
      gstr1Total,
      gstr2Total,
      netPayable: diff > 0 ? diff : 0,
      itcRemaining: diff < 0 ? Math.abs(diff) : 0,
    };
  }, [salesGstSummary, purchaseGstSummary]);

  const handleRecordGstPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveExpense) return;
    const amountNum = parseFloat(taxPayAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    try {
      setIsSubmittingTaxPay(true);
      await saveExpense({
        title: `GST Challan Settlement (${taxChallanRef || 'DIRECT-PAY'})`,
        category: 'Tax & Professional Fees',
        amount: amountNum,
        date: new Date(taxPayDate).toISOString(),
        paymentMode: taxPayMode,
        notes: `Government GST tax e-payment. Challan / CIN Ref: ${taxChallanRef || 'N/A'}. Recorded via e-Payment Assistant.`
      });

      setTaxPaySuccessMsg(`🎉 Successfully recorded ${formatCurrency(amountNum)} tax payment in ledger records!`);
      setTaxPayAmount('');
      setChallanRef('');
      setTimeout(() => {
        setTaxPaySuccessMsg('');
        setShowRecordPayment(false);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert("Error saving record: " + err.message);
    } finally {
      setIsSubmittingTaxPay(false);
    }
  };

  const downloadExpenseRegisterPDF = (expList: any[]) => {
    const doc = new jsPDF();
    const lMargin = 15;
    let y = 20;

    doc.setFillColor(239, 68, 68); // Rose/Red theme for expenses
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
    doc.text(activeCompany?.name || 'BUSINESS REPORT', headerLeft, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Operating General Expense Register', headerLeft, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Voucher Count: ${expList.length}`, 135, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${activeDateRange.start.toLocaleDateString('en-IN')} - ${activeDateRange.end.toLocaleDateString('en-IN')}`, 135, y + 5);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 135, y + 10);

    y += 22;

    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 195, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('LEDGER OWNER / TAXPAYER:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 5);
    doc.text(activeCompany?.address || 'Corporate Billing Address', lMargin, y + 10);
    if (activeCompany?.gstin) {
      doc.text(`GSTIN/UIN: ${activeCompany.gstin}`, lMargin, y + 15);
    }

    y += 24;

    doc.setFillColor(248, 250, 252);
    doc.rect(lMargin, y, 180, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('S.No', lMargin + 2, y + 5);
    doc.text('Date', lMargin + 15, y + 5);
    doc.text('Particular / Title', lMargin + 35, y + 5);
    doc.text('Category', lMargin + 95, y + 5);
    doc.text('Payment Via', lMargin + 140, y + 5);
    doc.text('Amount (Rs)', lMargin + 165, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    let runningTotal = 0;
    expList.forEach((exp, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFillColor(248, 250, 252);
        doc.rect(lMargin, y, 180, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('S.No', lMargin + 2, y + 5);
        doc.text('Date', lMargin + 15, y + 5);
        doc.text('Particular / Title', lMargin + 35, y + 5);
        doc.text('Category', lMargin + 95, y + 5);
        doc.text('Payment Via', lMargin + 140, y + 5);
        doc.text('Amount (Rs)', lMargin + 165, y + 5);
        y += 7;
        doc.setFont('helvetica', 'normal');
      }

      runningTotal += exp.amount;
      doc.text(String(index + 1), lMargin + 2, y + 5);
      doc.text(new Date(exp.date).toLocaleDateString('en-IN'), lMargin + 15, y + 5);
      doc.text(exp.title.substring(0, 32), lMargin + 35, y + 5);
      doc.text(getCategoryLabel(exp.category).substring(0, 22), lMargin + 95, y + 5);
      doc.text(exp.paymentMode || 'CASH', lMargin + 140, y + 5);
      doc.text(exp.amount.toFixed(2), lMargin + 165, y + 5);
      
      y += 8;
    });

    y += 4;
    doc.line(lMargin, y, 195, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL DEBITED OVERHEADS:', lMargin, y);
    doc.text(`INR ${runningTotal.toFixed(2)}`, 165, y);

    y += 15;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('Corporate expense register logs are compliant with accounting standards of inward debit tracing.', lMargin, y);
    doc.text('This is an audit compiled report generated on demand.', lMargin, y + 4);

    doc.save(`Expense_Register_Report_${new Date().toISOString().substring(0,10)}.pdf`);
  };

  const downloadSalesRegisterPDF = (invoiceList: SalesInvoice[]) => {
    const doc = new jsPDF();
    const lMargin = 10;
    let y = 20;

    // Deep Indigo top stripe
    doc.setFillColor(79, 70, 229);
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
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'BUSINESS REPORT', headerLeft, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Sales Register Ledger (GST Compliant)', headerLeft, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoices Count: ${invoiceList.length}`, 135, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${activeDateRange.start.toLocaleDateString('en-IN')} - ${activeDateRange.end.toLocaleDateString('en-IN')}`, 135, y + 5);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 135, y + 10);

    y += 22;

    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 200, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LEDGER OWNER / TAXPAYER:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 4);
    doc.text(activeCompany?.address || 'Corporate Billing Address', lMargin, y + 8);
    if (activeCompany?.gstin) {
      doc.text(`GSTIN/UIN: ${activeCompany.gstin}`, lMargin, y + 12);
    }

    y += 20;

    // Draw table header
    doc.setFillColor(243, 244, 246);
    doc.rect(lMargin, y, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text('Date', lMargin + 2, y + 5);
    doc.text('Invoice No', lMargin + 18, y + 5);
    doc.text('Party / Customer Name', lMargin + 42, y + 5);
    doc.text('Party GSTIN', lMargin + 92, y + 5);
    doc.text('Subtotal', lMargin + 118, y + 5);
    doc.text('Tax CGST/SGST/IGST', lMargin + 142, y + 5);
    doc.text('Grand Total', lMargin + 172, y + 5);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    let totSubsum = 0;
    let totTaxsum = 0;
    let totPaidsum = 0;

    invoiceList.forEach((inv, index) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
        doc.setFillColor(243, 244, 246);
        doc.rect(lMargin, y, 190, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Date', lMargin + 2, y + 5);
        doc.text('Invoice No', lMargin + 18, y + 5);
        doc.text('Party / Customer Name', lMargin + 42, y + 5);
        doc.text('Party GSTIN', lMargin + 92, y + 5);
        doc.text('Subtotal', lMargin + 118, y + 5);
        doc.text('Tax CGST/SGST/IGST', lMargin + 142, y + 5);
        doc.text('Grand Total', lMargin + 172, y + 5);
        y += 8;
        doc.setFont('helvetica', 'normal');
      }

      const rawSub = inv.subTotal || 0;
      const rawTax = (inv.cgstTotal || 0) + (inv.sgstTotal || 0) + (inv.igstTotal || 0);
      const rawTotal = inv.grandTotal || 0;

      totSubsum += rawSub;
      totTaxsum += rawTax;
      totPaidsum += rawTotal;

      doc.text(new Date(inv.date).toLocaleDateString('en-IN'), lMargin + 2, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(inv.invoiceNumber, lMargin + 18, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(inv.customerName.substring(0, 24), lMargin + 42, y + 4);
      doc.text(inv.customerGstin || 'URP', lMargin + 92, y + 4);
      doc.text(rawSub.toFixed(2), lMargin + 118, y + 4);
      doc.text(rawTax.toFixed(2), lMargin + 142, y + 4);
      doc.text(rawTotal.toFixed(2), lMargin + 172, y + 4);

      y += 6.5;
    });

    y += 2;
    doc.line(lMargin, y, 200, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL SALES OUTWARD:', lMargin + 2, y);
    doc.text(totSubsum.toFixed(2), lMargin + 118, y);
    doc.text(totTaxsum.toFixed(2), lMargin + 142, y);
    doc.text(totPaidsum.toFixed(2), lMargin + 172, y);

    y += 15;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Standard outward sales book ledger compliant with audit logs and tax liabilities.', lMargin, y);
    doc.text('Generated from automated secure billing records.', lMargin, y + 3.5);

    doc.save(`Sales_Register_Report_${new Date().toISOString().substring(0,10)}.pdf`);
  };

  const downloadPurchaseRegisterPDF = (purchaseList: PurchaseBill[]) => {
    const doc = new jsPDF();
    const lMargin = 10;
    let y = 20;

    // Deep Amber top stripe
    doc.setFillColor(217, 119, 6);
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
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'BUSINESS REPORT', headerLeft, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Purchase Register Ledger (GST Compliant)', headerLeft, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Bills Count: ${purchaseList.length}`, 135, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${activeDateRange.start.toLocaleDateString('en-IN')} - ${activeDateRange.end.toLocaleDateString('en-IN')}`, 135, y + 5);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 135, y + 10);

    y += 22;

    doc.setDrawColor(226, 232, 240);
    doc.line(lMargin, y, 200, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LEDGER OWNER / TAXPAYER:', lMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(activeCompany?.name || 'Company Name', lMargin, y + 4);
    doc.text(activeCompany?.address || 'Corporate Billing Address', lMargin, y + 8);
    if (activeCompany?.gstin) {
      doc.text(`GSTIN/UIN: ${activeCompany.gstin}`, lMargin, y + 12);
    }

    y += 20;

    // Draw table header
    doc.setFillColor(254, 243, 199); // Light amber
    doc.rect(lMargin, y, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 53, 4);
    doc.text('Date', lMargin + 2, y + 5);
    doc.text('Bill No', lMargin + 18, y + 5);
    doc.text('Supplier / Vendor Name', lMargin + 42, y + 5);
    doc.text('Supplier GSTIN', lMargin + 92, y + 5);
    doc.text('Subtotal', lMargin + 118, y + 5);
    doc.text('Tax CGST/SGST/IGST', lMargin + 142, y + 5);
    doc.text('Grand Total', lMargin + 172, y + 5);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    let totSubsum = 0;
    let totTaxsum = 0;
    let totPaidsum = 0;

    purchaseList.forEach((pur, index) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
        doc.setFillColor(254, 243, 199);
        doc.rect(lMargin, y, 190, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Date', lMargin + 2, y + 5);
        doc.text('Bill No', lMargin + 18, y + 5);
        doc.text('Supplier / Vendor Name', lMargin + 42, y + 5);
        doc.text('Supplier GSTIN', lMargin + 92, y + 5);
        doc.text('Subtotal', lMargin + 118, y + 5);
        doc.text('Tax CGST/SGST/IGST', lMargin + 142, y + 5);
        doc.text('Grand Total', lMargin + 172, y + 5);
        y += 8;
        doc.setFont('helvetica', 'normal');
      }

      const rawSub = pur.subTotal || 0;
      const rawTax = (pur.cgstTotal || 0) + (pur.sgstTotal || 0) + (pur.igstTotal || 0);
      const rawTotal = pur.grandTotal || 0;

      totSubsum += rawSub;
      totTaxsum += rawTax;
      totPaidsum += rawTotal;

      doc.text(new Date(pur.date).toLocaleDateString('en-IN'), lMargin + 2, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(pur.billNumber, lMargin + 18, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(pur.supplierName.substring(0, 24), lMargin + 42, y + 4);
      doc.text(pur.supplierGstin || 'URP', lMargin + 92, y + 4);
      doc.text(rawSub.toFixed(2), lMargin + 118, y + 4);
      doc.text(rawTax.toFixed(2), lMargin + 142, y + 4);
      doc.text(rawTotal.toFixed(2), lMargin + 172, y + 4);

      y += 6.5;
    });

    y += 2;
    doc.line(lMargin, y, 200, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL PURCHASES INWARD:', lMargin + 2, y);
    doc.text(totSubsum.toFixed(2), lMargin + 118, y);
    doc.text(totTaxsum.toFixed(2), lMargin + 142, y);
    doc.text(totPaidsum.toFixed(2), lMargin + 172, y);

    y += 15;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Standard inward purchases book ledger compliant with Input Tax Credit tracing.', lMargin, y);
    doc.text('Generated from automated secure stock replenishment logs.', lMargin, y + 3.5);

    doc.save(`Purchase_Register_Report_${new Date().toISOString().substring(0,10)}.pdf`);
  };

  const handleExportExpensesCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No database records available in current filtered range.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Particular / Title,Category,Payment Mode,Notes,Amount\n";
    filteredExpenses.forEach((exp: any) => {
      csvContent += `"${exp.date.substring(0, 10)}","${exp.title.replace(/"/g, '""')}","${getCategoryLabel(exp.category)}","${exp.paymentMode || 'CASH'}","${(exp.notes || '').replace(/"/g, '""')}",${exp.amount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expense_Register_Report_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportDataCSV = (type: 'SALES' | 'PURCHASES') => {
    const targetArr = type === 'SALES' ? filteredInvoices : filteredPurchases;
    if (targetArr.length === 0) {
      alert('No database records available in current filtered range.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    if (type === 'SALES') {
      csvContent += "Invoice Number,Date,Customer,Subtotal,CGST,SGST,IGST,Grand Total,Status\n";
      targetArr.forEach((inv: any) => {
        csvContent += `"${inv.invoiceNumber}","${inv.date.substring(0, 10)}","${inv.customerName}",${inv.subTotal},${inv.cgstTotal},${inv.sgstTotal},${inv.igstTotal},${inv.grandTotal},"${inv.paymentStatus}"\n`;
      });
    } else {
      csvContent += "Bill/Invoice Number,Date,Supplier Vendor,Subtotal,CGST,SGST,IGST,Grand Total,Status\n";
      targetArr.forEach((pur: any) => {
        csvContent += `"${pur.billNumber}","${pur.date.substring(0, 10)}","${pur.supplierName}",${pur.subTotal},${pur.cgstTotal},${pur.sgstTotal},${pur.igstTotal},${pur.grandTotal},"${pur.paymentStatus}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST_${type}_Report_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Date controls panels */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm text-xs">
        
        {/* Presets selectors */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            id="preset-all"
            onClick={() => setFilterPreset('ALL')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors ${
              filterPreset === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-gray-700'
            }`}
          >
            All Time
          </button>
          
          <button
            id="preset-daily"
            onClick={() => setFilterPreset('DAILY')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors ${
              filterPreset === 'DAILY' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
            }`}
          >
            Daily Summary
          </button>

          <button
            id="preset-monthly"
            onClick={() => setFilterPreset('MONTHLY')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors ${
              filterPreset === 'MONTHLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
            }`}
          >
            Monthly Return
          </button>

          <button
            id="preset-yearly"
            onClick={() => setFilterPreset('YEARLY')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors ${
              filterPreset === 'YEARLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
            }`}
          >
            Yearly Audit
          </button>

          <button
            id="preset-custom"
            onClick={() => setFilterPreset('CUSTOM')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors ${
              filterPreset === 'CUSTOM' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
            }`}
          >
            Interval Filters
          </button>
        </div>

        {/* Custom Date span selectors */}
        {filterPreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              id="inp-start-date"
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="p-1.5 bg-gray-50 border border-gray-200 dark:border-zinc-850 dark:bg-zinc-900 rounded"
            />
            <span className="text-gray-400">to</span>
            <input
              id="inp-end-date"
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="p-1.5 bg-gray-50 border border-gray-200 dark:border-zinc-850 dark:bg-zinc-900 rounded"
            />
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap w-full md:w-auto justify-end">
          <div className="flex gap-2 text-[11px] text-gray-400">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Active filter dates: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</span>
          </div>

          <button
            id="btn-print-full-report"
            type="button"
            onClick={() => {
              const elementMap: Record<string, string> = {
                ALL: 'reports-printable-area',
                SALES: 'gstr1-report-card',
                SALES_REGISTER: 'sales-register-report-card',
                PURCHASE: 'gstr2-report-card',
                PURCHASE_REGISTER: 'purchase-register-report-card',
                RETURNS_REGISTER: 'returns-register-report-card',
                PL: 'profit-loss-report-card',
                LEDGER: 'ledger-report-card',
                EXPENSE: 'expense-register-report-card'
              };
              triggerPrinter(elementMap[activeReportTab]);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-black rounded-xl flex items-center justify-center gap-1.5 hover:pointer-pointer hover:cursor-pointer shadow-md shadow-blue-500/15 hover:shadow-blue-500/25 transition-all text-xs print:hidden shrink-0"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print Active Report</span>
          </button>
        </div>

      </div>

      {/* Report Tab Choice Bar */}
      <div className="flex border-b border-gray-150/40 dark:border-zinc-800 gap-2 overflow-x-auto pb-0.5 print:hidden">
        {[
          { id: 'ALL', name: 'Combined Summary', color: 'border-blue-600 text-blue-600' },
          { id: 'SALES', name: `${countryConfig.taxName} Sales`, color: 'border-blue-500 text-blue-500' },
          { id: 'SALES_REGISTER', name: 'Sales Register', color: 'border-indigo-650 text-indigo-650' },
          { id: 'PURCHASE', name: `${countryConfig.taxName} Purchase`, color: 'border-amber-500 text-amber-500' },
          { id: 'PURCHASE_REGISTER', name: 'Purchase Register', color: 'border-orange-500 text-orange-500' },
          { id: 'RETURNS_REGISTER', name: 'Returns Register (Debit/Credit)', color: 'border-fuchsia-500 text-fuchsia-500' },
          { id: 'EXPENSE', name: 'Expense Register', color: 'border-rose-500 text-rose-500' },
          { id: 'PL', name: 'Profit & Loss', color: 'border-emerald-500 text-emerald-500' },
          { id: 'LEDGER', name: 'Audit Ledgers', color: 'border-slate-500 text-slate-500' },
        ].map(tab => (
          <button
            key={tab.id}
            id={`tab-repr-${tab.id}`}
            onClick={() => setActiveReportTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap hover:cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === tab.id 
                ? `${tab.color} bg-gray-50/50 dark:bg-zinc-800/10` 
                : 'border-transparent text-gray-400 hover:text-gray-500'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div id="reports-printable-area" className="space-y-6">
        
        {/* Beautiful reports-print-header for physical prints */}
        <div className="reports-print-header hidden border-b-2 border-gray-200 pb-5 mb-6 text-left">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1">
                GST & BUSINESS SUMMARY REPORT
              </span>
              <h2 className="text-xl font-black text-gray-950 tracking-tight leading-tight">
                {activeCompany?.name || "Nirmal Hardware Store"}
              </h2>
              {activeCompany?.gstin && (
                <p className="text-xs font-mono font-bold text-gray-800 mt-1.5">
                  GSTIN: {activeCompany.gstin}
                </p>
              )}
              {activeCompany?.address && (
                <p className="text-xs text-gray-650 mt-1 max-w-sm font-medium leading-tight print:text-zinc-700">
                  Address: {activeCompany.address}
                </p>
              )}
              {activeCompany?.phone && (
                <p className="text-xs text-gray-600 mt-1">
                  Phone: {activeCompany.phone}
                </p>
              )}
            </div>
            
            <div className="text-right">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Report Period Mode</span>
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 block mt-1">
                  {filterPreset === 'ALL' && "All Time"}
                  {filterPreset === 'DAILY' && "Daily Summary"}
                  {filterPreset === 'MONTHLY' && "Monthly Return"}
                  {filterPreset === 'YEARLY' && "Yearly Audit Summary"}
                  {filterPreset === 'CUSTOM' && `Custom Dates`}
                </span>
                <span className="text-xs text-gray-500 font-bold mt-2 block leading-none">
                  Period: {activeDateRange.start.toLocaleDateString('en-IN')} to {activeDateRange.end.toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-5 pt-3 border-t border-gray-150 flex justify-between items-center text-[10px] text-gray-400 font-bold">
            <div>
              Generated On: <span className="font-extrabold text-gray-650">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
            <div>
              E & O.E. Standard business transactions ledger report.
            </div>
          </div>
        </div>

        {/* Tax e-Payment & Bookkeeping Hub */}
        {(activeReportTab === 'ALL' || activeReportTab === 'SALES' || activeReportTab === 'PURCHASE') && (
          <div className="print:hidden bg-indigo-50/20 dark:bg-zinc-800/10 border border-indigo-100/35 dark:border-zinc-800/60 p-5 rounded-2xl shadow-sm space-y-4 font-sans text-xs">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block mb-1">
                  Government Tax Hub
                </span>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  Assistant for Online GST Payment & Bookkeeping
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">
                  Calculate tax due, make payments securely on the official portal, and log paid receipts so they subtract from net business profit.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>GST Portal Compliant</span>
              </div>
            </div>

            {/* Calculations Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-150/50 dark:border-zinc-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Total Tax Collected (Sales)</span>
                <span className="font-mono text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  {formatCurrency(netGstPayable.gstr1Total)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Total Tax Paid (ITC Purchases)</span>
                <span className="font-mono text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  {formatCurrency(netGstPayable.gstr2Total)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Net Payable Tax Sum</span>
                <span className={`font-mono text-sm font-black block ${
                  netGstPayable.netPayable > 0 ? 'text-indigo-650 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {netGstPayable.netPayable > 0 
                    ? formatCurrency(netGstPayable.netPayable) 
                    : `No Tax Due (ITC Balance: ${formatCurrency(netGstPayable.itcRemaining)})`}
                </span>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex gap-2 flex-wrap pt-1">
              <a
                href="https://services.gst.gov.in/services/challan"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs shadow-md shadow-indigo-600/10"
              >
                <Wallet className="w-4 h-4 text-white" />
                <span>Pay GST Online (Govt Portal)</span>
              </a>

              <button
                onClick={() => {
                  setTaxPayAmount(netGstPayable.netPayable > 0 ? String(netGstPayable.netPayable) : '');
                  setShowRecordPayment(!showRecordPayment);
                }}
                className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs shadow-sm hover:cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-indigo-500" />
                <span>Record Paid Challan Receipt</span>
              </button>
            </div>

            {/* Collapsed Payment Form */}
            {showRecordPayment && (
              <form onSubmit={handleRecordGstPayment} className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-150/50 dark:border-zinc-800 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-zinc-800">
                  <h4 className="font-bold text-gray-800 dark:text-white">Record Paid GST Settlement Receipt</h4>
                  <button type="button" onClick={() => setShowRecordPayment(false)} className="text-gray-400 hover:text-gray-500 hover:cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {taxPaySuccessMsg ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold font-sans border border-emerald-250">
                    {taxPaySuccessMsg}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Settlement Amount Paid</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={taxPayAmount}
                        onChange={(e) => setTaxPayAmount(e.target.value)}
                        className="w-full p-2 bg-gray-50 dark:bg-zinc-850 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Challan / CIN / CPIN Ref</label>
                      <input
                        type="text"
                        placeholder="e.g. GST-2026-CHAL"
                        value={taxChallanRef}
                        onChange={(e) => setChallanRef(e.target.value)}
                        className="w-full p-2 bg-gray-50 dark:bg-zinc-850 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Payment Date</label>
                      <input
                        type="date"
                        required
                        value={taxPayDate}
                        onChange={(e) => setTaxPayDate(e.target.value)}
                        className="w-full p-2 bg-gray-50 dark:bg-zinc-850 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Payment Mode Channel</label>
                      <select
                        value={taxPayMode}
                        onChange={(e) => setTaxPayMode(e.target.value as any)}
                        className="w-full p-2 bg-gray-50 dark:bg-zinc-850 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="BANK_TRANSFER">NetBanking / Credit Card</option>
                        <option value="UPI">UPI Payment</option>
                        <option value="CASH">Cash / Offline OTC</option>
                        <option value="CREDIT">NEFT / RTGS</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 md:col-span-4 flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingTaxPay}
                        className="px-5 py-2 hover:pointer-pointer hover:cursor-pointer bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingTaxPay ? "Saving Payment Entry..." : "Submit Payment Entry"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* Overview Stats: GSTR-1 Sales and ITC Purchase breaks */}
        <div className={activeReportTab === 'ALL' ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "space-y-6"}>
        
        {/* Sales Tax Summary */}
        {(activeReportTab === 'ALL' || activeReportTab === 'SALES') && (
          <div id="gstr1-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
          
          {/* Print only header */}
          <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block mb-0.5">
                  GSTR-1 Sales Audit Report
                </span>
                <h3 className="text-base font-black text-gray-950">
                  {activeCompany?.name || "Nirmal Hardware Store"}
                </h3>
                {activeCompany?.gstin && (
                  <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                    GSTIN: {activeCompany.gstin}
                  </p>
                )}
              </div>
              <div className="text-right text-[10px] text-gray-500">
                <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs">
            <h4 id="rep-gstr1-title" className="font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1">
              <FileCheck className="w-4 h-4 text-blue-600" />
              GSTR-1 Audit (Sales Tax)
            </h4>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => triggerPrinter('gstr1-report-card')}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2"
                title="Print only Sales Tax Audit report"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                id="btn-csv-sales"
                onClick={() => handleExportDataCSV('SALES')}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                CSV Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Taxable Base (Sales)</span>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white block mt-1">
                {formatCurrency(salesGstSummary.taxableAmount)}
              </span>
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Integrated Tax (IGST)</span>
              <span className="text-sm font-extrabold text-blue-600 block mt-1">
                {formatCurrency(salesGstSummary.igst)}
              </span>
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Central Tax ({countryConfig.stateTaxShorthand || 'CGST'})</span>
              <span className="text-sm font-semibold text-gray-805 dark:text-zinc-300 block mt-1">
                {formatCurrency(salesGstSummary.cgst)}
              </span>
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">State/Local Tax ({countryConfig.stateTaxShorthand || 'SGST'})</span>
              <span className="text-sm font-semibold text-gray-805 dark:text-zinc-300 block mt-1">
                {formatCurrency(salesGstSummary.sgst)}
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-gray-50 dark:border-zinc-800/45 flex justify-between text-xs">
            <span className="font-semibold text-gray-500">Gross Sales Value:</span>
            <span className="font-black text-gray-900 dark:text-white">{formatCurrency(salesGstSummary.totalSalesVal)}</span>
          </div>
          
          {/* Detailed Sales List for Review within SALES tab */}
          {activeReportTab === 'SALES' && (
            <div className="pt-4 border-t border-gray-50 dark:border-zinc-805 mt-2">
              <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">Filtered Sales Records</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/55 dark:bg-zinc-805/40 text-[9px] font-extrabold text-gray-450 uppercase tracking-tighter">
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Inv No</th>
                      <th className="py-2 px-2">Party Name</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50/50 dark:divide-zinc-800/40">
                    {filteredInvoices.map((inv, i) => (
                      <tr key={i} className="text-[11px] hover:bg-gray-50/30">
                        <td className="py-2 px-2 font-mono">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                        <td className="py-2 px-2 font-bold text-gray-800 dark:text-zinc-200">{inv.invoiceNumber}</td>
                        <td className="py-2 px-2 truncate max-w-[120px]">{inv.customerName}</td>
                        <td className="py-2 px-2 text-right font-black text-blue-600 font-mono">{formatCurrency(inv.grandTotal)}</td>
                        <td className="py-2 px-2 text-center">
                          <button onClick={() => setSelectedInvoiceForModal(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-400 italic">No sales found in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Purchase ITC tax credit summaries */}
        {(activeReportTab === 'ALL' || activeReportTab === 'PURCHASE') && (
          <div id="gstr2-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
          
          {/* Print only header */}
          <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">
                  GSTR-2 Input Tax Credit Summary
                </span>
                <h3 className="text-base font-black text-gray-950">
                  {activeCompany?.name || "Nirmal Hardware Store"}
                </h3>
                {activeCompany?.gstin && (
                  <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                    GSTIN: {activeCompany.gstin}
                  </p>
                )}
              </div>
              <div className="text-right text-[10px] text-gray-500">
                <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs">
            <h4 id="rep-gstr2-title" className="font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1">
              <FileCheck className="w-4 h-4 text-amber-500" />
              GSTR-2 (Input Tax Credit / Purchases)
            </h4>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => triggerPrinter('gstr2-report-card')}
                className="text-amber-500 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2"
                title="Print only Purchase ITC report"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                id="btn-csv-purchases"
                onClick={() => handleExportDataCSV('PURCHASES')}
                className="text-amber-500 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                CSV Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Taxable Base (Purchases)</span>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white block mt-1">
                {formatCurrency(purchaseGstSummary.taxableAmount)}
              </span>
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">ITC Claimable (IGST)</span>
              <span className="text-sm font-extrabold text-orange-500 block mt-1">
                {formatCurrency(purchaseGstSummary.igst)}
              </span>
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">ITC Claimable ({countryConfig.stateTaxShorthand || 'CGST'})</span>
              <span className="text-sm font-semibold text-gray-850 dark:text-zinc-300 block mt-1">
                {formatCurrency(purchaseGstSummary.cgst)}
              </span>
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 p-3 rounded-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">ITC Claimable ({countryConfig.stateTaxShorthand || 'SGST'})</span>
              <span className="text-sm font-semibold text-gray-850 dark:text-zinc-300 block mt-1">
                {formatCurrency(purchaseGstSummary.sgst)}
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-gray-50 dark:border-zinc-800/45 flex justify-between text-xs">
            <span className="font-semibold text-gray-500">Gross Purchases:</span>
            <span className="font-black text-gray-900 dark:text-white">{formatCurrency(purchaseGstSummary.totalPurchasesVal)}</span>
          </div>

          {/* Detailed Purchase List for Review within PURCHASE tab */}
          {activeReportTab === 'PURCHASE' && (
            <div className="pt-4 border-t border-gray-50 dark:border-zinc-805 mt-2">
              <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">Filtered Purchase Records</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/55 dark:bg-zinc-805/40 text-[9px] font-extrabold text-gray-450 uppercase tracking-tighter">
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Bill No</th>
                      <th className="py-2 px-2">Supplier Name</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50/50 dark:divide-zinc-800/40">
                    {filteredPurchases.map((pur, i) => (
                      <tr key={i} className="text-[11px] hover:bg-gray-50/30">
                        <td className="py-2 px-2 font-mono">{new Date(pur.date).toLocaleDateString('en-IN')}</td>
                        <td className="py-2 px-2 font-bold text-gray-800 dark:text-zinc-200">{pur.billNumber}</td>
                        <td className="py-2 px-2 truncate max-w-[120px]">{pur.supplierName}</td>
                        <td className="py-2 px-2 text-right font-black text-amber-600 font-mono">{formatCurrency(pur.grandTotal)}</td>
                        <td className="py-2 px-2 text-center">
                          <button onClick={() => setSelectedPurchaseForModal(pur)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredPurchases.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-400 italic">No purchases found in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Profit and loss overview */}
        {(activeReportTab === 'ALL' || activeReportTab === 'PL') && (
          <div id="profit-loss-report-card" className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            
            {/* Print only header */}
            <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-0.5">
                    Business Profit & Loss & Reconciliation summary
                  </span>
                  <h3 className="text-base font-black text-gray-950">
                    {activeCompany?.name || "Nirmal Hardware Store"}
                  </h3>
                  {activeCompany?.gstin && (
                    <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                      GSTIN: {activeCompany.gstin}
                    </p>
                  )}
                </div>
                <div className="text-right text-[10px] text-gray-500 font-sans">
                  <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                  <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            </div>

            {/* Header Title with Print Controller */}
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-zinc-800 pb-3">
              <div>
                <h4 id="rep-pl-title" className="text-sm font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  Trading P&L & Live Reconciliation
                </h4>
                <p className="text-[10.5px] text-gray-400 mt-0.5 font-medium">
                  COGS Accounting & Cash-Bank-Stock Asset Valuation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerPrinter('profit-loss-report-card')}
                className="text-emerald-700 hover:underline flex items-center gap-1 text-xs font-bold hover:cursor-pointer print:hidden bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-950/30"
                title="Print only Profit & Loss report"
              >
                <Printer className="w-3.5 h-3.5" />
                Print report
              </button>
            </div>

            {/* TALLY PRIME STYLE PROFIT AND LOSS ACCOUNT */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="text-center py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/20">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">Profit & Loss A/c</h3>
                <p className="text-[10px] text-gray-500 font-medium">For the period {activeDateRange.start.toLocaleDateString('en-IN')} to {activeDateRange.end.toLocaleDateString('en-IN')} &bull; Net of GST (Excl. Taxes)</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-zinc-800 text-[11px] font-sans">
                
                {/* LEFT COLUMN (PARTICULARS) */}
                <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-b border-gray-200 dark:border-zinc-800 font-bold text-gray-800 dark:text-gray-200 bg-gray-50/50 dark:bg-zinc-800/10">
                     <span>Particulars</span>
                     <span>Amount</span>
                  </div>
                  <div className="flex-grow space-y-3 p-4 text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between items-center group">
                       <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors">Opening Stock</span>
                       <span className="font-mono text-[11.5px] font-semibold">{formatCurrency(profitAndLoss.openingStock)}</span>
                    </div>
                    <div className="flex justify-between items-center group">
                       <div>
                         <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors">Purchase Accounts</span>
                         <span className="text-[9.5px] text-gray-400 dark:text-zinc-500 block font-normal">Excl. GST (Taxable)</span>
                       </div>
                       <span className="font-mono text-[11.5px] font-semibold">{formatCurrency(profitAndLoss.netPurchases)}</span>
                    </div>
                    {profitAndLoss.tallyGrossProfit > 0 && (
                      <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-bold mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-zinc-800">
                         <span>Gross Profit c/o</span>
                         <span className="font-mono text-[11.5px] font-bold">{formatCurrency(profitAndLoss.tallyGrossProfit)}</span>
                      </div>
                    )}
                  </div>
                  {/* TRADING TOTAL LEFT */}
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-y-2 border-gray-300 dark:border-zinc-700 font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-zinc-800/10">
                     <span className="text-right pr-4 uppercase tracking-wider text-[10px]">Total</span>
                     <span className="font-mono text-xs">{formatCurrency(profitAndLoss.tradingTotal)}</span>
                  </div>
                  
                  {/* PROFIT AND LOSS LEFT */}
                  <div className="flex-grow space-y-3 p-4 text-gray-700 dark:text-gray-300">
                    {profitAndLoss.tallyGrossLoss > 0 && (
                      <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-bold">
                         <span>Gross Loss b/f</span>
                         <span className="font-mono text-[11.5px]">{formatCurrency(profitAndLoss.tallyGrossLoss)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center group">
                       <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors">Indirect Expenses</span>
                       <span className="font-mono text-[11.5px] font-semibold">{formatCurrency(profitAndLoss.indirectCosts)}</span>
                    </div>
                    {profitAndLoss.tallyNetProfit > 0 && (
                       <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-bold mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-zinc-800">
                          <span>Net Profit</span>
                          <span className="font-mono text-[11.5px] font-bold">{formatCurrency(profitAndLoss.tallyNetProfit)}</span>
                       </div>
                    )}
                  </div>
                  {/* P&L TOTAL LEFT */}
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-y-2 border-b-[3px] border-b-gray-400 dark:border-b-zinc-500 border-t-gray-300 dark:border-t-zinc-700 font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-zinc-800/10 mb-[-1px]">
                     <span className="text-right pr-4 uppercase tracking-wider text-[10px]">Total</span>
                     <span className="font-mono text-xs">{formatCurrency(profitAndLoss.plTotal)}</span>
                  </div>
                </div>

                {/* RIGHT COLUMN (PARTICULARS) */}
                <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-b border-gray-200 dark:border-zinc-800 font-bold text-gray-800 dark:text-gray-200 bg-gray-50/50 dark:bg-zinc-800/10">
                     <span>Particulars</span>
                     <span>Amount</span>
                  </div>
                  <div className="flex-grow space-y-3 p-4 text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between items-center group">
                       <div>
                         <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors">Sales Accounts</span>
                         <span className="text-[9.5px] text-gray-400 dark:text-zinc-500 block font-normal">Excl. GST (Taxable)</span>
                       </div>
                       <span className="font-mono text-[11.5px] font-semibold">{formatCurrency(profitAndLoss.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center group">
                       <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors">Closing Stock</span>
                       <span className="font-mono text-[11.5px] font-semibold">{formatCurrency(profitAndLoss.closingStock)}</span>
                    </div>
                    {profitAndLoss.tallyGrossLoss > 0 && (
                      <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-bold mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-zinc-800">
                         <span>Gross Loss c/o</span>
                         <span className="font-mono text-[11.5px] font-bold">{formatCurrency(profitAndLoss.tallyGrossLoss)}</span>
                      </div>
                    )}
                  </div>
                  {/* TRADING TOTAL RIGHT */}
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-y-2 border-gray-300 dark:border-zinc-700 font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-zinc-800/10">
                     <span className="text-right pr-4 uppercase tracking-wider text-[10px]">Total</span>
                     <span className="font-mono text-xs">{formatCurrency(profitAndLoss.tradingTotal)}</span>
                  </div>
                  
                  {/* PROFIT AND LOSS RIGHT */}
                  <div className="flex-grow space-y-3 p-4 text-gray-700 dark:text-gray-300">
                    {profitAndLoss.tallyGrossProfit > 0 && (
                      <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-bold">
                         <span>Gross Profit b/f</span>
                         <span className="font-mono text-[11.5px]">{formatCurrency(profitAndLoss.tallyGrossProfit)}</span>
                      </div>
                    )}
                    {profitAndLoss.tallyNetLoss > 0 && (
                       <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-bold mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-zinc-800">
                          <span>Net Loss</span>
                          <span className="font-mono text-[11.5px] font-bold">{formatCurrency(profitAndLoss.tallyNetLoss)}</span>
                       </div>
                    )}
                  </div>
                  {/* P&L TOTAL RIGHT */}
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-y-2 border-b-[3px] border-b-gray-400 dark:border-b-zinc-500 border-t-gray-300 dark:border-t-zinc-700 font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-zinc-800/10 mb-[-1px]">
                     <span className="text-right pr-4 uppercase tracking-wider text-[10px]">Total</span>
                     <span className="font-mono text-xs">{formatCurrency(profitAndLoss.plTotal)}</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      {/* EXPENSE REGISTER REPORT CARD VIEW */}
      {(activeReportTab === 'EXPENSE') && (
        <div id="expense-register-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4 font-sans text-xs">
          
          {/* Print only header */}
          <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
            <div className="flex justify-between items-start text-xs">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 block mb-0.5">
                  Operating Expense Register
                </span>
                <h3 className="text-base font-black text-gray-950">
                  {activeCompany?.name || "Nirmal Hardware Store"}
                </h3>
                {activeCompany?.gstin && (
                  <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                    GSTIN: {activeCompany.gstin}
                  </p>
                )}
              </div>
              <div className="text-right text-[10px] text-gray-500 font-sans">
                <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-sans">
            <h4 id="rep-expense-title" className="font-semibold text-gray-850 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-rose-500" />
              Expenditure Register Ledger ({filteredExpenses.length} Records)
            </h4>
            <div className="flex items-center gap-2 print:hidden font-sans">
              <button
                type="button"
                onClick={() => triggerPrinter('expense-register-report-card')}
                className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2 text-[11px]"
                title="Print filtered Expense Register"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Register
              </button>
              <button
                onClick={handleExportExpensesCSV}
                className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2 text-[11px]"
                title="Export to CSV Spreadsheet"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export (CSV)
              </button>
              <button
                onClick={() => downloadExpenseRegisterPDF(filteredExpenses)}
                className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer text-[11px]"
                title="Compile & Download PDF Ledger"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Quick Metrics of Expenses breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-1">
            <div className="bg-rose-50/20 dark:bg-zinc-800/10 border border-rose-100/30 dark:border-zinc-800 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Debited Ledger</span>
                <span id="exp-total-spent" className="text-base font-black text-rose-650 dark:text-rose-400 block mt-0.5 font-mono">
                  {formatCurrency(expensesSummary.totalExpenses)}
                </span>
              </div>
              <Wallet className="w-7 h-7 text-rose-500/20" />
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 border border-gray-100/30 dark:border-zinc-850 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Unique Line Vouchers</span>
                <span className="text-base font-black text-gray-800 dark:text-white block mt-0.5 font-sans">
                  {filteredExpenses.length} Logs
                </span>
              </div>
              <FileCheck className="w-7 h-7 text-gray-400/20" />
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 border border-gray-100/30 dark:border-zinc-850 p-3 rounded-xl flex justify-between items-center font-sans font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Top Spending Class</span>
                <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 block truncate mt-0.5 max-w-[170px] font-sans">
                  {Object.entries(expensesSummary.categoryTotals).length > 0 
                    ? getCategoryLabel(Object.entries(expensesSummary.categoryTotals).sort((a,b) => (b[1] as any) - (a[1] as any))[0][0])
                    : 'None Registered'
                  }
                </span>
              </div>
              <TrendingUp className="w-7 h-7 text-gray-400/20" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-805 font-sans">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 font-semibold bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Particular Title / Description</th>
                  <th className="py-2.5 px-3">Category Classification</th>
                  <th className="py-2.5 px-3 text-center">Settled Via</th>
                  <th className="py-2.5 px-3 font-sans">Remarks Notes</th>
                  <th className="py-2.5 px-3 text-right">Debit Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150/40 dark:divide-zinc-800/30 text-gray-650 dark:text-zinc-300 font-sans">
                {filteredExpenses.map((exp: any, idx) => (
                  <tr key={`exp-${idx}`} className="hover:bg-gray-50/30 transition-colors print:text-black">
                    <td className="py-2.5 px-3 font-mono text-gray-450">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-white print:text-black leading-tight max-w-xs truncate">{exp.title}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-600 dark:text-zinc-300 print:text-black">{getCategoryLabel(exp.category)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="py-0.5 px-2 text-[9px] rounded font-mono font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-650 dark:text-zinc-300 print:border print:border-gray-300">
                        {exp.paymentMode || 'CASH'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 italic font-mono text-[10px] text-gray-400 print:text-zinc-650 max-w-[180px] truncate" title={exp.notes}>
                      {exp.notes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 print:text-black font-mono">
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center font-bold text-gray-400">
                      No expenditure records recorded during active filter range interval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Print Total summary at bottom */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/60 flex justify-between items-center font-bold text-xs font-sans">
            <span className="text-gray-400 uppercase tracking-widest text-[10px]">Net debit outgo:</span>
            <span className="font-black text-base text-rose-600 dark:text-rose-400 print:text-black font-mono">
              {formatCurrency(expensesSummary.totalExpenses)}
            </span>
          </div>
          
        </div>
      )}

      {/* SALES REGISTER REPORT CARD VIEW */}
      {(activeReportTab === 'SALES_REGISTER') && (
        <div id="sales-register-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4 font-sans text-xs">
          
          {/* Print only header */}
          <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
            <div className="flex justify-between items-start text-xs">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-650 block mb-0.5">
                  Automated Sales Register
                </span>
                <h3 className="text-base font-black text-gray-950">
                  {activeCompany?.name || "Nirmal Hardware Store"}
                </h3>
                {activeCompany?.gstin && (
                  <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                    GSTIN: {activeCompany.gstin}
                  </p>
                )}
              </div>
              <div className="text-right text-[10px] text-gray-500 font-sans">
                <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-sans">
            <h4 id="rep-sales-reg-title" className="font-semibold text-gray-850 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Sales Book / Register ({filteredInvoices.length} Invoices)
            </h4>
            <div className="flex items-center gap-2 print:hidden font-sans">
              <button
                type="button"
                onClick={() => triggerPrinter('sales-register-report-card')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2 text-[11px]"
                title="Print filtered Sales Register"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Register
              </button>
              <button
                onClick={() => handleExportDataCSV('SALES')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2 text-[11px]"
                title="Export to CSV Spreadsheet"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export (CSV)
              </button>
              <button
                onClick={() => downloadSalesRegisterPDF(filteredInvoices)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer text-[11px]"
                title="Compile & Download PDF Ledger"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Quick Metrics of Sales breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-1">
            <div className="bg-indigo-50/20 dark:bg-zinc-800/10 border border-indigo-100/30 dark:border-zinc-800 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Taxable Sales Base</span>
                <span id="sales-reg-total-taxable" className="text-base font-black text-indigo-650 dark:text-indigo-400 block mt-0.5 font-mono">
                  {formatCurrency(salesGstSummary.taxableAmount)}
                </span>
              </div>
              <Layers className="w-7 h-7 text-indigo-500/20" />
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 border border-gray-100/30 dark:border-zinc-850 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gst Tax Duties</span>
                <span className="text-base font-black text-gray-800 dark:text-white block mt-0.5 font-mono">
                  {formatCurrency(salesGstSummary.cgst + salesGstSummary.sgst + salesGstSummary.igst)}
                </span>
              </div>
              <FileCheck className="w-7 h-7 text-gray-400/20" />
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 border border-gray-100/30 dark:border-zinc-850 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gross Receivables</span>
                <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {formatCurrency(salesGstSummary.totalSalesVal)}
                </span>
              </div>
              <TrendingUp className="w-7 h-7 text-emerald-500/20" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-805 font-sans">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 font-semibold bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Customer / Party Name</th>
                  <th className="py-2.5 px-3">GSTIN ID</th>
                  <th className="py-2.5 px-3 text-right">Taxable Subtotal</th>
                  <th className="py-2.5 px-3 text-right">CGST</th>
                  <th className="py-2.5 px-3 text-right">SGST</th>
                  <th className="py-2.5 px-3 text-right">IGST</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-center">Settled</th>
                  <th className="py-2.5 px-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150/40 dark:divide-zinc-800/30 text-gray-650 dark:text-zinc-300 font-sans">
                {filteredInvoices.map((inv, idx) => {
                  return (
                    <tr key={`salesreg-${idx}`} className="hover:bg-gray-50/30 transition-colors print:text-black">
                      <td className="py-2.5 px-3 font-mono text-gray-450">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-bold text-indigo-650 dark:text-indigo-400 print:text-black leading-tight truncate">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-white print:text-black max-w-[150px] truncate">{inv.customerName}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px]">{inv.customerGstin || 'URP'}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(inv.subTotal)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(inv.cgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(inv.sgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(inv.igstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-indigo-600 dark:text-indigo-400 print:text-black font-mono">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`py-0.5 px-1.5 text-[8px] rounded font-semibold ${
                          inv.paymentStatus === 'PAID' 
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                            : inv.paymentStatus === 'PARTIAL' 
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' 
                            : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center print:hidden">
                        <button onClick={() => setSelectedInvoiceForModal(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center font-bold text-gray-400">
                      No sales invoice records recorded during active filter range interval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Print Total summary at bottom */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/60 flex justify-between items-center font-bold text-xs font-sans">
            <span className="text-gray-400 uppercase tracking-widest text-[10px]">Net Sales:</span>
            <span className="font-black text-base text-indigo-650 dark:text-indigo-400 print:text-black font-mono">
              {formatCurrency(salesGstSummary.totalSalesVal)}
            </span>
          </div>
          
        </div>
      )}

      {/* PURCHASE REGISTER REPORT CARD VIEW */}
      {(activeReportTab === 'PURCHASE_REGISTER') && (
        <div id="purchase-register-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4 font-sans text-xs">
          
          {/* Print only header */}
          <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
            <div className="flex justify-between items-start text-xs">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">
                  Stock Purchase Book
                </span>
                <h3 className="text-base font-black text-gray-950">
                  {activeCompany?.name || "Nirmal Hardware Store"}
                </h3>
                {activeCompany?.gstin && (
                  <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                    GSTIN: {activeCompany.gstin}
                  </p>
                )}
              </div>
              <div className="text-right text-[10px] text-gray-500 font-sans">
                <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-sans">
            <h4 id="rep-pur-reg-title" className="font-semibold text-gray-850 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              Purchase Book / Register ({filteredPurchases.length} Purchase Bills)
            </h4>
            <div className="flex items-center gap-2 print:hidden font-sans">
              <button
                type="button"
                onClick={() => triggerPrinter('purchase-register-report-card')}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2 text-[11px]"
                title="Print filtered Purchase Register"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Register
              </button>
              <button
                onClick={() => handleExportDataCSV('PURCHASES')}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer mr-2 text-[11px]"
                title="Export to CSV Spreadsheet"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export (CSV)
              </button>
              <button
                onClick={() => downloadPurchaseRegisterPDF(filteredPurchases)}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer text-[11px]"
                title="Compile & Download PDF Ledger"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Quick Metrics of Purchases breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-1">
            <div className="bg-amber-50/20 dark:bg-zinc-800/10 border border-amber-100/30 dark:border-zinc-800 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Taxable Purchases Base</span>
                <span id="purchases-reg-total-taxable" className="text-base font-black text-amber-650 dark:text-amber-400 block mt-0.5 font-mono">
                  {formatCurrency(purchaseGstSummary.taxableAmount)}
                </span>
              </div>
              <Layers className="w-7 h-7 text-amber-500/20" />
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 border border-gray-100/30 dark:border-zinc-850 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tax Credit Recouped</span>
                <span className="text-base font-black text-gray-800 dark:text-white block mt-0.5 font-mono">
                  {formatCurrency(purchaseGstSummary.cgst + purchaseGstSummary.sgst + purchaseGstSummary.igst)}
                </span>
              </div>
              <FileCheck className="w-7 h-7 text-gray-400/20" />
            </div>
            <div className="bg-gray-50/50 dark:bg-zinc-800/10 border border-gray-100/30 dark:border-zinc-850 p-3 rounded-xl flex justify-between items-center font-sans">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gross Outflow</span>
                <span className="font-mono text-base font-black text-amber-600 dark:text-amber-500 block mt-0.5">
                  {formatCurrency(purchaseGstSummary.totalPurchasesVal)}
                </span>
              </div>
              <TrendingDown className="w-7 h-7 text-amber-500/20" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-805 font-sans">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 font-semibold bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Bill / Invoice No</th>
                  <th className="py-2.5 px-3">Supplier / Vendor Name</th>
                  <th className="py-2.5 px-3">GSTIN ID</th>
                  <th className="py-2.5 px-3 text-right">Taxable Subtotal</th>
                  <th className="py-2.5 px-3 text-right">CGST</th>
                  <th className="py-2.5 px-3 text-right">SGST</th>
                  <th className="py-2.5 px-3 text-right">IGST</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-center">Settled</th>
                  <th className="py-2.5 px-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150/40 dark:divide-zinc-800/30 text-gray-650 dark:text-zinc-300 font-sans">
                {filteredPurchases.map((pur, idx) => {
                  return (
                    <tr key={`purchasereg-${idx}`} className="hover:bg-gray-50/30 transition-colors print:text-black">
                      <td className="py-2.5 px-3 font-mono text-gray-450">{new Date(pur.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400 print:text-black leading-tight truncate">{pur.billNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-white print:text-black max-w-[150px] truncate">{pur.supplierName}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px]">{pur.supplierGstin || 'URP'}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(pur.subTotal)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(pur.cgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(pur.sgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(pur.igstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400 print:text-black font-mono">
                        {formatCurrency(pur.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`py-0.5 px-1.5 text-[8px] rounded font-semibold ${
                          pur.paymentStatus === 'PAID' 
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                            : pur.paymentStatus === 'PARTIAL' 
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' 
                            : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        }`}>
                          {pur.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center print:hidden">
                        <button onClick={() => setSelectedPurchaseForModal(pur)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center font-bold text-gray-400">
                      No stock purchase logs recorded during active filter range interval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Print Total summary at bottom */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/60 flex justify-between items-center font-bold text-xs font-sans">
            <span className="text-gray-400 uppercase tracking-widest text-[10px]">Net Purchases:</span>
            <span className="font-black text-base text-amber-600 dark:text-amber-400 print:text-black font-mono">
              {formatCurrency(purchaseGstSummary.totalPurchasesVal)}
            </span>
          </div>
          
        </div>
      )}

      {/* RETURNS REGISTER REPORT CARD VIEW */}
      {(activeReportTab === 'RETURNS_REGISTER') && (
        <div id="returns-register-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4 font-sans text-xs">
          
          {/* Print only header */}
          <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
            <div className="flex justify-between items-start text-xs">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-650 block mb-0.5 font-sans">
                  Automated Credit/Debit Notes Register
                </span>
                <h3 className="text-base font-black text-gray-950 font-sans">
                  {activeCompany?.name || "Nirmal Hardware Store"}
                </h3>
                {activeCompany?.gstin && (
                  <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                    GSTIN: {activeCompany.gstin}
                  </p>
                )}
              </div>
              <div className="text-right text-[10px] text-gray-500 font-sans">
                <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
                <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-sans">
            <h4 id="rep-returns-reg-title" className="font-semibold text-gray-850 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <ArrowRightLeft className="w-4 h-4 text-fuchsia-500" />
              Returns Book / Register ({filteredSalesReturns.length + filteredPurchaseReturns.length} Records)
            </h4>
            <div className="flex items-center gap-2 print:hidden font-sans">
              <button
                type="button"
                onClick={() => triggerPrinter('returns-register-report-card')}
                className="text-fuchsia-650 dark:text-fuchsia-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer text-[11px]"
                title="Print filtered Returns Register"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Register
              </button>
            </div>
          </div>

          {/* Quick Metrics of Returns breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1 font-sans">
            <div className="bg-fuchsia-50/25 dark:bg-zinc-800/10 border border-fuchsia-100/35 dark:border-zinc-800/40 p-3 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-gray-400 tracking-wider block">Total Sales Returns (Credit Notes)</span>
                <span className="text-base font-black text-rose-600 dark:text-rose-400 block mt-0.5 font-mono">
                  {formatCurrency(salesReturnsSummary.totalReturnsVal)}
                </span>
              </div>
              <TrendingDown className="w-7 h-7 text-rose-500/20 animate-pulse" />
            </div>
            <div className="bg-violet-50/20 dark:bg-zinc-800/10 border border-violet-100/30 dark:border-zinc-800/40 p-3 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-gray-400 tracking-wider block">Total Purchase Returns (Debit Notes)</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
                  {formatCurrency(purchaseReturnsSummary.totalReturnsVal)}
                </span>
              </div>
              <TrendingUp className="w-7 h-7 text-emerald-500/20 animate-pulse" />
            </div>
          </div>

          {/* Sales Returns credit notes segment */}
          <div className="space-y-2 pt-2">
            <h5 className="font-bold text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
              Sales Returns (Credit Notes)
            </h5>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-805">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800 font-semibold bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 uppercase text-[9px] tracking-wide">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Return No</th>
                    <th className="py-2.5 px-3">Original Inv No</th>
                    <th className="py-2.5 px-3">Customer / Party</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-3 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                    <th className="py-2.5 px-3 text-right">IGST</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150/40 dark:divide-zinc-800/30 text-gray-650 dark:text-zinc-300">
                  {filteredSalesReturns.map((sr, idx) => (
                    <tr key={`salesret-${idx}`} className="hover:bg-gray-50/30 transition-colors print:text-black">
                      <td className="py-2.5 px-3 font-mono text-gray-450">{new Date(sr.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400 font-mono">{sr.returnNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-500 dark:text-zinc-400 font-mono">{sr.invoiceNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-white print:text-black max-w-[150px] truncate">{sr.customerName}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(sr.subTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(sr.cgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(sr.sgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(sr.igstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 print:text-black font-mono">
                        {formatCurrency(sr.grandTotal || 0)}
                      </td>
                    </tr>
                  ))}
                  {filteredSalesReturns.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-gray-450 italic">
                        No credit notes / sales returns processed during active range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Purchase Returns debit notes segment */}
          <div className="space-y-2 pt-4">
            <h5 className="font-bold text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Purchase Returns (Debit Notes)
            </h5>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-805">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800 font-semibold bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 uppercase text-[9px] tracking-wide">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Return No</th>
                    <th className="py-2.5 px-3">Original Bill No</th>
                    <th className="py-2.5 px-3">Supplier / Vendor</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-3 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                    <th className="py-2.5 px-3 text-right">IGST</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150/40 dark:divide-zinc-800/30 text-gray-650 dark:text-zinc-300">
                  {filteredPurchaseReturns.map((pr, idx) => (
                    <tr key={`purcret-${idx}`} className="hover:bg-gray-50/30 transition-colors print:text-black">
                      <td className="py-2.5 px-3 font-mono text-gray-450">{new Date(pr.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400 font-mono">{pr.returnNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-500 dark:text-zinc-400 font-mono">{pr.billNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-white print:text-black max-w-[150px] truncate">{pr.supplierName}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(pr.subTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(pr.cgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(pr.sgstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">{formatCurrency(pr.igstTotal || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 print:text-black font-mono">
                        {formatCurrency(pr.grandTotal || 0)}
                      </td>
                    </tr>
                  ))}
                  {filteredPurchaseReturns.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-gray-450 italic">
                        No debit notes / purchase returns processed during active range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* List grids matching details of transactions log */}
      {(activeReportTab === 'ALL' || activeReportTab === 'LEDGER') && (
        <div id="ledger-report-card" className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4 font-sans text-xs">
        
        {/* Print only header */}
        <div className="reports-print-header hidden border-b border-gray-200 pb-3 mb-4 text-left">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block mb-0.5">
                General Ledger Audit Logs
              </span>
              <h3 className="text-base font-black text-gray-950">
                {activeCompany?.name || "Nirmal Hardware Store"}
              </h3>
              {activeCompany?.gstin && (
                <p className="text-[10px] font-mono font-bold text-gray-800 mt-0.5">
                  GSTIN: {activeCompany.gstin}
                </p>
              )}
            </div>
            <div className="text-right text-[10px] text-gray-500">
              <p className="font-bold">Period: {activeDateRange.start.toLocaleDateString('en-IN')} - {activeDateRange.end.toLocaleDateString('en-IN')}</p>
              <p className="mt-0.5 text-[9px]">Generated: {new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h4 id="rep-ledger-title" className="font-semibold text-gray-800 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-1">
            <Layers className="w-4 h-4 text-blue-600" />
            General Ledger Audit Logs ({filteredInvoices.length + filteredPurchases.length} Records)
          </h4>
          <button
            type="button"
            onClick={() => triggerPrinter('ledger-report-card')}
            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold hover:cursor-pointer print:hidden text-xs"
            title="Print only Ledger Report"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Ledger
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 dark:border-zinc-850 font-semibold bg-gray-50/50 dark:bg-zinc-800/10 text-gray-400 uppercase text-[10px]">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Primary Ref No</th>
                <th className="py-2 px-3">Client Firm Name</th>
                <th className="py-2 px-3">Doc Type</th>
                <th className="py-2 px-3 text-right">Taxable Subtotal ({countryConfig.currencySymbol})</th>
                <th className="py-2 px-3 text-right">CGST SGST IGST</th>
                <th className="py-2 px-3 text-right">Grand Total ({countryConfig.currencySymbol})</th>
                <th className="py-2 px-3 text-center billing-header-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/40 text-gray-650 dark:text-zinc-350">
              {filteredInvoices.map((inv, idx) => (
                <tr key={`inv-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-gray-455">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                  <td className="py-3 px-3 font-semibold">{inv.customerName}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/10 text-blue-600 text-[10px] font-bold">SALE</span></td>
                  <td className="py-3 px-3 text-right font-mono">{formatCurrency(inv.subTotal)}</td>
                  <td className="py-3 px-3 text-right text-[10px] text-gray-400">
                    C: {inv.cgstTotal.toFixed(1)} / S: {inv.sgstTotal.toFixed(1)} / I: {inv.igstTotal.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(inv.grandTotal)}</td>
                  <td className="py-3 px-3 text-center billing-header-print">
                    <button
                      onClick={() => setSelectedInvoiceForModal(inv)}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-150/20 hover:cursor-pointer transition-colors"
                    >
                      Print / View Invoice
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredPurchases.map((pur, idx) => (
                <tr key={`pur-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-gray-455">{new Date(pur.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-3 font-bold text-gray-00 dark:text-white">{pur.billNumber}</td>
                  <td className="py-3 px-3 font-semibold">{pur.supplierName}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-900/10 text-orange-600 text-[10px] font-bold font-mono">PURCHASE</span></td>
                  <td className="py-3 px-3 text-right font-mono">{formatCurrency(pur.subTotal)}</td>
                  <td className="py-3 px-3 text-right text-[10px] text-gray-400">
                     C: {pur.cgstTotal.toFixed(1)} / S: {pur.sgstTotal.toFixed(1)} / I: {pur.igstTotal.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(pur.grandTotal)}</td>
                  <td className="py-3 px-3 text-center billing-header-print">
                    <button
                      onClick={() => setSelectedPurchaseForModal(pur)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase rounded-lg border border-amber-150/20 hover:cursor-pointer transition-colors"
                    >
                      Print / View Bill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      </div>

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
                    <p className="text-gray-500 dark:text-zinc-400 mt-1 max-w-sm print:text-zinc-700">{activeCompany?.address || 'Corporate Billing Office'}</p>
                    <p className="text-gray-400 mt-0.5 print:text-zinc-650">GSTIN: <span className="font-semibold font-mono text-slate-700 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                    {activeCompany?.phone && <p className="text-gray-400 mt-0.5 print:text-zinc-650">Phone: {activeCompany.phone}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-700 dark:text-zinc-300 print:text-black">TAX INVOICE</h2>
                  <div className="mt-2 space-y-1 text-gray-500 dark:text-zinc-400 print:text-zinc-750">
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
                  <p className="print:text-zinc-750">{activeCompany?.address || 'No office address'}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                </div>
                <div className="space-y-1 text-gray-500 dark:text-zinc-400">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">RECIPIENT (BILL TO)</p>
                  <p className="font-black text-slate-900 dark:text-white print:text-black">{selectedInvoiceForModal.customerName}</p>
                  <p className="print:text-zinc-750">{selectedInvoiceForModal.billingAddress || 'No billing address specified'}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{selectedInvoiceForModal.customerGstin || 'URP (Consumer)'}</span></p>
                </div>
              </div>

              {/* Product items list ledger */}
              <table className="w-full text-left border-collapse border border-gray-100 dark:border-zinc-800 font-sans">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold uppercase text-[9px] border-b border-gray-100 dark:border-zinc-800">
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
                  {selectedInvoiceForModal.items.map((item, idx) => (
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
                  <div className="flex justify-between text-gray-500">
                    <span>Taxable Subtotal:</span>
                    <span className="font-semibold text-gray-900 dark:text-white print:text-black">{formatCurrency(selectedInvoiceForModal.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{countryConfig.stateTaxShorthand || 'CGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedInvoiceForModal.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{countryConfig.stateTaxShorthand || 'SGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedInvoiceForModal.sgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{countryConfig.centralTaxShorthand || 'IGST'}:</span>
                    <span className="font-mono text-gray-800 dark:text-zinc-300 print:text-black">{formatCurrency(selectedInvoiceForModal.igstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
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
                  <div className="mt-2 space-y-1 text-gray-500 dark:text-zinc-400 print:text-zinc-750">
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
                <div className="space-y-1 text-gray-500 dark:text-zinc-400">
                  <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">INWARD TO (BILL RECEIVER)</p>
                  <p className="font-black text-slate-900 dark:text-white print:text-black">{activeCompany?.name || 'Corporate Entity'}</p>
                  <p className="print:text-zinc-750">{activeCompany?.address || 'No office address specified'}</p>
                  <p>GSTIN: <span className="font-mono font-semibold text-slate-900 print:text-black">{activeCompany?.gstin || 'N/A'}</span></p>
                </div>
              </div>

              {/* Product items list ledger */}
              <table className="w-full text-left border-collapse border border-gray-100 dark:border-zinc-800 font-sans">
                <thead>
                  <tr className="bg-amber-50/55 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 font-bold uppercase text-[9px] border-b border-gray-100 dark:border-zinc-800">
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
                  {selectedPurchaseForModal.items.map((item, idx) => (
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
                  <p className="text-[11px] text-slate-650 dark:text-zinc-400 leading-normal">
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
                  <p>1. The goods mapped in this bill correspond precisely with the materials physically accepted and verified.</p>
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
    </div>
  );
};
