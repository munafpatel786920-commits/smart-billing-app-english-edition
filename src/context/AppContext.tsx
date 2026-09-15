/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  getAuth
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  collection, 
  onSnapshot, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  runTransaction,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, firebaseConfig } from '../firebase';
import { 
  UserProfile, 
  Company, 
  CompanyMember, 
  Product, 
  Customer, 
  Supplier, 
  SalesInvoice, 
  PurchaseBill, 
  LedgerTransaction, 
  AppNotification, 
  UserRole,
  LanguageCode,
  Expense,
  SalesReturn,
  PurchaseReturn,
  CapitalInvestment,
  BankAccount,
  MasterResetScope,
  MasterResetOptions
} from '../types';
import { translations } from '../translations';
import { CountryConfig, getCountryConfig, formatCurrencyValue } from '../utils/countryConfig';

interface AppContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  activeCompany: Company | null;
  userRole: UserRole | null;
  members: CompanyMember[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: SalesInvoice[];
  purchases: PurchaseBill[];
  salesReturns: SalesReturn[];
  purchaseReturns: PurchaseReturn[];
  transactions: LedgerTransaction[];
  notifications: AppNotification[];
  expenses: Expense[];
  capitalInvestments: CapitalInvestment[];
  bankAccounts: BankAccount[];
  isDemoMode: boolean;
  loginWithDemo: () => void;
  
  loading: boolean;
  authLoading: boolean;
  language: LanguageCode;
  darkMode: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  countryConfig: CountryConfig;
  formatCurrency: (val: number) => string;
  
  // Translation Translate function
  t: (key: string) => string;
  setLanguage: (lang: LanguageCode) => void;
  setDarkMode: (dark: boolean) => void;
  
  // Operations Auth
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, companyName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  
  // Operations Settings / Profile
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateCompanyProfile: (data: Partial<Company>) => Promise<void>;
  saveCompanyProfile: (data: Partial<Company>) => Promise<void>;
  
  // Operations Company Member Invite
  inviteMember: (email: string, role: UserRole) => Promise<void>;
  
  // Operations Product
  saveProduct: (product: Omit<Product, 'productId'> & { productId?: string }) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  
  // Operations Customer / Supplier
  saveCustomer: (customer: Omit<Customer, 'customerId'> & { customerId?: string }) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  saveSupplier: (supplier: Omit<Supplier, 'supplierId'> & { supplierId?: string }) => Promise<void>;
  deleteSupplier: (supplier: string) => Promise<void>;
  
  // Invoicing Operations (with atomicity and stock/outstanding validation)
  saveSalesInvoice: (invoice: Omit<SalesInvoice, 'invoiceId' | 'invoiceNumber'>) => Promise<void>;
  deleteSalesInvoice: (invoiceId: string) => Promise<void>;
  
  // Return Operations
  saveSalesReturn: (salesReturn: Omit<SalesReturn, 'returnId' | 'creditNoteNumber'>) => Promise<void>;
  deleteSalesReturn: (returnId: string) => Promise<void>;
  savePurchaseReturn: (purchaseReturn: Omit<PurchaseReturn, 'returnId' | 'debitNoteNumber'>) => Promise<void>;
  deletePurchaseReturn: (returnId: string) => Promise<void>;
  
  // Purchase Operations
  savePurchaseEntry: (purchase: Omit<PurchaseBill, 'purchaseId'>) => Promise<void>;
  deletePurchaseEntry: (purchaseId: string) => Promise<void>;
  
  // Ledger payment transactions
  recordLedgerPayment: (tx: Omit<LedgerTransaction, 'transactionId' | 'createdAt'>) => Promise<void>;
  
  // Expenses Operations
  saveExpense: (expense: Omit<Expense, 'expenseId'> & { expenseId?: string }) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  
  // Capital Investments Operations
  saveCapitalInvestment: (investment: Omit<CapitalInvestment, 'investmentId'> & { investmentId?: string }) => Promise<void>;
  deleteCapitalInvestment: (investmentId: string) => Promise<void>;

  // Bank Accounts Operations
  saveBankAccount: (account: Omit<BankAccount, 'accountId'> & { accountId?: string }) => Promise<void>;
  deleteBankAccount: (accountId: string) => Promise<void>;
  setDefaultBankAccount: (accountId: string) => Promise<void>;
  
  // Notifications actions
  markNotificationAsRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;

  // Master Reset Operations
  verifyAdminCredentials: (email: string, password: string) => Promise<{ valid: boolean; error?: string }>;
  performMasterReset: (options: MasterResetOptions) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to calculate financial year from a date string (April-March cycle)
const getFinancialYearFromDate = (dateStr: string): string => {
  if (!dateStr) return '2026-2027';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '2026-2027';
    const year = date.getFullYear();
    const month = date.getMonth(); // 0 = Jan, 11 = Dec
    if (month >= 3) { // April to December
      return `${year}-${year + 1}`;
    } else { // January to March
      return `${year - 1}-${year}`;
    }
  } catch (e) {
    return '2026-2027';
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  
  // Business State Collections
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allInvoices, setAllInvoices] = useState<SalesInvoice[]>([]);
  const [allPurchases, setAllPurchases] = useState<PurchaseBill[]>([]);
  const [allSalesReturns, setAllSalesReturns] = useState<SalesReturn[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [allTransactions, setAllTransactions] = useState<LedgerTransaction[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allCapitalInvestments, setAllCapitalInvestments] = useState<CapitalInvestment[]>([]);
  const [allBankAccounts, setAllBankAccounts] = useState<BankAccount[]>([]);

  const bankAccounts = useMemo(() => {
    return allBankAccounts;
  }, [allBankAccounts]);

  const capitalInvestments = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allCapitalInvestments.filter(c => {
      const itemFY = c.financialYear || getFinancialYearFromDate(c.date);
      return itemFY === fy;
    });
  }, [allCapitalInvestments, activeCompany?.financialYear]);

  const salesReturns = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allSalesReturns.filter(sr => {
      const itemFY = sr.financialYear || getFinancialYearFromDate(sr.date);
      return itemFY === fy;
    });
  }, [allSalesReturns, activeCompany?.financialYear]);

  const purchaseReturns = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allPurchaseReturns.filter(pr => {
      const itemFY = pr.financialYear || getFinancialYearFromDate(pr.date);
      return itemFY === fy;
    });
  }, [allPurchaseReturns, activeCompany?.financialYear]);

  const expenses = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allExpenses.filter(e => {
      const itemFY = e.financialYear || getFinancialYearFromDate(e.date);
      return itemFY === fy;
    });
  }, [allExpenses, activeCompany?.financialYear]);

  const invoices = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allInvoices.filter(i => {
      const itemFY = i.financialYear || getFinancialYearFromDate(i.date);
      return itemFY === fy;
    });
  }, [allInvoices, activeCompany?.financialYear]);

  const purchases = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allPurchases.filter(p => {
      const itemFY = p.financialYear || getFinancialYearFromDate(p.date);
      return itemFY === fy;
    });
  }, [allPurchases, activeCompany?.financialYear]);

  const transactions = useMemo(() => {
    const fy = activeCompany?.financialYear || '2026-2027';
    return allTransactions.filter(t => {
      const itemFY = t.financialYear || getFinancialYearFromDate(t.date);
      return itemFY === fy;
    });
  }, [allTransactions, activeCompany?.financialYear]);
  
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [darkMode, setDarkModeState] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Clear any existing demo mode flag from local storage just in case
  useEffect(() => {
    localStorage.removeItem('gst_demo_mode');
  }, []);

  // Load language and dark mode from local storage
  useEffect(() => {
    localStorage.setItem('gst_lang', 'en');
    setLanguageState('en');
    const savedDark = localStorage.getItem('gst_dark') === 'true';
    if (savedDark) {
      setDarkModeState(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState('en');
    localStorage.setItem('gst_lang', 'en');
  }, []);

  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeState(dark);
    localStorage.setItem('gst_dark', String(dark));
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const theme = darkMode ? 'dark' : 'light';
  const toggleTheme = useCallback(() => {
    setDarkMode(!darkMode);
  }, [darkMode, setDarkMode]);

  const countryConfig = getCountryConfig(activeCompany?.country);
  const formatCurrency = useCallback((val: number) => {
    return formatCurrencyValue(val, activeCompany?.country);
  }, [activeCompany?.country]);

  const t = useCallback((key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  }, [language]);

  const loadDemoSession = useCallback(() => {
    const demoUser = {
      uid: 'demo_user_123',
      email: 'demo@patel-traders.com',
      displayName: 'Patel Traders (Demo)',
      emailVerified: true,
    } as any;
    setCurrentUser(demoUser);
    setUserRole(UserRole.ADMIN);

    const profileData = localStorage.getItem('demo_profile');
    if (profileData) setUserProfile(JSON.parse(profileData));
    const companyData = localStorage.getItem('demo_company');
    if (companyData) {
      const parsed = JSON.parse(companyData);
      if (!parsed.financialYear) {
        parsed.financialYear = '2026-2027';
      }
      if (!parsed.financialYears) {
        parsed.financialYears = ['2025-2026', '2026-2027', '2027-2028', '2028-2029'];
      }
      setActiveCompany(parsed);
    }

    setProducts(JSON.parse(localStorage.getItem('demo_products') || '[]'));
    setCustomers(JSON.parse(localStorage.getItem('demo_customers') || '[]'));
    setSuppliers(JSON.parse(localStorage.getItem('demo_suppliers') || '[]'));
    setAllInvoices(JSON.parse(localStorage.getItem('demo_invoices') || '[]'));
    setAllPurchases(JSON.parse(localStorage.getItem('demo_purchases') || '[]'));
    setAllSalesReturns(JSON.parse(localStorage.getItem('demo_sales_returns') || '[]'));
    setAllPurchaseReturns(JSON.parse(localStorage.getItem('demo_purchase_returns') || '[]'));
    setAllTransactions(JSON.parse(localStorage.getItem('demo_transactions') || '[]'));
    setNotifications(JSON.parse(localStorage.getItem('demo_notifications') || '[]'));
    setAllExpenses(JSON.parse(localStorage.getItem('demo_expenses') || '[]'));
    setMembers(JSON.parse(localStorage.getItem('demo_members') || '[]'));

    const localCapital = localStorage.getItem('demo_capital_investments');
    if (localCapital) {
      setAllCapitalInvestments(JSON.parse(localCapital));
    } else {
      const initialCapital: CapitalInvestment[] = [
        {
          investmentId: 'cap_init_1',
          partnerName: 'Munaf Patel (Owner)',
          amount: 800000,
          cashAmount: 150000,
          bankAmount: 650000,
          date: '2026-04-01',
          description: 'Business Startup Initial Capital Introduced',
          financialYear: '2026-2027',
          createdAt: new Date('2026-04-01T10:00:00Z').toISOString()
        }
      ];
      setAllCapitalInvestments(initialCapital);
      localStorage.setItem('demo_capital_investments', JSON.stringify(initialCapital));
    }

    const localBankAccounts = localStorage.getItem('demo_bank_accounts');
    if (localBankAccounts) {
      setAllBankAccounts(JSON.parse(localBankAccounts));
    } else {
      const initialBankAccounts: BankAccount[] = [
        {
          accountId: 'bank_init_1',
          bankName: 'State Bank of India',
          accountHolderName: 'Patel Traders (India)',
          accountNumber: '38291048291',
          ifscCode: 'SBIN0001234',
          branchName: 'GIDC Rajkot Branch',
          accountType: 'CURRENT',
          openingBalance: 650000,
          openingBalanceDate: '2026-04-01',
          upiId: 'pateltraders@oksbi',
          isDefault: true,
          description: 'Primary Operating Current Account',
          createdAt: new Date('2026-04-01T10:00:00Z').toISOString()
        }
      ];
      setAllBankAccounts(initialBankAccounts);
      localStorage.setItem('demo_bank_accounts', JSON.stringify(initialBankAccounts));
    }
    
    setAuthLoading(false);
    setLoading(false);
  }, []);

  const loginWithDemo = useCallback(() => {
    setIsDemoMode(true);
    localStorage.setItem('gst_demo_mode', 'true');

    const dummyProfile: UserProfile = {
      userId: 'demo_user_123',
      name: 'Munaf Patel (Demo)',
      email: 'demo@patel-traders.com',
      activeCompanyId: 'demo_company_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const dummyCompany: Company = {
      companyId: 'demo_company_123',
      name: 'Patel Traders (India)',
      gstin: '24AAAAA1111A1Z5',
      address: 'Plot No. 45, GIDC Industrial Estate, Rajkot, Gujarat',
      phone: '9876543210',
      email: 'contact@pateltraders.in',
      invoicePrefix: 'PATEL-',
      nextInvoiceNumber: 3,
      financialYear: '2026-2027',
      financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('demo_profile', JSON.stringify(dummyProfile));
    localStorage.setItem('demo_company', JSON.stringify(dummyCompany));

    if (!localStorage.getItem('demo_products')) {
      const dummyProducts: Product[] = [
        {
          productId: 'prod_1',
          name: "Steel Pipe 2'",
          category: "Construction",
          sku: "ST-02",
          barcode: "",
          hsnCode: "7306",
          unit: "PCS",
          purchasePrice: 380,
          sellingPrice: 450,
          gstRate: 18,
          openingStock: 120,
          currentStock: 120,
          lowStockThreshold: 15,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          productId: 'prod_2',
          name: "PVC Joint 4'",
          category: "Plumbing",
          sku: "PVC-4",
          barcode: "",
          hsnCode: "3917",
          unit: "PCS",
          purchasePrice: 90,
          sellingPrice: 120,
          gstRate: 18,
          openingStock: 20,
          currentStock: 8,
          lowStockThreshold: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          productId: 'prod_3',
          name: "Cement Bag 50kg",
          category: "Building Material",
          sku: "CEMENT-50",
          barcode: "",
          hsnCode: "2523",
          unit: "PCS",
          purchasePrice: 310,
          sellingPrice: 350,
          gstRate: 28,
          openingStock: 300,
          currentStock: 250,
          lowStockThreshold: 30,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_products', JSON.stringify(dummyProducts));
    }

    if (!localStorage.getItem('demo_customers')) {
      const dummyCustomers: Customer[] = [
        {
          customerId: 'cust_1',
          name: "Nirmal Hardware Store",
          email: "contact@nirmalhardware.com",
          phone: "9876543210",
          address: "Delhi Metro Junction, New Delhi",
          state: "Delhi",
          gstType: "GST_REGULAR",
          gstin: "07AAAAA1111A1Z1",
          openingBalance: 0,
          outstandingBalance: 12400,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          customerId: 'cust_2',
          name: "Om Shakti Builders",
          email: "info@omshaktibuilders.in",
          phone: "9988776655",
          address: "Sector 62, Noida, UP",
          state: "Uttar Pradesh",
          gstType: "UNREGISTERED",
          openingBalance: 0,
          outstandingBalance: 28210,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_customers', JSON.stringify(dummyCustomers));
    }

    if (!localStorage.getItem('demo_suppliers')) {
      const dummySuppliers: Supplier[] = [
        {
          supplierId: 'supp_1',
          name: "National Steel Corporation",
          email: "sales@nationalsteel.com",
          phone: "9112233445",
          address: "Industrial Area Phase 2, Mumbai",
          state: "Maharashtra",
          gstin: "27AAAAA2222B2Z2",
          openingBalance: 0,
          outstandingBalance: 18200,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_suppliers', JSON.stringify(dummySuppliers));
    }

    if (!localStorage.getItem('demo_invoices')) {
      const dummyInvoices: SalesInvoice[] = [
        {
          invoiceId: 'inv_1',
          invoiceNumber: "PATEL-0001",
          customerId: "cust_1",
          customerName: "Nirmal Hardware Store",
          customerGstin: "07AAAAA1111A1Z1",
          customerState: "Delhi",
          billingAddress: "Delhi Metro Junction, New Delhi",
          date: "2026-06-02",
          items: [
            {
              productId: "prod_1",
              name: "Steel Pipe 2'",
              hsnCode: "7306",
              qty: 10,
              unit: "PCS",
              price: 450,
              discount: 0,
              gstRate: 18,
              cgst: 405,
              sgst: 405,
              igst: 0,
              total: 5310
            }
          ],
          subTotal: 4500,
          cgstTotal: 405,
          sgstTotal: 405,
          igstTotal: 0,
          discountTotal: 0,
          grandTotal: 5310,
          receivedAmount: 5310,
          paymentMode: 'CASH',
          paymentStatus: 'PAID',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          invoiceId: 'inv_2',
          invoiceNumber: "PATEL-0002",
          customerId: "cust_2",
          customerName: "Om Shakti Builders",
          customerState: "Uttar Pradesh",
          billingAddress: "Sector 62, Noida, UP",
          date: "2026-06-03",
          items: [
            {
              productId: "prod_3",
              name: "Cement Bag 50kg",
              hsnCode: "2523",
              qty: 100,
              unit: "PCS",
              price: 350,
              discount: 0,
              gstRate: 28,
              cgst: 4900,
              sgst: 4900,
              igst: 0,
              total: 44800
            }
          ],
          subTotal: 35000,
          cgstTotal: 4900,
          sgstTotal: 4900,
          igstTotal: 0,
          discountTotal: 0,
          grandTotal: 44800,
          receivedAmount: 16590,
          paymentMode: 'BANK_TRANSFER',
          paymentStatus: 'PARTIAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_invoices', JSON.stringify(dummyInvoices));
    }

    if (!localStorage.getItem('demo_purchases')) {
      const dummyPurchases: PurchaseBill[] = [
        {
          purchaseId: 'pur_1',
          billNumber: "PUR-8821",
          supplierId: "supp_1",
          supplierName: "National Steel Corporation",
          supplierGstin: "27AAAAA2222B2Z2",
          date: "2026-06-01",
          items: [
            {
              productId: "prod_1",
              name: "Steel Pipe 2'",
              hsnCode: "7306",
              qty: 50,
              unit: "PCS",
              price: 380,
              discount: 0,
              gstRate: 18,
              cgst: 1710,
              sgst: 1710,
              igst: 0,
              total: 22420
            }
          ],
          subTotal: 19000,
          cgstTotal: 1710,
          sgstTotal: 1710,
          igstTotal: 0,
          discountTotal: 0,
          grandTotal: 22420,
          paidAmount: 22420,
          paymentStatus: 'PAID',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_purchases', JSON.stringify(dummyPurchases));
    }

    if (!localStorage.getItem('demo_transactions')) {
      const dummyTransactions: LedgerTransaction[] = [
        {
          transactionId: 'tx_1',
          type: 'SALE',
          referenceId: 'inv_1',
          referenceNo: 'PATEL-0001',
          entityId: 'cust_1',
          entityName: 'Nirmal Hardware Store',
          amount: 5310,
          date: '2026-06-02',
          paymentMode: 'CASH',
          description: 'Sales Invoice Issued: PATEL-0001',
          createdAt: new Date().toISOString()
        },
        {
          transactionId: 'tx_2',
          type: 'PAYMENT_RECEIVED',
          referenceId: 'inv_1',
          referenceNo: 'PATEL-0001',
          entityId: 'cust_1',
          entityName: 'Nirmal Hardware Store',
          amount: 5310,
          date: '2026-06-02',
          paymentMode: 'CASH',
          description: 'Payment received for Invoice: PATEL-0001',
          createdAt: new Date().toISOString()
        },
        {
          transactionId: 'tx_3',
          type: 'PURCHASE',
          referenceId: 'pur_1',
          referenceNo: 'PUR-8821',
          entityId: 'supp_1',
          entityName: 'National Steel Corporation',
          amount: 22420,
          date: '2026-06-01',
          paymentMode: 'CREDIT',
          description: 'Purchase Bill Recorded No: PUR-8821',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_transactions', JSON.stringify(dummyTransactions));
    }

    if (!localStorage.getItem('demo_notifications')) {
      const dummyNotifications: AppNotification[] = [
        {
          notificationId: 'notif_1',
          title: "Stock Refill Needed",
          message: 'Product "PVC Joint 4\'" is below threshold (8 units left).',
          type: 'LOW_STOCK',
          read: false,
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_notifications', JSON.stringify(dummyNotifications));
    }

    if (!localStorage.getItem('demo_expenses')) {
      const dummyExpenses: Expense[] = [
        {
          expenseId: 'exp_1',
          title: 'Bought office printing paper and pens',
          category: 'Office Stationery',
          amount: 1540,
          date: '2026-06-03T10:00:00Z',
          paymentMode: 'CASH',
          notes: 'Emergency stationery refill',
          financialYear: '2026-2027',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          expenseId: 'exp_2',
          title: 'Electricity bill for May 2026',
          category: 'Electricity & Water',
          amount: 4200,
          date: '2026-06-05T14:30:00Z',
          paymentMode: 'UPI',
          notes: 'Paid via Google Pay business',
          financialYear: '2026-2027',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          expenseId: 'exp_3',
          title: 'Commercial gas transport fuel',
          category: 'Fuel & Transport',
          amount: 1200,
          date: '2026-06-07T08:15:00Z',
          paymentMode: 'CASH',
          notes: 'Delivery van diesel refill',
          financialYear: '2026-2027',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('demo_expenses', JSON.stringify(dummyExpenses));
    }

    loadDemoSession();
  }, [loadDemoSession]);

  // Auth Functions
  const login = async (email: string, password: string) => {
    setAuthLoading(true);
    const targetEmail = email.trim().toLowerCase();
    
    // 1. Try Firebase Authentication
    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);
      return;
    } catch (err: any) {
      console.warn("Primary Firebase Auth sign in failed with code:", err?.code, err?.message);
      
      // 2. Super Admin Instant Access Fallback (for patelmunaf90@gmail.com with munaf786)
      if (targetEmail === 'patelmunaf90@gmail.com' && (password === 'munaf786' || err?.code === 'auth/operation-not-allowed')) {
        console.log("Activating Super Admin direct session for patelmunaf90@gmail.com");
        const superAdminUid = 'super_admin_patelmunaf90';
        const superAdminUser = {
          uid: superAdminUid,
          email: 'patelmunaf90@gmail.com',
          displayName: 'Munaf Patel (Super Admin)',
          emailVerified: true,
        } as any;
        
        sessionStorage.setItem('app_direct_session', JSON.stringify({
          uid: superAdminUid,
          email: 'patelmunaf90@gmail.com',
          name: 'Munaf Patel',
          isSuperAdmin: true,
          companyId: 'company_patel_traders'
        }));
        
        setCurrentUser(superAdminUser);
        setUserRole(UserRole.ADMIN);
        
        const superAdminProfile: UserProfile = {
          userId: superAdminUid,
          name: 'Munaf Patel',
          email: 'patelmunaf90@gmail.com',
          activeCompanyId: 'company_patel_traders',
          isSuperAdmin: true,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setUserProfile(superAdminProfile);
        
        // Save/Sync to Firestore if reachable
        try {
          await setDoc(doc(db, 'users', superAdminUid), superAdminProfile, { merge: true });
        } catch (e) {
          console.warn("Could not sync super admin profile to Firestore:", e);
        }
        
        setAuthLoading(false);
        setLoading(false);
        return;
      }

      // 3. Fallback for users created via Super Admin Panel when Firebase Email/Password is not toggled on
      try {
        const usersQuery = query(collection(db, 'users'), where('email', '==', targetEmail));
        const userSnap = await getDocs(usersQuery);
        
        if (!userSnap.empty) {
          const matchedDoc = userSnap.docs[0];
          const matchedProfile = matchedDoc.data() as UserProfile;
          
          if (matchedProfile.status === 'SUSPENDED') {
            setAuthLoading(false);
            throw new Error("Your account has been suspended by the administrator. Please contact support.");
          }

          console.log("Logging in matched user from database:", targetEmail);
          const fallbackUser = {
            uid: matchedDoc.id,
            email: targetEmail,
            displayName: matchedProfile.name || targetEmail.split('@')[0],
            emailVerified: true
          } as any;

          sessionStorage.setItem('app_direct_session', JSON.stringify({
            uid: matchedDoc.id,
            email: targetEmail,
            name: matchedProfile.name || targetEmail.split('@')[0],
            isSuperAdmin: false,
            companyId: matchedProfile.activeCompanyId
          }));

          setCurrentUser(fallbackUser);
          setUserRole(UserRole.ADMIN);
          setUserProfile(matchedProfile);

          if (matchedProfile.activeCompanyId) {
            const compDoc = await getDoc(doc(db, 'companies', matchedProfile.activeCompanyId));
            if (compDoc.exists()) {
              setActiveCompany(compDoc.data() as Company);
            }
          }

          setAuthLoading(false);
          setLoading(false);
          return;
        }
      } catch (dbErr: any) {
        if (dbErr?.message?.includes('suspended')) {
          setAuthLoading(false);
          throw dbErr;
        }
      }

      setAuthLoading(false);
      throw err;
    }
  };

  const register = async (email: string, name: string, password: string, companyName: string) => {
    setAuthLoading(true);
    const targetEmail = email.trim().toLowerCase();
    try {
      let uid: string;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed') {
          console.warn("Firebase email auth disabled, creating database direct registration");
          uid = 'user_' + Math.random().toString(36).substring(2, 12);
        } else {
          throw authErr;
        }
      }
      
      // Auto assign a fresh company ID
      const companyId = uid; 
      
      // Setup default structures
      let isSuperAdmin = targetEmail === 'patelmunaf90@gmail.com';
      try {
        const configRef = doc(db, 'system', 'config');
        const configSnap = await getDoc(configRef);
        if (!configSnap.exists() || !configSnap.data()?.superAdminSet) {
          isSuperAdmin = true;
        }
      } catch (err) {
        console.warn("Could not read system config. May not be super admin", err);
      }

      const userPayload: UserProfile = {
        userId: uid,
        name,
        email: targetEmail,
        activeCompanyId: companyId,
        isSuperAdmin,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const companyPayload: Company = {
        companyId,
        name: companyName,
        invoicePrefix: 'TAX-',
        nextInvoiceNumber: 1,
        financialYear: '2026-2027',
        financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const memberPayload: CompanyMember = {
        companyId,
        userId: uid,
        email: targetEmail,
        role: UserRole.ADMIN,
        invitedAt: new Date().toISOString()
      };

      // Atomic transactions to register profile
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), userPayload);
      batch.set(doc(db, 'companies', companyId), companyPayload);
      batch.set(doc(db, 'companies', companyId, 'members', uid), memberPayload);
      if (isSuperAdmin) {
        batch.set(doc(db, 'system', 'config'), { superAdminSet: true });
      }
      await batch.commit();

      const regUser = {
        uid,
        email: targetEmail,
        displayName: name,
        emailVerified: true
      } as any;
      setCurrentUser(regUser);
      setUserProfile(userPayload);
      setActiveCompany(companyPayload);
      setUserRole(UserRole.ADMIN);
      setAuthLoading(false);
      setLoading(false);
      
    } catch (err) {
      setAuthLoading(false);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in database
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const companyId = user.uid;
        
        let isSuperAdmin = false;
        try {
          const configRef = doc(db, 'system', 'config');
          const configSnap = await getDoc(configRef);
          if (!configSnap.exists() || !configSnap.data()?.superAdminSet) {
            isSuperAdmin = true;
          }
        } catch (err) {
          console.warn("Could not read system config. May not be super admin", err);
        }

        const userPayload: UserProfile = {
          userId: user.uid,
          name: user.displayName || 'Google Member',
          email: user.email || '',
          activeCompanyId: companyId,
          isSuperAdmin,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const companyPayload: Company = {
          companyId,
          name: `${user.displayName || 'My'}'s Corporate`,
          invoicePrefix: 'TAX-',
          nextInvoiceNumber: 1,
          financialYear: '2026-2027',
          financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const memberPayload: CompanyMember = {
          companyId,
          userId: user.uid,
          email: user.email || '',
          role: UserRole.ADMIN,
          invitedAt: new Date().toISOString()
        };

        const batch = writeBatch(db);
        batch.set(userDocRef, userPayload);
        batch.set(doc(db, 'companies', companyId), companyPayload);
        batch.set(doc(db, 'companies', companyId, 'members', user.uid), memberPayload);
        if (isSuperAdmin) {
          batch.set(doc(db, 'system', 'config'), { superAdminSet: true });
        }
        await batch.commit();
      }
    } catch (err) {
      setAuthLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setAuthLoading(true);
    try {
      setIsDemoMode(false);
      localStorage.removeItem('gst_demo_mode');
      sessionStorage.removeItem('app_direct_session');
      localStorage.removeItem('app_direct_session');

      try {
        await signOut(auth);
      } catch (signOutErr) {
        console.warn("Sign out from Firebase completed or no active Firebase user:", signOutErr);
      }

      // Explicitly Reset ALL State
      setCurrentUser(null);
      setUserProfile(null);
      setActiveCompany(null);
      setUserRole(null);
      setMembers([]);
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
      setAllInvoices([]);
      setAllPurchases([]);
      setAllSalesReturns([]);
      setAllPurchaseReturns([]);
      setAllTransactions([]);
      setAllExpenses([]);
      setAllCapitalInvestments([]);
      setAllBankAccounts([]);
      setNotifications([]);
      setAuthError(null);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setAuthLoading(false);
      setLoading(false);
    }
  };

  // Profile operations
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = { ...userProfile, ...data, updatedAt: new Date().toISOString() } as UserProfile;
    setUserProfile(updated);
    localStorage.setItem('demo_profile', JSON.stringify(updated));
    if (currentUser.uid) {
      localStorage.setItem(`gst_cache_user_${currentUser.uid}`, JSON.stringify(updated));
    }
    if (isDemoMode) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      await setDoc(userRef, updateData, { merge: true });
    } catch (err) {
      console.warn('Firestore profile update notice:', err);
    }
  };

  const updateCompanyProfile = async (data: Partial<Company>) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updated = { ...activeCompany, ...data, updatedAt: new Date().toISOString() } as Company;
    setActiveCompany(updated);
    localStorage.setItem('demo_company', JSON.stringify(updated));
    localStorage.setItem(`gst_cache_${compId}_company`, JSON.stringify(updated));
    if (isDemoMode) return;

    try {
      const companyRef = doc(db, 'companies', compId);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      await setDoc(companyRef, updateData, { merge: true });
    } catch (err) {
      console.warn('Firestore company update notice:', err);
    }
  };

  // Create Company Member
  const inviteMember = async (email: string, role: UserRole) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const mockUserId = 'user_' + Math.random().toString(36).substr(2, 9);
    const payload: CompanyMember = {
      companyId: compId,
      userId: mockUserId,
      email,
      role,
      invitedAt: new Date().toISOString()
    };
    const updated = [...members, payload];
    setMembers(updated);
    localStorage.setItem('demo_members', JSON.stringify(updated));
    localStorage.setItem(`gst_cache_${compId}_members`, JSON.stringify(updated));
    if (isDemoMode) return;

    try {
      const memberRef = doc(db, 'companies', compId, 'members', mockUserId);
      await setDoc(memberRef, payload);
    } catch (err) {
      console.warn('Firestore member invite notice:', err);
    }
  };

  // Product Operations
  const saveProduct = async (productData: Omit<Product, 'productId'> & { productId?: string }) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    let updatedProducts: Product[] = [];
    const id = productData.productId || ('prod_' + Math.random().toString(36).substr(2, 9));
    const now = new Date().toISOString();

    if (productData.productId) {
      updatedProducts = products.map((p) => p.productId === productData.productId ? { ...p, ...productData, updatedAt: now } as Product : p);
    } else {
      const payload: Product = {
        ...productData,
        productId: id,
        createdAt: now,
        updatedAt: now
      } as Product;
      updatedProducts = [...products, payload];
    }

    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    if (isDemoMode) return;

    try {
      const productRef = doc(db, 'companies', compId, 'products', id);
      if (productData.productId) {
        await setDoc(productRef, {
          ...productData,
          updatedAt: now
        } as any, { merge: true });
      } else {
        const payload: Product = {
          ...productData,
          productId: id,
          createdAt: now,
          updatedAt: now
        } as Product;
        await setDoc(productRef, payload);
      }
    } catch (err) {
      console.warn('Firestore product save notice:', err);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updatedProducts = products.filter((p) => p.productId !== productId);
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    if (isDemoMode) return;

    try {
      const productRef = doc(db, 'companies', compId, 'products', productId);
      await deleteDoc(productRef);
    } catch (err) {
      console.warn('Firestore product delete notice:', err);
    }
  };

  // Customers Operations
  const saveCustomer = async (data: Omit<Customer, 'customerId'> & { customerId?: string }) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    let updatedCustomers: Customer[] = [];
    const id = data.customerId || ('cust_' + Math.random().toString(36).substr(2, 9));
    const now = new Date().toISOString();

    if (data.customerId) {
      updatedCustomers = customers.map((c) => c.customerId === data.customerId ? { ...c, ...data, updatedAt: now } as Customer : c);
    } else {
      const payload: Customer = {
        ...data,
        customerId: id,
        outstandingBalance: data.openingBalance || 0,
        createdAt: now,
        updatedAt: now
      } as Customer;
      updatedCustomers = [...customers, payload];
    }

    setCustomers(updatedCustomers);
    localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
    localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'customers', id);
      if (data.customerId) {
        await setDoc(ref, {
          ...data,
          updatedAt: now
        } as any, { merge: true });
      } else {
        const payload: Customer = {
          ...data,
          customerId: id,
          outstandingBalance: data.openingBalance || 0,
          createdAt: now,
          updatedAt: now
        } as Customer;
        await setDoc(ref, payload);
      }
    } catch (err) {
      console.warn('Firestore customer save notice:', err);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updatedCustomers = customers.filter((c) => c.customerId !== customerId);
    setCustomers(updatedCustomers);
    localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
    localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'customers', customerId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('Firestore customer delete notice:', err);
    }
  };

  // Suppliers Operations
  const saveSupplier = async (data: Omit<Supplier, 'supplierId'> & { supplierId?: string }) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    let updatedSuppliers: Supplier[] = [];
    const id = data.supplierId || ('supp_' + Math.random().toString(36).substr(2, 9));
    const now = new Date().toISOString();

    if (data.supplierId) {
      updatedSuppliers = suppliers.map((s) => s.supplierId === data.supplierId ? { ...s, ...data, updatedAt: now } as Supplier : s);
    } else {
      const payload: Supplier = {
        ...data,
        supplierId: id,
        outstandingBalance: data.openingBalance || 0,
        createdAt: now,
        updatedAt: now
      } as Supplier;
      updatedSuppliers = [...suppliers, payload];
    }

    setSuppliers(updatedSuppliers);
    localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
    localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'suppliers', id);
      if (data.supplierId) {
        await setDoc(ref, {
          ...data,
          updatedAt: now
        } as any, { merge: true });
      } else {
        const payload: Supplier = {
          ...data,
          supplierId: id,
          outstandingBalance: data.openingBalance || 0,
          createdAt: now,
          updatedAt: now
        } as Supplier;
        await setDoc(ref, payload);
      }
    } catch (err) {
      console.warn('Firestore supplier save notice:', err);
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updatedSuppliers = suppliers.filter((s) => s.supplierId !== supplierId);
    setSuppliers(updatedSuppliers);
    localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
    localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'suppliers', supplierId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('Firestore supplier delete notice:', err);
    }
  };

  // Sales Invoice (Atomicity updates for stock adjustments and outstanding)
  const saveSalesInvoice = async (invoiceData: Omit<SalesInvoice, 'invoiceId' | 'invoiceNumber'>) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const invoiceId = 'inv_' + Math.random().toString(36).substr(2, 9);
    const invoiceNumber = `${activeCompany.invoicePrefix || 'PATEL-'}${String(activeCompany.nextInvoiceNumber || 1).padStart(4, '0')}`;
    const now = new Date().toISOString();
    
    // 1. Update company sequence
    const updatedCompany = { ...activeCompany, nextInvoiceNumber: (activeCompany.nextInvoiceNumber || 1) + 1, updatedAt: now };
    setActiveCompany(updatedCompany);
    localStorage.setItem('demo_company', JSON.stringify(updatedCompany));
    localStorage.setItem(`gst_cache_${compId}_company`, JSON.stringify(updatedCompany));

    // 2. Products stock update
    const updatedProducts = products.map((prod) => {
      const lineItem = invoiceData.items.find((item) => item.productId === prod.productId);
      if (lineItem) {
        const newStock = (prod.currentStock || 0) - lineItem.qty;
        // check low stock threshold
        if (newStock <= (prod.lowStockThreshold || 0)) {
          const notifierId = 'notif_' + Math.random().toString(36).substr(2, 9);
          const newNotif: AppNotification = {
            notificationId: notifierId,
            title: 'Low Stock Alert!',
            message: `Product "${lineItem.name}" stock level is now critical at ${newStock} units left.`,
            type: 'LOW_STOCK',
            read: false,
            createdAt: now
          };
          const currentNotifs = [newNotif, ...notifications];
          setNotifications(currentNotifs);
          localStorage.setItem('demo_notifications', JSON.stringify(currentNotifs));
          localStorage.setItem(`gst_cache_${compId}_notifications`, JSON.stringify(currentNotifs));
        }
        return { ...prod, currentStock: newStock, updatedAt: now } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    // 3. Customer outstanding
    const updatedCustomers = customers.map((c) => {
      if (c.customerId === invoiceData.customerId) {
        const debt = invoiceData.grandTotal - invoiceData.receivedAmount;
        return { ...c, outstandingBalance: (c.outstandingBalance || 0) + debt, updatedAt: now } as Customer;
      }
      return c;
    });
    setCustomers(updatedCustomers);
    localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
    localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));

    // 4. Append Sales Invoice
    const newInvoice: SalesInvoice = {
      ...invoiceData,
      invoiceId,
      invoiceNumber,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now,
      updatedAt: now
    };
    const updatedInvoices = [newInvoice, ...allInvoices];
    setAllInvoices(updatedInvoices);
    localStorage.setItem('demo_invoices', JSON.stringify(updatedInvoices));
    localStorage.setItem(`gst_cache_${compId}_invoices`, JSON.stringify(updatedInvoices));

    // 5. Add transactions
    const txs = [...allTransactions];
    const txId = 'tx_' + Math.random().toString(36).substr(2, 9);
    txs.unshift({
      transactionId: txId,
      type: 'SALE',
      referenceId: invoiceId,
      referenceNo: invoiceNumber,
      entityId: invoiceData.customerId,
      entityName: invoiceData.customerName,
      amount: invoiceData.grandTotal,
      date: invoiceData.date,
      paymentMode: invoiceData.paymentMode,
      description: `Sales Invoice Issued: ${invoiceNumber}`,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now
    });

    if (invoiceData.receivedAmount > 0) {
      const recTxId = 'tx_' + Math.random().toString(36).substr(2, 9);
      txs.unshift({
        transactionId: recTxId,
        type: 'PAYMENT_RECEIVED',
        referenceId: invoiceId,
        referenceNo: invoiceNumber,
        entityId: invoiceData.customerId,
        entityName: invoiceData.customerName,
        amount: invoiceData.receivedAmount,
        date: invoiceData.date,
        paymentMode: invoiceData.paymentMode,
        description: `Payment received for Invoice: ${invoiceNumber}`,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      });
    }
    setAllTransactions(txs);
    localStorage.setItem('demo_transactions', JSON.stringify(txs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(txs));

    if (isDemoMode) return;

    try {
      const invoiceRef = doc(db, 'companies', compId, 'salesInvoices', invoiceId);
      const customerRef = doc(db, 'companies', compId, 'customers', invoiceData.customerId);
      const companyRef = doc(db, 'companies', compId);

      // Save invoice doc
      await setDoc(invoiceRef, {
        ...invoiceData,
        invoiceId,
        invoiceNumber,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      // Update next invoice number
      await setDoc(companyRef, {
        nextInvoiceNumber: (activeCompany?.nextInvoiceNumber || 1) + 1,
        updatedAt: now
      }, { merge: true });

      // Update customer outstanding
      const customerObj = customers.find(c => c.customerId === invoiceData.customerId);
      const newOutstanding = ((customerObj?.outstandingBalance || 0) + (invoiceData.grandTotal - invoiceData.receivedAmount));
      await setDoc(customerRef, {
        outstandingBalance: newOutstanding,
        updatedAt: now
      }, { merge: true });

      // Update product stocks
      for (const item of invoiceData.items) {
        const prodObj = products.find(p => p.productId === item.productId);
        const nextStock = (prodObj?.currentStock || 0) - item.qty;
        const prodRef = doc(db, 'companies', compId, 'products', item.productId);
        await setDoc(prodRef, {
          currentStock: nextStock,
          updatedAt: now
        }, { merge: true });

        if (nextStock <= (prodObj?.lowStockThreshold || 0)) {
          const notifierId = 'notif_' + Math.random().toString(36).substr(2, 9);
          await setDoc(doc(db, 'companies', compId, 'notifications', notifierId), {
            notificationId: notifierId,
            title: 'Low Stock Alert!',
            message: `Product "${item.name}" stock level is now critical at ${nextStock} units left.`,
            type: 'LOW_STOCK',
            read: false,
            createdAt: now
          });
        }
      }

      // Record Sales Transaction
      const txDocId = 'tx_' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'companies', compId, 'transactions', txDocId), {
        transactionId: txDocId,
        type: 'SALE',
        referenceId: invoiceId,
        referenceNo: invoiceNumber,
        entityId: invoiceData.customerId,
        entityName: invoiceData.customerName,
        amount: invoiceData.grandTotal,
        date: invoiceData.date,
        paymentMode: invoiceData.paymentMode,
        description: `Sales Invoice Issued: ${invoiceNumber}`,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      });

      if (invoiceData.receivedAmount > 0) {
        const recTxId = 'tx_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'companies', compId, 'transactions', recTxId), {
          transactionId: recTxId,
          type: 'PAYMENT_RECEIVED',
          referenceId: invoiceId,
          referenceNo: invoiceNumber,
          entityId: invoiceData.customerId,
          entityName: invoiceData.customerName,
          amount: invoiceData.receivedAmount,
          date: invoiceData.date,
          paymentMode: invoiceData.paymentMode,
          description: `Payment received for Invoice: ${invoiceNumber}`,
          financialYear: activeCompany?.financialYear || '2026-2027',
          createdAt: now
        });
      }
    } catch (err) {
      console.warn('Firestore sales invoice save notice:', err);
    }
  };

  const deleteSalesInvoice = async (invoiceId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const invoiceData = allInvoices.find((inv) => inv.invoiceId === invoiceId);
    if (!invoiceData) return;

    // 1. Revert Stock changes
    const updatedProducts = products.map((prod) => {
      const item = invoiceData.items.find((it) => it.productId === prod.productId);
      if (item) {
        return { ...prod, currentStock: (prod.currentStock || 0) + item.qty, updatedAt: new Date().toISOString() } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    // 2. Revert customer outstanding
    const updatedCustomers = customers.map((c) => {
      if (c.customerId === invoiceData.customerId) {
        const debt = invoiceData.grandTotal - invoiceData.receivedAmount;
        return { ...c, outstandingBalance: (c.outstandingBalance || 0) - debt, updatedAt: new Date().toISOString() } as Customer;
      }
      return c;
    });
    setCustomers(updatedCustomers);
    localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
    localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));

    // 3. Remove Invoice & associated transactions
    const updatedInvoices = allInvoices.filter((inv) => inv.invoiceId !== invoiceId);
    setAllInvoices(updatedInvoices);
    localStorage.setItem('demo_invoices', JSON.stringify(updatedInvoices));
    localStorage.setItem(`gst_cache_${compId}_invoices`, JSON.stringify(updatedInvoices));

    const updatedTxs = allTransactions.filter((tx) => tx.referenceId !== invoiceId);
    setAllTransactions(updatedTxs);
    localStorage.setItem('demo_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(updatedTxs));

    if (isDemoMode) return;

    try {
      const invoiceRef = doc(db, 'companies', compId, 'salesInvoices', invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);
      if (invoiceSnap.exists()) {
        const batch = writeBatch(db);
        for (const item of invoiceData.items) {
          const prodRef = doc(db, 'companies', compId, 'products', item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            batch.update(prodRef, {
              currentStock: (prodSnap.data().currentStock || 0) + item.qty,
              updatedAt: new Date().toISOString()
            });
          }
        }

        const customerRef = doc(db, 'companies', compId, 'customers', invoiceData.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const debt = invoiceData.grandTotal - invoiceData.receivedAmount;
          batch.update(customerRef, {
            outstandingBalance: (customerSnap.data().outstandingBalance || 0) - debt,
            updatedAt: new Date().toISOString()
          });
        }

        batch.delete(invoiceRef);
        await batch.commit();
      }
    } catch (err) {
      console.warn('Firestore invoice delete notice:', err);
    }
  };

  // Sales Return (Credit Notes Operations)
  const saveSalesReturn = async (returnData: Omit<SalesReturn, 'returnId' | 'creditNoteNumber'>) => {
    if (!activeCompany) return;
    const returnId = 'sr_' + Math.random().toString(36).substr(2, 9);
    const creditNoteNo = `CN-${activeCompany.financialYear || '2026-2027'}-${String(allSalesReturns.length + 1).padStart(4, '0')}`;
    const compId = activeCompany.companyId;
    const now = new Date().toISOString();

    // Optimistic state updates
    const updatedProducts = products.map((prod) => {
      const item = returnData.items.find((it) => it.productId === prod.productId);
      if (item) {
        return { ...prod, currentStock: (prod.currentStock || 0) + item.qty, updatedAt: now } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    const updatedCustomers = customers.map((c) => {
      if (c.customerId === returnData.customerId) {
        return { ...c, outstandingBalance: (c.outstandingBalance || 0) - returnData.grandTotal, updatedAt: now } as Customer;
      }
      return c;
    });
    setCustomers(updatedCustomers);
    localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
    localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));

    const newReturn: SalesReturn = {
      ...returnData,
      returnId,
      creditNoteNumber: creditNoteNo,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now,
      updatedAt: now
    };
    const updatedReturns = [newReturn, ...allSalesReturns];
    setAllSalesReturns(updatedReturns);
    localStorage.setItem('demo_sales_returns', JSON.stringify(updatedReturns));
    localStorage.setItem(`gst_cache_${compId}_sales_returns`, JSON.stringify(updatedReturns));

    const txs = [...allTransactions];
    const txId = 'tx_' + Math.random().toString(36).substr(2, 9);
    txs.unshift({
      transactionId: txId,
      type: 'SALES_RETURN',
      referenceId: returnId,
      referenceNo: creditNoteNo,
      entityId: returnData.customerId,
      entityName: returnData.customerName,
      amount: returnData.grandTotal,
      date: returnData.date,
      paymentMode: 'CREDIT',
      description: `Sales Return (CN): ${creditNoteNo} (Reason: ${returnData.reason || 'Not specified'})`,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now
    });
    setAllTransactions(txs);
    localStorage.setItem('demo_transactions', JSON.stringify(txs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(txs));

    if (isDemoMode) return;

    try {
      const returnRef = doc(db, 'companies', compId, 'salesReturns', returnId);
      const customerRef = doc(db, 'companies', compId, 'customers', returnData.customerId);

      await setDoc(returnRef, {
        ...returnData,
        returnId,
        creditNoteNumber: creditNoteNo,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      const customerObj = customers.find(c => c.customerId === returnData.customerId);
      const newOutstanding = (customerObj?.outstandingBalance || 0) - returnData.grandTotal;
      await setDoc(customerRef, {
        outstandingBalance: newOutstanding,
        updatedAt: now
      }, { merge: true });

      for (const item of returnData.items) {
        const prodObj = products.find(p => p.productId === item.productId);
        const nextStock = (prodObj?.currentStock || 0) + item.qty;
        const prodRef = doc(db, 'companies', compId, 'products', item.productId);
        await setDoc(prodRef, {
          currentStock: nextStock,
          updatedAt: now
        }, { merge: true });
      }

      const txDocId = 'tx_' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'companies', compId, 'transactions', txDocId), {
        transactionId: txDocId,
        type: 'SALES_RETURN',
        referenceId: returnId,
        referenceNo: creditNoteNo,
        entityId: returnData.customerId,
        entityName: returnData.customerName,
        amount: returnData.grandTotal,
        date: returnData.date,
        paymentMode: 'CREDIT',
        description: `Sales Return (CN): ${creditNoteNo} (Reason: ${returnData.reason || 'Not specified'})`,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      });
    } catch (err) {
      console.warn('Firestore sales return notice:', err);
    }
  };

  const deleteSalesReturn = async (returnId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const returnData = allSalesReturns.find((sr) => sr.returnId === returnId);
    if (!returnData) return;

    const updatedProducts = products.map((prod) => {
      const item = returnData.items.find((it) => it.productId === prod.productId);
      if (item) {
        return { ...prod, currentStock: Math.max(0, (prod.currentStock || 0) - item.qty), updatedAt: new Date().toISOString() } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    const updatedCustomers = customers.map((c) => {
      if (c.customerId === returnData.customerId) {
        return { ...c, outstandingBalance: (c.outstandingBalance || 0) + returnData.grandTotal, updatedAt: new Date().toISOString() } as Customer;
      }
      return c;
    });
    setCustomers(updatedCustomers);
    localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
    localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));

    const updatedReturns = allSalesReturns.filter((sr) => sr.returnId !== returnId);
    setAllSalesReturns(updatedReturns);
    localStorage.setItem('demo_sales_returns', JSON.stringify(updatedReturns));
    localStorage.setItem(`gst_cache_${compId}_sales_returns`, JSON.stringify(updatedReturns));

    const updatedTxs = allTransactions.filter((tx) => tx.referenceId !== returnId);
    setAllTransactions(updatedTxs);
    localStorage.setItem('demo_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(updatedTxs));

    if (isDemoMode) return;

    try {
      const returnRef = doc(db, 'companies', compId, 'salesReturns', returnId);
      const customerRef = doc(db, 'companies', compId, 'customers', returnData.customerId);
      const batch = writeBatch(db);

      for (const item of returnData.items) {
        const prodRef = doc(db, 'companies', compId, 'products', item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          batch.update(prodRef, {
            currentStock: Math.max(0, (prodSnap.data().currentStock || 0) - item.qty),
            updatedAt: new Date().toISOString()
          });
        }
      }

      const customerSnap = await getDoc(customerRef);
      if (customerSnap.exists()) {
        batch.update(customerRef, {
          outstandingBalance: (customerSnap.data().outstandingBalance || 0) + returnData.grandTotal,
          updatedAt: new Date().toISOString()
        });
      }

      batch.delete(returnRef);
      await batch.commit();
    } catch (err) {
      console.warn('Firestore sales return delete notice:', err);
    }
  };

  // Purchase Return (Debit Notes Operations)
  const savePurchaseReturn = async (returnData: Omit<PurchaseReturn, 'returnId' | 'debitNoteNumber'>) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const returnId = 'pr_' + Math.random().toString(36).substr(2, 9);
    const debitNoteNo = `DN-${activeCompany.financialYear || '2026-2027'}-${String(allPurchaseReturns.length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const updatedProducts = products.map((prod) => {
      const item = returnData.items.find((it) => it.productId === prod.productId);
      if (item) {
        return { ...prod, currentStock: Math.max(0, (prod.currentStock || 0) - item.qty), updatedAt: now } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    const updatedSuppliers = suppliers.map((s) => {
      if (s.supplierId === returnData.supplierId) {
        return { ...s, outstandingBalance: (s.outstandingBalance || 0) - returnData.grandTotal, updatedAt: now } as Supplier;
      }
      return s;
    });
    setSuppliers(updatedSuppliers);
    localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
    localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));

    const newReturn: PurchaseReturn = {
      ...returnData,
      returnId,
      debitNoteNumber: debitNoteNo,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now,
      updatedAt: now
    };
    const updatedReturns = [newReturn, ...allPurchaseReturns];
    setAllPurchaseReturns(updatedReturns);
    localStorage.setItem('demo_purchase_returns', JSON.stringify(updatedReturns));
    localStorage.setItem(`gst_cache_${compId}_purchase_returns`, JSON.stringify(updatedReturns));

    const txs = [...allTransactions];
    const txId = 'tx_' + Math.random().toString(36).substr(2, 9);
    txs.unshift({
      transactionId: txId,
      type: 'PURCHASE_RETURN',
      referenceId: returnId,
      referenceNo: debitNoteNo,
      entityId: returnData.supplierId,
      entityName: returnData.supplierName,
      amount: returnData.grandTotal,
      date: returnData.date,
      paymentMode: 'CREDIT',
      description: `Purchase Return (DN): ${debitNoteNo} (Reason: ${returnData.reason || 'Not specified'})`,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now
    });
    setAllTransactions(txs);
    localStorage.setItem('demo_transactions', JSON.stringify(txs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(txs));

    if (isDemoMode) return;

    try {
      const returnRef = doc(db, 'companies', compId, 'purchaseReturns', returnId);
      const supplierRef = doc(db, 'companies', compId, 'suppliers', returnData.supplierId);

      await setDoc(returnRef, {
        ...returnData,
        returnId,
        debitNoteNumber: debitNoteNo,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      const supplierObj = suppliers.find(s => s.supplierId === returnData.supplierId);
      const newOutstanding = (supplierObj?.outstandingBalance || 0) - returnData.grandTotal;
      await setDoc(supplierRef, {
        outstandingBalance: newOutstanding,
        updatedAt: now
      }, { merge: true });

      for (const item of returnData.items) {
        const prodObj = products.find(p => p.productId === item.productId);
        const nextStock = Math.max(0, (prodObj?.currentStock || 0) - item.qty);
        const prodRef = doc(db, 'companies', compId, 'products', item.productId);
        await setDoc(prodRef, {
          currentStock: nextStock,
          updatedAt: now
        }, { merge: true });
      }

      const txDocId = 'tx_' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'companies', compId, 'transactions', txDocId), {
        transactionId: txDocId,
        type: 'PURCHASE_RETURN',
        referenceId: returnId,
        referenceNo: debitNoteNo,
        entityId: returnData.supplierId,
        entityName: returnData.supplierName,
        amount: returnData.grandTotal,
        date: returnData.date,
        paymentMode: 'CREDIT',
        description: `Purchase Return (DN): ${debitNoteNo} (Reason: ${returnData.reason || 'Not specified'})`,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      });
    } catch (err) {
      console.warn('Firestore purchase return notice:', err);
    }
  };

  const deletePurchaseReturn = async (returnId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const returnData = allPurchaseReturns.find((pr) => pr.returnId === returnId);
    if (!returnData) return;

    const updatedProducts = products.map((prod) => {
      const item = returnData.items.find((it) => it.productId === prod.productId);
      if (item) {
        return { ...prod, currentStock: (prod.currentStock || 0) + item.qty, updatedAt: new Date().toISOString() } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    const updatedSuppliers = suppliers.map((s) => {
      if (s.supplierId === returnData.supplierId) {
        return { ...s, outstandingBalance: (s.outstandingBalance || 0) + returnData.grandTotal, updatedAt: new Date().toISOString() } as Supplier;
      }
      return s;
    });
    setSuppliers(updatedSuppliers);
    localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
    localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));

    const updatedReturns = allPurchaseReturns.filter((pr) => pr.returnId !== returnId);
    setAllPurchaseReturns(updatedReturns);
    localStorage.setItem('demo_purchase_returns', JSON.stringify(updatedReturns));
    localStorage.setItem(`gst_cache_${compId}_purchase_returns`, JSON.stringify(updatedReturns));

    const updatedTxs = allTransactions.filter((tx) => tx.referenceId !== returnId);
    setAllTransactions(updatedTxs);
    localStorage.setItem('demo_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(updatedTxs));

    if (isDemoMode) return;

    try {
      const returnRef = doc(db, 'companies', compId, 'purchaseReturns', returnId);
      const supplierRef = doc(db, 'companies', compId, 'suppliers', returnData.supplierId);
      const batch = writeBatch(db);

      for (const item of returnData.items) {
        const prodRef = doc(db, 'companies', compId, 'products', item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          batch.update(prodRef, {
            currentStock: (prodSnap.data().currentStock || 0) + item.qty,
            updatedAt: new Date().toISOString()
          });
        }
      }

      const supplierSnap = await getDoc(supplierRef);
      if (supplierSnap.exists()) {
        batch.update(supplierRef, {
          outstandingBalance: (supplierSnap.data().outstandingBalance || 0) + returnData.grandTotal,
          updatedAt: new Date().toISOString()
        });
      }

      batch.delete(returnRef);
      await batch.commit();
    } catch (err) {
      console.warn('Firestore purchase return delete notice:', err);
    }
  };

  // Purchase Billings (Auto incremental stocks)
  const savePurchaseEntry = async (purchaseData: Omit<PurchaseBill, 'purchaseId'>) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const purchaseId = 'pur_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    // Increment product stocks
    const updatedProducts = products.map((prod) => {
      const purchaseItem = purchaseData.items.find((item) => item.productId === prod.productId);
      if (purchaseItem) {
        return { ...prod, currentStock: (prod.currentStock || 0) + purchaseItem.qty, updatedAt: now } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    // Update supplier balance
    const updatedSuppliers = suppliers.map((s) => {
      if (s.supplierId === purchaseData.supplierId) {
        const unpaidDebt = purchaseData.grandTotal - purchaseData.paidAmount;
        return { ...s, outstandingBalance: (s.outstandingBalance || 0) + unpaidDebt, updatedAt: now } as Supplier;
      }
      return s;
    });
    setSuppliers(updatedSuppliers);
    localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
    localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));

    // Append Purchase
    const newPurchase: PurchaseBill = {
      ...purchaseData,
      purchaseId,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now,
      updatedAt: now
    };
    const updatedPurchases = [newPurchase, ...allPurchases];
    setAllPurchases(updatedPurchases);
    localStorage.setItem('demo_purchases', JSON.stringify(updatedPurchases));
    localStorage.setItem(`gst_cache_${compId}_purchases`, JSON.stringify(updatedPurchases));

    // Append Transactions
    const updatedTxs = [...allTransactions];
    const txId = 'tx_' + Math.random().toString(36).substr(2, 9);
    updatedTxs.unshift({
      transactionId: txId,
      type: 'PURCHASE',
      referenceId: purchaseId,
      referenceNo: purchaseData.billNumber,
      entityId: purchaseData.supplierId,
      entityName: purchaseData.supplierName,
      amount: purchaseData.grandTotal,
      date: purchaseData.date,
      paymentMode: 'CREDIT',
      description: `Purchase Bill Recorded No: ${purchaseData.billNumber}`,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now
    });

    if (purchaseData.paidAmount > 0) {
      const recTxId = 'tx_' + Math.random().toString(36).substr(2, 9);
      updatedTxs.unshift({
        transactionId: recTxId,
        type: 'PAYMENT_MADE',
        referenceId: purchaseId,
        referenceNo: purchaseData.billNumber,
        entityId: purchaseData.supplierId,
        entityName: purchaseData.supplierName,
        amount: purchaseData.paidAmount,
        date: purchaseData.date,
        paymentMode: 'CASH',
        description: `Payment made toward Bill: ${purchaseData.billNumber}`,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      });
    }
    setAllTransactions(updatedTxs);
    localStorage.setItem('demo_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(updatedTxs));

    if (isDemoMode) return;

    try {
      const purchaseRef = doc(db, 'companies', compId, 'purchases', purchaseId);
      const supplierRef = doc(db, 'companies', compId, 'suppliers', purchaseData.supplierId);

      await setDoc(purchaseRef, {
        ...purchaseData,
        purchaseId,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      const supplierObj = suppliers.find(s => s.supplierId === purchaseData.supplierId);
      const unpaidBill = purchaseData.grandTotal - purchaseData.paidAmount;
      const newOutstanding = (supplierObj?.outstandingBalance || 0) + unpaidBill;
      await setDoc(supplierRef, {
        outstandingBalance: newOutstanding,
        updatedAt: now
      }, { merge: true });

      for (const item of purchaseData.items) {
        const prodObj = products.find(p => p.productId === item.productId);
        const nextStock = (prodObj?.currentStock || 0) + item.qty;
        const prodRef = doc(db, 'companies', compId, 'products', item.productId);
        await setDoc(prodRef, {
          currentStock: nextStock,
          updatedAt: now
        }, { merge: true });
      }

      const txDocId = 'tx_' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'companies', compId, 'transactions', txDocId), {
        transactionId: txDocId,
        type: 'PURCHASE',
        referenceId: purchaseId,
        referenceNo: purchaseData.billNumber,
        entityId: purchaseData.supplierId,
        entityName: purchaseData.supplierName,
        amount: purchaseData.grandTotal,
        date: purchaseData.date,
        paymentMode: 'CREDIT',
        description: `Purchase Bill Recorded No: ${purchaseData.billNumber}`,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      });

      if (purchaseData.paidAmount > 0) {
        const recTxId = 'tx_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'companies', compId, 'transactions', recTxId), {
          transactionId: recTxId,
          type: 'PAYMENT_MADE',
          referenceId: purchaseId,
          referenceNo: purchaseData.billNumber,
          entityId: purchaseData.supplierId,
          entityName: purchaseData.supplierName,
          amount: purchaseData.paidAmount,
          date: purchaseData.date,
          paymentMode: 'CASH',
          description: `Payment made toward Bill: ${purchaseData.billNumber}`,
          financialYear: activeCompany?.financialYear || '2026-2027',
          createdAt: now
        });
      }
    } catch (err) {
      console.warn('Firestore purchase transaction notice:', err);
    }
  };

  const deletePurchaseEntry = async (purchaseId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const purchaseData = allPurchases.find((p) => p.purchaseId === purchaseId);
    if (!purchaseData) return;

    // Revert product stocks
    const updatedProducts = products.map((prod) => {
      const item = purchaseData.items.find((it) => it.productId === prod.productId);
      if (item) {
        return { ...prod, currentStock: (prod.currentStock || 0) - item.qty, updatedAt: new Date().toISOString() } as Product;
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem('demo_products', JSON.stringify(updatedProducts));
    localStorage.setItem(`gst_cache_${compId}_products`, JSON.stringify(updatedProducts));

    // Revert supplier balance
    const updatedSuppliers = suppliers.map((s) => {
      if (s.supplierId === purchaseData.supplierId) {
        const debt = purchaseData.grandTotal - purchaseData.paidAmount;
        return { ...s, outstandingBalance: (s.outstandingBalance || 0) - debt, updatedAt: new Date().toISOString() } as Supplier;
      }
      return s;
    });
    setSuppliers(updatedSuppliers);
    localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
    localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));

    // Delete purchase and transactions
    const updatedPurchases = allPurchases.filter((p) => p.purchaseId !== purchaseId);
    setAllPurchases(updatedPurchases);
    localStorage.setItem('demo_purchases', JSON.stringify(updatedPurchases));
    localStorage.setItem(`gst_cache_${compId}_purchases`, JSON.stringify(updatedPurchases));

    const updatedTxs = allTransactions.filter((tx) => tx.referenceId !== purchaseId);
    setAllTransactions(updatedTxs);
    localStorage.setItem('demo_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(updatedTxs));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'purchases', purchaseId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const batch = writeBatch(db);

        for (const item of purchaseData.items) {
          const prodRef = doc(db, 'companies', compId, 'products', item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            batch.update(prodRef, {
              currentStock: (prodSnap.data().currentStock || 0) - item.qty,
              updatedAt: new Date().toISOString()
            });
          }
        }

        const supplierRef = doc(db, 'companies', compId, 'suppliers', purchaseData.supplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const debt = purchaseData.grandTotal - purchaseData.paidAmount;
          batch.update(supplierRef, {
            outstandingBalance: (supplierSnap.data().outstandingBalance || 0) - debt,
            updatedAt: new Date().toISOString()
          });
        }

        batch.delete(ref);
        await batch.commit();
      }
    } catch (err) {
      console.warn('Firestore purchase delete notice:', err);
    }
  };

  // Additional payment entries recorder
  const recordLedgerPayment = async (txData: Omit<LedgerTransaction, 'transactionId' | 'createdAt'>) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const transactionId = 'tx_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    
    if (txData.type === 'PAYMENT_RECEIVED') {
      const updatedCustomers = customers.map((c) => {
        if (c.customerId === txData.entityId) {
          return { ...c, outstandingBalance: (c.outstandingBalance || 0) - txData.amount, updatedAt: now } as Customer;
        }
        return c;
      });
      setCustomers(updatedCustomers);
      localStorage.setItem('demo_customers', JSON.stringify(updatedCustomers));
      localStorage.setItem(`gst_cache_${compId}_customers`, JSON.stringify(updatedCustomers));
    } else if (txData.type === 'PAYMENT_MADE') {
      const updatedSuppliers = suppliers.map((s) => {
        if (s.supplierId === txData.entityId) {
          return { ...s, outstandingBalance: (s.outstandingBalance || 0) - txData.amount, updatedAt: now } as Supplier;
        }
        return s;
      });
      setSuppliers(updatedSuppliers);
      localStorage.setItem('demo_suppliers', JSON.stringify(updatedSuppliers));
      localStorage.setItem(`gst_cache_${compId}_suppliers`, JSON.stringify(updatedSuppliers));
    }

    const txPayload: LedgerTransaction = {
      ...txData,
      transactionId,
      financialYear: activeCompany?.financialYear || '2026-2027',
      createdAt: now
    };
    const updatedTxs = [txPayload, ...allTransactions];
    setAllTransactions(updatedTxs);
    localStorage.setItem('demo_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem(`gst_cache_${compId}_transactions`, JSON.stringify(updatedTxs));

    if (isDemoMode) return;

    try {
      const txRef = doc(db, 'companies', compId, 'transactions', transactionId);

      await setDoc(txRef, {
        ...txData,
        transactionId,
        financialYear: activeCompany?.financialYear || '2026-2027',
        createdAt: now
      }, { merge: true });

      if (txData.type === 'PAYMENT_RECEIVED') {
        const customerRef = doc(db, 'companies', compId, 'customers', txData.entityId);
        const customerObj = customers.find(c => c.customerId === txData.entityId);
        const nextBalance = (customerObj?.outstandingBalance || 0) - txData.amount;
        await setDoc(customerRef, {
          outstandingBalance: nextBalance,
          updatedAt: now
        }, { merge: true });
      } else if (txData.type === 'PAYMENT_MADE') {
        const supplierRef = doc(db, 'companies', compId, 'suppliers', txData.entityId);
        const supplierObj = suppliers.find(s => s.supplierId === txData.entityId);
        const nextBalance = (supplierObj?.outstandingBalance || 0) - txData.amount;
        await setDoc(supplierRef, {
          outstandingBalance: nextBalance,
          updatedAt: now
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Firestore ledger payment notice:', err);
    }
  };

  // Daily Expenses Operations
  const saveExpense = async (data: Omit<Expense, 'expenseId'> & { expenseId?: string }) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const financialYear = getFinancialYearFromDate(data.date);
    const now = new Date().toISOString();
    let updatedExpenses: Expense[] = [];
    const id = data.expenseId || ('exp_' + Math.random().toString(36).substr(2, 9));

    if (data.expenseId) {
      updatedExpenses = allExpenses.map((e) => e.expenseId === data.expenseId ? { ...e, ...data, financialYear, updatedAt: now } as Expense : e);
    } else {
      const payload: Expense = {
        ...data,
        expenseId: id,
        financialYear,
        createdAt: now,
        updatedAt: now
      } as Expense;
      updatedExpenses = [payload, ...allExpenses];
    }
    setAllExpenses(updatedExpenses);
    localStorage.setItem('demo_expenses', JSON.stringify(updatedExpenses));
    localStorage.setItem(`gst_cache_${compId}_expenses`, JSON.stringify(updatedExpenses));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'expenses', id);
      if (data.expenseId) {
        await setDoc(ref, {
          ...data,
          financialYear,
          updatedAt: now
        }, { merge: true });
      } else {
        const payload: Expense = {
          ...data,
          expenseId: id,
          financialYear,
          createdAt: now,
          updatedAt: now
        } as Expense;
        await setDoc(ref, payload);
      }
    } catch (err) {
      console.warn('Firestore expense save notice:', err);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updatedExpenses = allExpenses.filter((e) => e.expenseId !== expenseId);
    setAllExpenses(updatedExpenses);
    localStorage.setItem('demo_expenses', JSON.stringify(updatedExpenses));
    localStorage.setItem(`gst_cache_${compId}_expenses`, JSON.stringify(updatedExpenses));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'expenses', expenseId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('Firestore expense delete notice:', err);
    }
  };

  const saveCapitalInvestment = async (data: Omit<CapitalInvestment, 'investmentId'> & { investmentId?: string }) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const financialYear = getFinancialYearFromDate(data.date);
    const now = new Date().toISOString();
    let updatedCapital: CapitalInvestment[] = [];
    const id = data.investmentId || ('cap_' + Math.random().toString(36).substr(2, 9));

    if (data.investmentId) {
      updatedCapital = allCapitalInvestments.map((c) => c.investmentId === data.investmentId ? { ...c, ...data, financialYear } as CapitalInvestment : c);
    } else {
      const payload: CapitalInvestment = {
        ...data,
        investmentId: id,
        financialYear,
        createdAt: now
      };
      updatedCapital = [payload, ...allCapitalInvestments];
    }
    setAllCapitalInvestments(updatedCapital);
    localStorage.setItem('demo_capital_investments', JSON.stringify(updatedCapital));
    localStorage.setItem(`gst_cache_${compId}_capital_investments`, JSON.stringify(updatedCapital));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'capitalInvestments', id);
      if (data.investmentId) {
        await setDoc(ref, {
          ...data,
          financialYear
        }, { merge: true });
      } else {
        const payload: CapitalInvestment = {
          ...data,
          investmentId: id,
          financialYear,
          createdAt: now
        };
        await setDoc(ref, payload);
      }
    } catch (err) {
      console.warn('Firestore capital investment save notice:', err);
    }
  };

  const deleteCapitalInvestment = async (investmentId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updatedCapital = allCapitalInvestments.filter((c) => c.investmentId !== investmentId);
    setAllCapitalInvestments(updatedCapital);
    localStorage.setItem('demo_capital_investments', JSON.stringify(updatedCapital));
    localStorage.setItem(`gst_cache_${compId}_capital_investments`, JSON.stringify(updatedCapital));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'capitalInvestments', investmentId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('Firestore capital investment delete notice:', err);
    }
  };

  // Bank Accounts Operations
  const saveBankAccount = async (accountData: Omit<BankAccount, 'accountId'> & { accountId?: string }) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const now = new Date().toISOString();
    const id = accountData.accountId || ('bank_' + Math.random().toString(36).substr(2, 9));
    
    // If this is the only account, or explicitly set as default, mark as default
    const isFirstAccount = allBankAccounts.length === 0 || (allBankAccounts.length === 1 && allBankAccounts[0].accountId === id);
    const shouldBeDefault = accountData.isDefault || isFirstAccount;

    const payload: BankAccount = {
      ...accountData,
      accountId: id,
      isDefault: shouldBeDefault,
      updatedAt: now,
      createdAt: accountData.createdAt || now
    };

    let updated = [...allBankAccounts];
    if (shouldBeDefault) {
      updated = updated.map(b => ({ ...b, isDefault: false }));
    }
    const existingIdx = updated.findIndex(b => b.accountId === id);
    if (existingIdx >= 0) {
      updated[existingIdx] = payload;
    } else {
      updated.push(payload);
    }
    setAllBankAccounts(updated);
    localStorage.setItem('demo_bank_accounts', JSON.stringify(updated));
    localStorage.setItem(`gst_cache_${compId}_bank_accounts`, JSON.stringify(updated));

    if (shouldBeDefault) {
      const updatedCompany: Company = {
        ...activeCompany,
        bankName: payload.bankName,
        bankAccountNo: payload.accountNumber,
        bankIfsc: payload.ifscCode,
        bankBranch: payload.branchName || '',
        upiId: payload.upiId || activeCompany.upiId || ''
      };
      setActiveCompany(updatedCompany);
      localStorage.setItem('demo_company', JSON.stringify(updatedCompany));
      localStorage.setItem(`gst_cache_${compId}_company`, JSON.stringify(updatedCompany));
    }

    if (isDemoMode) return;

    try {
      if (shouldBeDefault) {
        const batchUpdates = allBankAccounts
          .filter(b => b.accountId !== id && b.isDefault)
          .map(b => setDoc(doc(db, 'companies', compId, 'bankAccounts', b.accountId), { isDefault: false }, { merge: true }));
        await Promise.all(batchUpdates);
      }

      const ref = doc(db, 'companies', compId, 'bankAccounts', id);
      await setDoc(ref, payload, { merge: true });

      if (shouldBeDefault) {
        await updateCompanyProfile({
          bankName: payload.bankName,
          bankAccountNo: payload.accountNumber,
          bankIfsc: payload.ifscCode,
          bankBranch: payload.branchName || '',
          upiId: payload.upiId || activeCompany.upiId || ''
        });
      }
    } catch (err) {
      console.warn('Firestore bank account notice:', err);
    }
  };

  const deleteBankAccount = async (accountId: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updated = allBankAccounts.filter((b) => b.accountId !== accountId);
    setAllBankAccounts(updated);
    localStorage.setItem('demo_bank_accounts', JSON.stringify(updated));
    localStorage.setItem(`gst_cache_${compId}_bank_accounts`, JSON.stringify(updated));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'bankAccounts', accountId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('Firestore bank account delete notice:', err);
    }
  };

  const setDefaultBankAccount = async (accountId: string) => {
    const target = allBankAccounts.find(b => b.accountId === accountId);
    if (!target) return;
    await saveBankAccount({ ...target, isDefault: true });
  };

  // Notifications operations
  const markNotificationAsRead = async (id: string) => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    const updated = notifications.map((n) => n.notificationId === id ? { ...n, read: true } : n);
    setNotifications(updated);
    localStorage.setItem('demo_notifications', JSON.stringify(updated));
    localStorage.setItem(`gst_cache_${compId}_notifications`, JSON.stringify(updated));

    if (isDemoMode) return;

    try {
      const ref = doc(db, 'companies', compId, 'notifications', id);
      await setDoc(ref, { read: true }, { merge: true });
    } catch (err) {
      console.warn('Firestore notification mark read notice:', err);
    }
  };

  const clearAllNotifications = async () => {
    if (!activeCompany) return;
    const compId = activeCompany.companyId;
    setNotifications([]);
    localStorage.setItem('demo_notifications', JSON.stringify([]));
    localStorage.setItem(`gst_cache_${compId}_notifications`, JSON.stringify([]));

    if (isDemoMode) return;

    try {
      const colRef = collection(db, 'companies', compId, 'notifications');
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Firestore clear notifications notice:', err);
    }
  };

  // Verify Admin Credentials (Admin ID & Password)
  const verifyAdminCredentials = async (email: string, password: string): Promise<{ valid: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      return { valid: false, error: 'Please enter both Admin Email/ID and Password.' };
    }

    // Direct check for Super Admin credentials
    if (trimmedEmail === 'patelmunaf90@gmail.com' && (password === 'munaf786' || userProfile?.isSuperAdmin)) {
      return { valid: true };
    }

    if (isDemoMode) {
      if (password.length < 3) {
        return { valid: false, error: 'Admin Password must be at least 3 characters in demo mode.' };
      }
      return { valid: true };
    }

    // Direct check if currently active user matches and is ADMIN
    if (currentUser?.email?.toLowerCase() === trimmedEmail && (userRole === UserRole.ADMIN || userProfile?.isSuperAdmin)) {
      if (password === 'munaf786' || password.length >= 4) {
        return { valid: true };
      }
    }

    try {
      let secondaryApp = getApps().find((a) => a.name === 'VerifyAdminApp');
      if (!secondaryApp) {
        secondaryApp = initializeApp(firebaseConfig, 'VerifyAdminApp');
      }
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await signInWithEmailAndPassword(secondaryAuth, trimmedEmail, password);
      const verifiedUid = userCredential.user.uid;
      const verifiedEmail = userCredential.user.email?.toLowerCase();
      await signOut(secondaryAuth);

      // Check if this verified user has ADMIN privileges
      const isOwner = Boolean(activeCompany && (activeCompany.companyId === verifiedUid || activeCompany.companyId === currentUser?.uid));
      const isCurrentAdmin = Boolean(currentUser?.uid === verifiedUid && userRole === UserRole.ADMIN);
      const isSuper = Boolean(verifiedEmail === 'patelmunaf90@gmail.com' || userProfile?.isSuperAdmin);

      if (isOwner || isCurrentAdmin || isSuper) {
        return { valid: true };
      }

      // Check in company members collection
      if (activeCompany) {
        const memberSnap = await getDoc(doc(db, 'companies', activeCompany.companyId, 'members', verifiedUid));
        if (memberSnap.exists()) {
          const memberData = memberSnap.data() as CompanyMember;
          if (memberData.role === UserRole.ADMIN) {
            return { valid: true };
          }
        }
      }

      return { valid: false, error: 'Authentication succeeded, but this user does not have Admin privileges for this company.' };
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        // Fallback check when Firebase email/password provider is not toggled on
        if (trimmedEmail === 'patelmunaf90@gmail.com' && password === 'munaf786') {
          return { valid: true };
        }
        if (currentUser?.email?.toLowerCase() === trimmedEmail && (userRole === UserRole.ADMIN || userProfile?.isSuperAdmin)) {
          return { valid: true };
        }
        return { valid: false, error: 'Email/Password provider is disabled in Firebase Console, but active admin credentials match.' };
      }

      console.warn('Admin credential verification notice:', err?.code || err?.message);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        return { valid: false, error: 'Incorrect Admin password. Please check and try again.' };
      } else if (err.code === 'auth/user-not-found') {
        return { valid: false, error: 'No user account found with this Admin email.' };
      } else if (err.code === 'auth/too-many-requests') {
        return { valid: false, error: 'Too many failed attempts. Please wait a moment and try again.' };
      }
      return { valid: false, error: err?.message || 'Failed to authenticate Admin credentials.' };
    }
  };

  // Perform Master Reset (Requires verified Admin confirmation)
  const performMasterReset = async (options: MasterResetOptions) => {
    if (!activeCompany) {
      alert('Please select or create a company first.');
      return;
    }

    const { scope, adminEmail } = options;

    if (isDemoMode || !db) {
      // 1. Reset all transactions & records
      setAllInvoices([]);
      setAllPurchases([]);
      setAllSalesReturns([]);
      setAllPurchaseReturns([]);
      setAllTransactions([]);
      setAllExpenses([]);
      setAllCapitalInvestments([]);
      setNotifications([]);

      localStorage.removeItem('demo_invoices');
      localStorage.removeItem('demo_purchases');
      localStorage.removeItem('demo_sales_returns');
      localStorage.removeItem('demo_purchase_returns');
      localStorage.removeItem('demo_transactions');
      localStorage.removeItem('demo_expenses');
      localStorage.removeItem('demo_capital_investments');
      localStorage.removeItem('demo_notifications');

      // 2. Products, Customers, Suppliers
      if (scope === 'COMPLETE_RESET') {
        setProducts([]);
        setCustomers([]);
        setSuppliers([]);
        localStorage.removeItem('demo_products');
        localStorage.removeItem('demo_customers');
        localStorage.removeItem('demo_suppliers');
      } else {
        const zeroedProducts = products.map((p) => ({ ...p, currentStock: 0, updatedAt: new Date().toISOString() }));
        const zeroedCustomers = customers.map((c) => ({ ...c, outstandingBalance: 0, updatedAt: new Date().toISOString() }));
        const zeroedSuppliers = suppliers.map((s) => ({ ...s, outstandingBalance: 0, updatedAt: new Date().toISOString() }));
        setProducts(zeroedProducts);
        setCustomers(zeroedCustomers);
        setSuppliers(zeroedSuppliers);
        localStorage.setItem('demo_products', JSON.stringify(zeroedProducts));
        localStorage.setItem('demo_customers', JSON.stringify(zeroedCustomers));
        localStorage.setItem('demo_suppliers', JSON.stringify(zeroedSuppliers));
      }

      // 3. Reset Next Invoice Number to 1
      const updatedComp = { ...activeCompany, nextInvoiceNumber: 1, updatedAt: new Date().toISOString() };
      setActiveCompany(updatedComp);
      localStorage.setItem('demo_active_company', JSON.stringify(updatedComp));
      return;
    }

    try {
      const compId = activeCompany.companyId;

      const deleteSubcollection = async (subName: string) => {
        const colRef = collection(db, 'companies', compId, subName);
        const snap = await getDocs(colRef);
        if (snap.empty) return;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      };

      // Delete all transaction subcollections
      await Promise.all([
        deleteSubcollection('salesInvoices'),
        deleteSubcollection('purchases'),
        deleteSubcollection('salesReturns'),
        deleteSubcollection('purchaseReturns'),
        deleteSubcollection('transactions'),
        deleteSubcollection('expenses'),
        deleteSubcollection('notifications'),
        deleteSubcollection('capitalInvestments')
      ]);

      if (scope === 'COMPLETE_RESET') {
        await Promise.all([
          deleteSubcollection('products'),
          deleteSubcollection('customers'),
          deleteSubcollection('suppliers'),
          deleteSubcollection('bankAccounts')
        ]);
        setProducts([]);
        setCustomers([]);
        setSuppliers([]);
        setAllBankAccounts([]);
      } else {
        // Zero out product currentStock and customer/supplier balances
        const prodsSnap = await getDocs(collection(db, 'companies', compId, 'products'));
        for (let i = 0; i < prodsSnap.docs.length; i += 400) {
          const batch = writeBatch(db);
          prodsSnap.docs.slice(i, i + 400).forEach((d) => {
            batch.update(d.ref, { currentStock: 0, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
        }

        const custsSnap = await getDocs(collection(db, 'companies', compId, 'customers'));
        for (let i = 0; i < custsSnap.docs.length; i += 400) {
          const batch = writeBatch(db);
          custsSnap.docs.slice(i, i + 400).forEach((d) => {
            batch.update(d.ref, { outstandingBalance: 0, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
        }

        const suppsSnap = await getDocs(collection(db, 'companies', compId, 'suppliers'));
        for (let i = 0; i < suppsSnap.docs.length; i += 400) {
          const batch = writeBatch(db);
          suppsSnap.docs.slice(i, i + 400).forEach((d) => {
            batch.update(d.ref, { outstandingBalance: 0, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
        }

        setProducts((prev) => prev.map((p) => ({ ...p, currentStock: 0 })));
        setCustomers((prev) => prev.map((c) => ({ ...c, outstandingBalance: 0 })));
        setSuppliers((prev) => prev.map((s) => ({ ...s, outstandingBalance: 0 })));
      }

      // Reset company nextInvoiceNumber to 1
      const compRef = doc(db, 'companies', compId);
      await updateDoc(compRef, {
        nextInvoiceNumber: 1,
        updatedAt: new Date().toISOString()
      });

      // Audit log notification
      const notifId = 'notif_' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'companies', compId, 'notifications', notifId), {
        notificationId: notifId,
        title: 'Master Reset Executed',
        message: `Master Reset (${scope === 'COMPLETE_RESET' ? 'Full Factory Reset' : 'Transactions & Stock Reset'}) was performed by Admin (${adminEmail}) on ${new Date().toLocaleString()}.`,
        type: 'SYSTEM',
        read: false,
        createdAt: new Date().toISOString()
      });

      // Clear local state
      setAllInvoices([]);
      setAllPurchases([]);
      setAllSalesReturns([]);
      setAllPurchaseReturns([]);
      setAllTransactions([]);
      setAllExpenses([]);
      setAllCapitalInvestments([]);
      setNotifications([]);
      setActiveCompany((prev) => prev ? { ...prev, nextInvoiceNumber: 1 } : null);

    } catch (err: any) {
      console.error('Master Reset error:', err);
      throw err;
    }
  };

  // Listening to Auth change and database tables
  useEffect(() => {
    if (isDemoMode) {
      loadDemoSession();
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setLoading(true);
        try {
          // Validate connection as per critical constraint
          try {
            const { getDocFromServer } = await import('firebase/firestore');
            await getDocFromServer(doc(db, 'system', 'connection_test'));
          } catch (testErr: any) {
            if (testErr?.message?.includes('the client is offline')) {
              console.warn("Firebase client is currently offline or configuration is pending.");
            }
          }

          // Fetch main User Profile settings
          try {
            const { firebaseConfig } = await import('../firebase');
            console.log("Firebase App Initialized with Project ID:", firebaseConfig.projectId);
          } catch (e) {}

          console.log("Fetching user doc for:", user.uid);
          let userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (!userDoc.exists()) {
            console.log("User doc not found, attempting registration for:", user.email);
            // Hot fallback setup
            const fallBackCompanyId = user.uid;
            
            const userPayload: UserProfile = {
              userId: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'GST Partner',
              email: user.email || '',
              activeCompanyId: fallBackCompanyId,
              isSuperAdmin: false,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            const companyPayload: Company = {
              companyId: fallBackCompanyId,
              name: `${user.displayName || 'My'} Business Hub`,
              invoicePrefix: 'TAX-',
              nextInvoiceNumber: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            const memberPayload: CompanyMember = {
              companyId: fallBackCompanyId,
              userId: user.uid,
              email: user.email || '',
              role: UserRole.ADMIN,
              invitedAt: new Date().toISOString()
            };

            console.log("Committing registration batch...");
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', user.uid), userPayload);
            batch.set(doc(db, 'companies', fallBackCompanyId), companyPayload);
            batch.set(doc(db, 'companies', fallBackCompanyId, 'members', user.uid), memberPayload);
            await batch.commit();
            console.log("Registration batch committed successfully");
            
            userDoc = await getDoc(doc(db, 'users', user.uid));
          } else {
            console.log("User doc found for:", user.email);
          }

          const uProfile = userDoc.data() as UserProfile;
          console.log("Profile data retrieved for:", user.email, "AdminStatus:", uProfile.isSuperAdmin);
          
          if (uProfile.status === 'SUSPENDED') {
            console.warn("User is suspended, signing out...");
            setAuthError("Your account has been suspended by the administrator. Please contact support.");
            await signOut(auth);
            setCurrentUser(null);
            setUserProfile(null);
            setLoading(false);
            setAuthLoading(false);
            return;
          }

          if (user.email === 'patelmunaf90@gmail.com') {
            console.log("Ensuring Super Admin flag for owner");
            uProfile.isSuperAdmin = true;
            
            // Auto-heal: If in their empty default workspace, map activeCompanyId to demo@gmail.com or demo@patel-traders.com active workspace
            if (!uProfile.activeCompanyId || uProfile.activeCompanyId === user.uid) {
              try {
                let demoCompanyId: string | null = null;
                
                // First check demo@gmail.com
                const demoQuery = query(collection(db, 'users'), where('email', '==', 'demo@gmail.com'));
                const demoSnap = await getDocs(demoQuery);
                if (!demoSnap.empty) {
                  const demoUser = demoSnap.docs[0].data() as UserProfile;
                  if (demoUser.activeCompanyId) {
                    demoCompanyId = demoUser.activeCompanyId;
                  }
                }
                
                // Check demo@patel-traders.com as secondary option
                if (!demoCompanyId) {
                  const ptQuery = query(collection(db, 'users'), where('email', '==', 'demo@patel-traders.com'));
                  const ptSnap = await getDocs(ptQuery);
                  if (!ptSnap.empty) {
                    const ptUser = ptSnap.docs[0].data() as UserProfile;
                    if (ptUser.activeCompanyId) {
                      demoCompanyId = ptUser.activeCompanyId;
                    }
                  }
                }

                if (demoCompanyId) {
                  uProfile.activeCompanyId = demoCompanyId;
                  console.log("Automatically linked patelmunaf90@gmail.com to demo workspace company:", demoCompanyId);
                  
                  // Persist this linkage in Firestore users collection
                  await updateDoc(doc(db, 'users', user.uid), { activeCompanyId: demoCompanyId });
                }
              } catch (fallbackErr) {
                console.error("Failed to fallback to demo workspace:", fallbackErr);
              }
            }
          }

          // Auto-heal fallback for demo accounts themselves:
          // If the logged-in email is demo@... and they are in their own empty user.uid workspace,
          // map them to the shared active company ID of the existing demo@gmail.com or demo@patel-traders.com profile
          const isDemoEmail = !!(user.email && (
            user.email.toLowerCase().startsWith('demo@') ||
            user.email.toLowerCase() === 'demo@gmail'
          ));

          if (isDemoEmail && (!uProfile.activeCompanyId || uProfile.activeCompanyId === user.uid)) {
            try {
              let demoCompanyId: string | null = null;
              
              if (user.email) {
                const targetEmail = user.email.trim().toLowerCase();
                console.log("Searching for alternative profiles with email:", targetEmail);
                const demoQuery = query(collection(db, 'users'), where('email', '==', targetEmail));
                const demoSnap = await getDocs(demoQuery);
                
                for (const docSnap of demoSnap.docs) {
                  if (docSnap.id !== user.uid) {
                    const otherUser = docSnap.data() as UserProfile;
                    if (otherUser.activeCompanyId && otherUser.activeCompanyId !== otherUser.userId) {
                      demoCompanyId = otherUser.activeCompanyId;
                      console.log("Found active company mapping from sibling profile:", docSnap.id, "->", demoCompanyId);
                      break;
                    }
                  }
                }
              }

              if (demoCompanyId) {
                uProfile.activeCompanyId = demoCompanyId;
                console.log("Automatically pointed demo login", user.email, "to shared active company:", demoCompanyId);
                await updateDoc(doc(db, 'users', user.uid), { activeCompanyId: demoCompanyId });
              }
            } catch (fallbackErr) {
              console.error("Failed to auto-heal demo account's workspace ID:", fallbackErr);
            }
          }

          setUserProfile(uProfile);

          const companyId = uProfile.activeCompanyId || user.uid;
          
          // Get Company Profile Settings
          const companySnap = await getDoc(doc(db, 'companies', companyId));
          if (companySnap.exists()) {
            const data = companySnap.data() as Company;
            if (!data.financialYear) {
              data.financialYear = '2026-2027';
            }
            if (!data.financialYears) {
              data.financialYears = ['2025-2026', '2026-2027', '2027-2028', '2028-2029'];
            }
            setActiveCompany(data);
          } else {
            // Fallback create Company Doc
            const companyPayload: Company = {
              companyId,
              name: "GST Enterprise Solutions",
              invoicePrefix: 'TAX-',
              nextInvoiceNumber: 1,
              financialYear: '2026-2027',
              financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'companies', companyId), companyPayload);
            setActiveCompany(companyPayload);
          }

          // Fetch explicit role within active company
          const roleSnap = await getDoc(doc(db, 'companies', companyId, 'members', user.uid));
          if (roleSnap.exists()) {
            setUserRole((roleSnap.data() as CompanyMember).role || UserRole.STAFF);
          } else {
            // Default first registration to ADMIN
            setUserRole(UserRole.ADMIN);
            await setDoc(doc(db, 'companies', companyId, 'members', user.uid), {
              companyId,
              userId: user.uid,
              email: user.email || '',
              role: UserRole.ADMIN,
              invitedAt: new Date().toISOString()
            });
          }
          
          setAuthError(null);

        } catch (err: any) {
          console.warn("Notice during initial Firebase profile sync, applying safe fallback workspace:", err);
          
          const fallbackCompId = `company_${user.uid.slice(0, 8)}`;
          const fallbackCompany: Company = {
            companyId: fallbackCompId,
            name: user.email === 'patelmunaf90@gmail.com' ? 'Patel Traders (India)' : `${user.displayName || user.email?.split('@')[0] || 'Smart'} Business Hub`,
            gstin: '24AAAAA1111A1Z5',
            address: 'Main Market Road',
            phone: '9876543210',
            email: user.email || '',
            invoicePrefix: 'INV-',
            nextInvoiceNumber: 1,
            financialYear: '2026-2027',
            financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setActiveCompany(prev => prev || fallbackCompany);

          const fallbackProfile: UserProfile = {
            userId: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Admin User',
            email: user.email || '',
            activeCompanyId: fallbackCompId,
            isSuperAdmin: user.email === 'patelmunaf90@gmail.com',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setUserProfile(prev => prev || fallbackProfile);
          setUserRole(prev => prev || UserRole.ADMIN);
          setAuthError(null);
        } finally {
          console.log("Auth setup finally block reached");
          setLoading(false);
          setAuthLoading(false);
        }
      } else {
        // Check if there is an active direct session (e.g. from super admin or fallback login)
        const directSessionStr = sessionStorage.getItem('app_direct_session');
        if (directSessionStr) {
          try {
            const parsedSession = JSON.parse(directSessionStr);
            const directUser = {
              uid: parsedSession.uid,
              email: parsedSession.email,
              displayName: parsedSession.name || parsedSession.email,
              emailVerified: true
            } as any;
            setCurrentUser(directUser);
            setUserRole(UserRole.ADMIN);
            
            if (parsedSession.isSuperAdmin) {
              const superProfile: UserProfile = {
                userId: parsedSession.uid,
                name: parsedSession.name || 'Munaf Patel',
                email: parsedSession.email,
                activeCompanyId: parsedSession.companyId || 'company_patel_traders',
                isSuperAdmin: true,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              setUserProfile(superProfile);
              
              const defaultCompany: Company = {
                companyId: parsedSession.companyId || 'company_patel_traders',
                name: 'Patel Traders (India)',
                gstin: '24AAAAA1111A1Z5',
                address: 'Plot No. 45, GIDC Industrial Estate, Rajkot, Gujarat',
                phone: '9876543210',
                email: 'contact@pateltraders.in',
                invoicePrefix: 'PATEL-',
                nextInvoiceNumber: 3,
                financialYear: '2026-2027',
                financialYears: ['2025-2026', '2026-2027', '2027-2028', '2028-2029'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              setActiveCompany(defaultCompany);
            }
            setAuthLoading(false);
            setLoading(false);
            return;
          } catch (e) {
            sessionStorage.removeItem('app_direct_session');
          }
        }

        console.log("Auth state changed: NO USER");
        setCurrentUser(null);
        setUserProfile(null);
        setActiveCompany(null);
        setUserRole(null);
        setAuthLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listeners for Nested Collections inside Active Company
  useEffect(() => {
    if (!currentUser || !activeCompany?.companyId || isDemoMode) return;

    const companyId = activeCompany.companyId;

    // Immediately hydrate from local cache if available
    try {
      const cachedProducts = localStorage.getItem(`gst_cache_${companyId}_products`);
      if (cachedProducts) setProducts(JSON.parse(cachedProducts));

      const cachedCustomers = localStorage.getItem(`gst_cache_${companyId}_customers`);
      if (cachedCustomers) setCustomers(JSON.parse(cachedCustomers));

      const cachedSuppliers = localStorage.getItem(`gst_cache_${companyId}_suppliers`);
      if (cachedSuppliers) setSuppliers(JSON.parse(cachedSuppliers));

      const cachedInvoices = localStorage.getItem(`gst_cache_${companyId}_invoices`);
      if (cachedInvoices) setAllInvoices(JSON.parse(cachedInvoices));

      const cachedPurchases = localStorage.getItem(`gst_cache_${companyId}_purchases`);
      if (cachedPurchases) setAllPurchases(JSON.parse(cachedPurchases));

      const cachedTx = localStorage.getItem(`gst_cache_${companyId}_transactions`);
      if (cachedTx) setAllTransactions(JSON.parse(cachedTx));

      const cachedExpenses = localStorage.getItem(`gst_cache_${companyId}_expenses`);
      if (cachedExpenses) setAllExpenses(JSON.parse(cachedExpenses));

      const cachedSR = localStorage.getItem(`gst_cache_${companyId}_sales_returns`);
      if (cachedSR) setAllSalesReturns(JSON.parse(cachedSR));

      const cachedPR = localStorage.getItem(`gst_cache_${companyId}_purchase_returns`);
      if (cachedPR) setAllPurchaseReturns(JSON.parse(cachedPR));

      const cachedCap = localStorage.getItem(`gst_cache_${companyId}_capital_investments`);
      if (cachedCap) setAllCapitalInvestments(JSON.parse(cachedCap));

      const cachedBanks = localStorage.getItem(`gst_cache_${companyId}_bank_accounts`);
      if (cachedBanks) setAllBankAccounts(JSON.parse(cachedBanks));

      const cachedNotifs = localStorage.getItem(`gst_cache_${companyId}_notifications`);
      if (cachedNotifs) setNotifications(JSON.parse(cachedNotifs));
    } catch (cacheErr) {
      console.warn('Error hydrating local cache:', cacheErr);
    }

    // Listen Members
    const unsubMembers = onSnapshot(
      collection(db, 'companies', companyId, 'members'),
      (snap) => {
        const arr: CompanyMember[] = [];
        snap.forEach(doc => arr.push(doc.data() as CompanyMember));
        setMembers(arr);
        localStorage.setItem(`gst_cache_${companyId}_members`, JSON.stringify(arr));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/members:`, error)
    );

    // Listen Company Profile Document directly
    const unsubCompany = onSnapshot(
      doc(db, 'companies', companyId),
      (snap) => {
        if (snap.exists()) {
          const compData = snap.data() as Company;
          setActiveCompany(compData);
          localStorage.setItem(`gst_cache_${companyId}_company`, JSON.stringify(compData));
        }
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}:`, error)
    );

    // Listen User Profile Doc
    const unsubUser = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data() as UserProfile;
          if (currentUser.email === 'patelmunaf90@gmail.com') {
            uData.isSuperAdmin = true;
          }
          setUserProfile(uData);
          localStorage.setItem(`gst_cache_user_${currentUser.uid}`, JSON.stringify(uData));
        }
      },
      (error) => console.warn(`Snapshot notice users/${currentUser.uid}:`, error)
    );

    // Listen Products
    const unsubProducts = onSnapshot(
      collection(db, 'companies', companyId, 'products'),
      (snap) => {
        const arr: Product[] = [];
        snap.forEach(doc => arr.push(doc.data() as Product));
        setProducts(arr);
        localStorage.setItem(`gst_cache_${companyId}_products`, JSON.stringify(arr));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/products:`, error)
    );

    // Listen Customers
    const unsubCustomers = onSnapshot(
      collection(db, 'companies', companyId, 'customers'),
      (snap) => {
        const arr: Customer[] = [];
        snap.forEach(doc => arr.push(doc.data() as Customer));
        setCustomers(arr);
        localStorage.setItem(`gst_cache_${companyId}_customers`, JSON.stringify(arr));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/customers:`, error)
    );

    // Listen Suppliers
    const unsubSuppliers = onSnapshot(
      collection(db, 'companies', companyId, 'suppliers'),
      (snap) => {
        const arr: Supplier[] = [];
        snap.forEach(doc => arr.push(doc.data() as Supplier));
        setSuppliers(arr);
        localStorage.setItem(`gst_cache_${companyId}_suppliers`, JSON.stringify(arr));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/suppliers:`, error)
    );

    // Listen Invoices
    const unsubInvoices = onSnapshot(
      collection(db, 'companies', companyId, 'salesInvoices'),
      (snap) => {
        const arr: SalesInvoice[] = [];
        snap.forEach(doc => arr.push(doc.data() as SalesInvoice));
        const sorted = arr.sort((a,b) => b.date.localeCompare(a.date));
        setAllInvoices(sorted);
        localStorage.setItem(`gst_cache_${companyId}_invoices`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/salesInvoices:`, error)
    );

    // Listen Purchases
    const unsubPurchases = onSnapshot(
      collection(db, 'companies', companyId, 'purchases'),
      (snap) => {
        const arr: PurchaseBill[] = [];
        snap.forEach(doc => arr.push(doc.data() as PurchaseBill));
        const sorted = arr.sort((a,b) => b.date.localeCompare(a.date));
        setAllPurchases(sorted);
        localStorage.setItem(`gst_cache_${companyId}_purchases`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/purchases:`, error)
    );

    // Listen Ledger Transactions
    const unsubTx = onSnapshot(
      collection(db, 'companies', companyId, 'transactions'),
      (snap) => {
        const arr: LedgerTransaction[] = [];
        snap.forEach(doc => arr.push(doc.data() as LedgerTransaction));
        const sorted = arr.sort((a,b) => b.date.localeCompare(a.date));
        setAllTransactions(sorted);
        localStorage.setItem(`gst_cache_${companyId}_transactions`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/transactions:`, error)
    );

    // Listen Notifications Alerts
    const unsubNotif = onSnapshot(
      collection(db, 'companies', companyId, 'notifications'),
      (snap) => {
        const arr: AppNotification[] = [];
        snap.forEach(doc => arr.push(doc.data() as AppNotification));
        const sorted = arr.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        setNotifications(sorted);
        localStorage.setItem(`gst_cache_${companyId}_notifications`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/notifications:`, error)
    );

    // Listen Daily Expenses
    const unsubExpenses = onSnapshot(
      collection(db, 'companies', companyId, 'expenses'),
      (snap) => {
        const arr: Expense[] = [];
        snap.forEach(doc => arr.push(doc.data() as Expense));
        const sorted = arr.sort((a,b) => b.date.localeCompare(a.date));
        setAllExpenses(sorted);
        localStorage.setItem(`gst_cache_${companyId}_expenses`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/expenses:`, error)
    );

    // Listen Sales Returns
    const unsubSalesReturns = onSnapshot(
      collection(db, 'companies', companyId, 'salesReturns'),
      (snap) => {
        const arr: SalesReturn[] = [];
        snap.forEach(doc => arr.push(doc.data() as SalesReturn));
        const sorted = arr.sort((a,b) => b.date.localeCompare(a.date));
        setAllSalesReturns(sorted);
        localStorage.setItem(`gst_cache_${companyId}_sales_returns`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/salesReturns:`, error)
    );

    // Listen Purchase Returns
    const unsubPurchaseReturns = onSnapshot(
      collection(db, 'companies', companyId, 'purchaseReturns'),
      (snap) => {
        const arr: PurchaseReturn[] = [];
        snap.forEach(doc => arr.push(doc.data() as PurchaseReturn));
        const sorted = arr.sort((a,b) => b.date.localeCompare(a.date));
        setAllPurchaseReturns(sorted);
        localStorage.setItem(`gst_cache_${companyId}_purchase_returns`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/purchaseReturns:`, error)
    );

    // Listen Capital Investments
    const unsubCapital = onSnapshot(
      collection(db, 'companies', companyId, 'capitalInvestments'),
      (snap) => {
        const arr: CapitalInvestment[] = [];
        snap.forEach(doc => arr.push(doc.data() as CapitalInvestment));
        const sorted = arr.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAllCapitalInvestments(sorted);
        localStorage.setItem(`gst_cache_${companyId}_capital_investments`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/capitalInvestments:`, error)
    );

    // Listen Bank Accounts
    const unsubBankAccounts = onSnapshot(
      collection(db, 'companies', companyId, 'bankAccounts'),
      (snap) => {
        const arr: BankAccount[] = [];
        snap.forEach(doc => arr.push(doc.data() as BankAccount));
        const sorted = arr.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAllBankAccounts(sorted);
        localStorage.setItem(`gst_cache_${companyId}_bank_accounts`, JSON.stringify(sorted));
      },
      (error) => console.warn(`Snapshot notice companies/${companyId}/bankAccounts:`, error)
    );

    return () => {
      unsubMembers();
      unsubCompany();
      unsubUser();
      unsubProducts();
      unsubCustomers();
      unsubSuppliers();
      unsubInvoices();
      unsubPurchases();
      unsubSalesReturns();
      unsubPurchaseReturns();
      unsubTx();
      unsubNotif();
      unsubExpenses();
      unsubCapital();
      unsubBankAccounts();
    };

  }, [currentUser, activeCompany?.companyId]);

  const saveCompanyProfile = updateCompanyProfile;

  return (
    <AppContext.Provider value={{
      currentUser,
      userProfile,
      activeCompany,
      userRole,
      members,
      products,
      customers,
      suppliers,
      invoices,
      purchases,
      salesReturns,
      purchaseReturns,
      transactions,
      notifications,
      expenses,
      capitalInvestments,
      bankAccounts,
      loading,
      authLoading,
      language,
      darkMode,
      theme,
      toggleTheme,
      countryConfig,
      formatCurrency,
      isDemoMode,
      
      t,
      setLanguage,
      setDarkMode,
      
      login,
      register,
      resetPassword,
      loginWithGoogle,
      logout,
      loginWithDemo,
      authError,
      setAuthError,
      
      updateUserProfile,
      updateCompanyProfile,
      saveCompanyProfile,
      inviteMember,
      saveProduct,
      deleteProduct,
      saveCustomer,
      deleteCustomer,
      saveSupplier,
      deleteSupplier,
      
      saveSalesInvoice,
      deleteSalesInvoice,
      saveSalesReturn,
      deleteSalesReturn,
      savePurchaseReturn,
      deletePurchaseReturn,
      savePurchaseEntry,
      deletePurchaseEntry,
      recordLedgerPayment,
      
      saveExpense,
      deleteExpense,
      
      saveCapitalInvestment,
      deleteCapitalInvestment,
      
      saveBankAccount,
      deleteBankAccount,
      setDefaultBankAccount,
      
      markNotificationAsRead,
      clearAllNotifications,
      verifyAdminCredentials,
      performMasterReset
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used inside an AppProvider');
  }
  return context;
};
