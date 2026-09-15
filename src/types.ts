/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff'
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  activeCompanyId?: string;
  isSuperAdmin?: boolean;
  status?: 'ACTIVE' | 'SUSPENDED';
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  companyId: string;
  name: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  logoUrl?: string;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
  country?: 'IN' | 'US' | 'UK' | 'CA';
  financialYear?: string;
  financialYears?: string[];
  upiId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyMember {
  companyId: string;
  userId: string;
  email: string;
  role: UserRole;
  invitedAt?: string;
}

export interface Product {
  productId: string;
  name: string;
  category: string;
  sku: string;
  barcode?: string;
  hsnCode: string;
  unit: 'PCS' | 'KG' | 'LITER' | 'BOX' | 'MTR' | 'SET';
  purchasePrice: number;
  sellingPrice: number;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  openingStock: number;
  currentStock: number;
  lowStockThreshold: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  hsnCode: string;
  qty: number;
  unit: string;
  price: number;
  discount: number; // total discount on this item in Rupees
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface SalesInvoice {
  invoiceId: string;
  invoiceNumber: string;
  date: string; // ISO String
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerState: string;
  billingAddress?: string;
  items: InvoiceItem[];
  subTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  discountTotal: number;
  grandTotal: number;
  receivedAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT';
  notes?: string;
  financialYear?: string;
  ewayBillNo?: string;
  vehicleNo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  hsnCode: string;
  qty: number;
  unit: string;
  price: number;
  discount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface PurchaseBill {
  purchaseId: string;
  billNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  items: PurchaseItem[];
  subTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  invoiceFileUrl?: string; // pdf or image url
  financialYear?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  state: string; // Indian State, e.g. "Maharashtra", "Gujarat"
  gstType: 'GST_REGULAR' | 'GST_COMPOSITION' | 'CONSUMER' | 'UNREGISTERED';
  gstin?: string;
  openingBalance: number;
  outstandingBalance: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  supplierId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  state: string;
  gstin?: string;
  openingBalance: number;
  outstandingBalance: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LedgerTransaction {
  transactionId: string;
  type: 'SALE' | 'PURCHASE' | 'PAYMENT_RECEIVED' | 'PAYMENT_MADE' | 'SALES_RETURN' | 'PURCHASE_RETURN';
  referenceId: string; // invoiceId or purchaseId
  referenceNo: string; // invoiceNumber or billNumber
  entityId: string; // customerId or supplierId
  entityName: string;
  amount: number;
  date: string;
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT';
  bankAccountId?: string;
  description?: string;
  financialYear?: string;
  createdAt?: string;
}

export interface AppNotification {
  notificationId: string;
  title: string;
  message: string;
  type: 'LOW_STOCK' | 'PAYMENT_DUE' | 'SYSTEM';
  read: boolean;
  createdAt: string;
}

export interface Expense {
  expenseId: string;
  title: string;
  category: string;
  amount: number;
  date: string; // ISO String
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT';
  bankAccountId?: string;
  notes?: string;
  financialYear?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesReturn {
  returnId: string;
  creditNoteNumber: string;
  referenceInvoiceNo?: string;
  date: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerState: string;
  items: InvoiceItem[];
  subTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  reason?: string;
  financialYear?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseReturn {
  returnId: string;
  debitNoteNumber: string;
  referenceBillNo?: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  items: PurchaseItem[];
  subTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  reason?: string;
  financialYear?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAccount {
  accountId: string;
  bankName: string;
  accountHolderName?: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  accountType?: 'CURRENT' | 'SAVINGS' | 'OD_CC';
  openingBalance: number;
  openingBalanceDate?: string;
  upiId?: string;
  isDefault?: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CapitalInvestment {
  investmentId: string;
  partnerName?: string;
  amount: number;
  cashAmount: number;
  bankAmount: number;
  bankAccountId?: string;
  date: string;
  description?: string;
  financialYear?: string;
  createdAt?: string;
}

export type LanguageCode = 'en';

export type MasterResetScope = 'TRANSACTIONS_ONLY' | 'COMPLETE_RESET';

export interface MasterResetOptions {
  scope: MasterResetScope;
  adminEmail: string;
}
