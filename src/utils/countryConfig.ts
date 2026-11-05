/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CountryCode = 'IN' | 'US' | 'UK' | 'CA' | 'AE' | 'SA' | 'AU' | 'SG' | 'DE' | 'OTHER';

export type TaxSystem = 'dual_gst' | 'single_vat' | 'us_sales_tax' | 'canadian_gst_pst';

export interface TaxTypeOption {
  value: 'GST_REGULAR' | 'GST_COMPOSITION' | 'CONSUMER' | 'UNREGISTERED';
  label: string;
  description: string;
}

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  currencySymbol: string;
  currencyCode: 'INR' | 'USD' | 'GBP' | 'CAD' | 'AED' | 'SAR' | 'AUD' | 'SGD' | 'EUR';
  taxSystem: TaxSystem;
  taxName: string;
  taxLabel: string;
  taxLabelPlaceholder: string;
  taxFormatLabel: string;
  taxComponents: string[];
  stateTaxShorthand: string;
  centralTaxShorthand: string;
  statesOrProvinces: string[];
  taxRates: number[];
  defaultTaxRate: number;
  hsnLabel: string;
  legalDeclaration: string;
  eWayBillApplicable: boolean;
  unitOfMeasures: string[];
  taxTypeOptions: TaxTypeOption[];
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  IN: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    currencySymbol: '₹',
    currencyCode: 'INR',
    taxSystem: 'dual_gst',
    taxName: 'Tax / GST',
    taxLabel: 'Tax ID / GSTIN',
    taxLabelPlaceholder: '24AAAAP1234A1Z1',
    taxFormatLabel: 'Enter Tax Registration Number / GSTIN',
    taxComponents: ['CGST', 'SGST', 'IGST'],
    stateTaxShorthand: 'SGST',
    centralTaxShorthand: 'CGST',
    statesOrProvinces: [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 
      'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
      'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi'
    ],
    taxRates: [0, 5, 12, 18, 28],
    defaultTaxRate: 18,
    hsnLabel: 'HSN / SAC Code',
    legalDeclaration: 'Invoice generated in compliance with standard commercial tax laws.',
    eWayBillApplicable: true,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'Registered Business (Regular)', description: 'Standard registered taxpayer' },
      { value: 'GST_COMPOSITION', label: 'Composition Scheme', description: 'Turnover under limit' },
      { value: 'CONSUMER', label: 'Consumer / End User (B2C)', description: 'Retail customer' },
      { value: 'UNREGISTERED', label: 'Unregistered Business (URP)', description: 'Commercial entity without registration' }
    ]
  },
  US: {
    code: 'US',
    name: 'United States (USA)',
    flag: '🇺🇸',
    currencySymbol: '$',
    currencyCode: 'USD',
    taxSystem: 'us_sales_tax',
    taxName: 'Sales Tax',
    taxLabel: 'Tax ID (EIN)',
    taxLabelPlaceholder: '12-3456789',
    taxFormatLabel: 'Enter EIN or State Tax ID',
    taxComponents: ['State Tax', 'Local Tax'],
    stateTaxShorthand: 'State Tax',
    centralTaxShorthand: '',
    statesOrProvinces: ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Washington', 'Other State'],
    taxRates: [0, 5, 7, 8.25, 10],
    defaultTaxRate: 7,
    hsnLabel: 'Commodity Code',
    legalDeclaration: 'Sales tax charged in accordance with state laws.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'LBS', 'GAL', 'BOX', 'FT', 'DOZ', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'Tax-Registered Business', description: 'Wholesale buyer' },
      { value: 'GST_COMPOSITION', label: 'Tax-Exempt Organization', description: 'Certified exempt entity' },
      { value: 'CONSUMER', label: 'Retail Customer', description: 'End consumer' },
      { value: 'UNREGISTERED', label: 'Unregistered Client', description: 'Standard client' }
    ]
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom (UK)',
    flag: '🇬🇧',
    currencySymbol: '£',
    currencyCode: 'GBP',
    taxSystem: 'single_vat',
    taxName: 'VAT',
    taxLabel: 'VAT Reg No (VRN)',
    taxLabelPlaceholder: 'GB123456789',
    taxFormatLabel: 'Enter UK VAT Registration Number',
    taxComponents: ['VAT'],
    stateTaxShorthand: 'VAT',
    centralTaxShorthand: '',
    statesOrProvinces: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    taxRates: [0, 5, 20],
    defaultTaxRate: 20,
    hsnLabel: 'Tariff Code',
    legalDeclaration: 'Invoice issued in accordance with UK VAT Act.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'VAT Registered', description: 'HMRC registered' },
      { value: 'GST_COMPOSITION', label: 'Flat Rate Scheme', description: 'FRS scheme' },
      { value: 'CONSUMER', label: 'End Consumer', description: 'Private consumer' },
      { value: 'UNREGISTERED', label: 'Exempt Trader', description: 'Below threshold' }
    ]
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    currencySymbol: '$',
    currencyCode: 'CAD',
    taxSystem: 'canadian_gst_pst',
    taxName: 'GST/HST/PST',
    taxLabel: 'Business Number (BN)',
    taxLabelPlaceholder: '123456789 RT0001',
    taxFormatLabel: 'Enter Business Number',
    taxComponents: ['GST', 'PST'],
    stateTaxShorthand: 'PST',
    centralTaxShorthand: 'GST',
    statesOrProvinces: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba'],
    taxRates: [0, 5, 12, 13, 15],
    defaultTaxRate: 13,
    hsnLabel: 'HS Code',
    legalDeclaration: 'GST/HST charged in accordance with Excise Tax Act.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'GST/HST Registered', description: 'CRA registered' },
      { value: 'GST_COMPOSITION', label: 'Small Supplier', description: 'Below threshold' },
      { value: 'CONSUMER', label: 'Retail Consumer', description: 'Individual customer' },
      { value: 'UNREGISTERED', label: 'Exempt Purchaser', description: 'Tax-exempt' }
    ]
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    currencySymbol: 'AED ',
    currencyCode: 'AED',
    taxSystem: 'single_vat',
    taxName: 'VAT',
    taxLabel: 'TRN (Tax Reg No)',
    taxLabelPlaceholder: '100123456700003',
    taxFormatLabel: 'Enter UAE TRN',
    taxComponents: ['VAT'],
    stateTaxShorthand: 'VAT',
    centralTaxShorthand: '',
    statesOrProvinces: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'],
    taxRates: [0, 5],
    defaultTaxRate: 5,
    hsnLabel: 'HS / Customs Code',
    legalDeclaration: 'Tax invoice issued in compliance with UAE FTA regulations.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'TRN Registered', description: 'FTA registered' },
      { value: 'GST_COMPOSITION', label: 'Free Zone / Reverse Charge', description: 'Special zone' },
      { value: 'CONSUMER', label: 'Retail Customer', description: 'Retail buyer' },
      { value: 'UNREGISTERED', label: 'Unregistered Entity', description: 'Small enterprise' }
    ]
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    currencySymbol: 'SAR ',
    currencyCode: 'SAR',
    taxSystem: 'single_vat',
    taxName: 'VAT',
    taxLabel: 'VAT ID / TRN',
    taxLabelPlaceholder: '300123456700003',
    taxFormatLabel: 'Enter ZATCA VAT Number',
    taxComponents: ['VAT'],
    stateTaxShorthand: 'VAT',
    centralTaxShorthand: '',
    statesOrProvinces: ['Riyadh', 'Makkah', 'Eastern Province', 'Madinah'],
    taxRates: [0, 15],
    defaultTaxRate: 15,
    hsnLabel: 'ZATCA Code',
    legalDeclaration: 'Tax invoice in compliance with ZATCA regulations.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'ZATCA Registered', description: 'ZATCA registered' },
      { value: 'GST_COMPOSITION', label: 'Zero-Rated / Export', description: 'Export supply' },
      { value: 'CONSUMER', label: 'Consumer', description: 'Individual buyer' },
      { value: 'UNREGISTERED', label: 'Unregistered Entity', description: 'Under threshold' }
    ]
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    currencySymbol: 'A$',
    currencyCode: 'AUD',
    taxSystem: 'single_vat',
    taxName: 'GST',
    taxLabel: 'ABN',
    taxLabelPlaceholder: '51 824 753 556',
    taxFormatLabel: 'Enter Australian Business Number',
    taxComponents: ['GST'],
    stateTaxShorthand: 'GST',
    centralTaxShorthand: '',
    statesOrProvinces: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia'],
    taxRates: [0, 10],
    defaultTaxRate: 10,
    hsnLabel: 'HS Code',
    legalDeclaration: 'Tax invoice issued in accordance with ACNC / ATO guidelines.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'ABN Registered', description: 'ATO registered' },
      { value: 'GST_COMPOSITION', label: 'GST-Free Supply', description: 'Exempt supply' },
      { value: 'CONSUMER', label: 'Retail Consumer', description: 'Retail buyer' },
      { value: 'UNREGISTERED', label: 'Unregistered', description: 'Unregistered' }
    ]
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    currencySymbol: 'S$',
    currencyCode: 'SGD',
    taxSystem: 'single_vat',
    taxName: 'GST',
    taxLabel: 'GST / UEN No',
    taxLabelPlaceholder: '202012345G',
    taxFormatLabel: 'Enter Singapore UEN / GST Number',
    taxComponents: ['GST'],
    stateTaxShorthand: 'GST',
    centralTaxShorthand: '',
    statesOrProvinces: ['Singapore'],
    taxRates: [0, 9],
    defaultTaxRate: 9,
    hsnLabel: 'HS / Product Code',
    legalDeclaration: 'Tax invoice complying with IRAS guidelines.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'IRAS GST Registered', description: 'IRAS registered' },
      { value: 'GST_COMPOSITION', label: 'GST Zero-Rated', description: 'Zero rated' },
      { value: 'CONSUMER', label: 'Consumer', description: 'Consumer' },
      { value: 'UNREGISTERED', label: 'Unregistered', description: 'Unregistered' }
    ]
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    currencySymbol: '€',
    currencyCode: 'EUR',
    taxSystem: 'single_vat',
    taxName: 'MwSt / VAT',
    taxLabel: 'USt-IdNr',
    taxLabelPlaceholder: 'DE123456789',
    taxFormatLabel: 'Enter German USt-IdNr',
    taxComponents: ['MwSt'],
    stateTaxShorthand: 'MwSt',
    centralTaxShorthand: '',
    statesOrProvinces: ['Bavaria', 'Berlin', 'Hamburg', 'Hesse', 'North Rhine-Westphalia'],
    taxRates: [0, 7, 19],
    defaultTaxRate: 19,
    hsnLabel: 'Zolltarifnummer',
    legalDeclaration: 'Rechnung gemäß UStG.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'USt-pflichtig', description: 'Regular VAT' },
      { value: 'GST_COMPOSITION', label: 'Kleinunternehmer', description: 'Exempt' },
      { value: 'CONSUMER', label: 'Endverbraucher', description: 'Consumer' },
      { value: 'UNREGISTERED', label: 'Reverse Charge', description: 'B2B EU' }
    ]
  },
  OTHER: {
    code: 'OTHER',
    name: 'Other Country (Custom)',
    flag: '🌐',
    currencySymbol: '$',
    currencyCode: 'USD',
    taxSystem: 'single_vat',
    taxName: 'Tax / VAT',
    taxLabel: 'Tax ID / Registration No',
    taxLabelPlaceholder: 'TAX-123456',
    taxFormatLabel: 'Enter tax registration number',
    taxComponents: ['Tax'],
    stateTaxShorthand: 'Tax',
    centralTaxShorthand: '',
    statesOrProvinces: ['State 1', 'State 2', 'Province 1', 'Province 2'],
    taxRates: [0, 5, 10, 15, 20],
    defaultTaxRate: 10,
    hsnLabel: 'Item Code',
    legalDeclaration: 'Invoice generated in accordance with commercial tax regulations.',
    eWayBillApplicable: false,
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET'],
    taxTypeOptions: [
      { value: 'GST_REGULAR', label: 'Registered Business', description: 'Registered taxpayer' },
      { value: 'GST_COMPOSITION', label: 'Exempt Scheme', description: 'Exempt entity' },
      { value: 'CONSUMER', label: 'Consumer', description: 'Retail customer' },
      { value: 'UNREGISTERED', label: 'Unregistered', description: 'Unregistered entity' }
    ]
  }
};

export function getCountryConfig(
  countryCode?: string,
  customRatesMap?: Partial<Record<string, number[]>>,
  enableManual?: boolean,
  customDefaultRates?: Partial<Record<string, number>>
): CountryConfig {
  const code = (countryCode || 'IN').toUpperCase() as CountryCode;
  const base = (code in COUNTRIES) ? COUNTRIES[code] : COUNTRIES.IN;

  if (enableManual) {
    const customRates = (customRatesMap && customRatesMap[code] && Array.isArray(customRatesMap[code]) && customRatesMap[code]!.length > 0)
      ? [...customRatesMap[code]!].sort((a, b) => a - b)
      : [...base.taxRates];

    const defaultRate = (customDefaultRates && customDefaultRates[code] !== undefined)
      ? Number(customDefaultRates[code])
      : (customRates.includes(base.defaultTaxRate) ? base.defaultTaxRate : customRates[0]);

    return {
      ...base,
      taxRates: customRates,
      defaultTaxRate: defaultRate
    };
  }

  return base;
}

export function formatCurrencyValue(value: number, countryCode?: string): string {
  const config = getCountryConfig(countryCode);
  const localeMap: Record<string, string> = {
    IN: 'en-IN',
    US: 'en-US',
    UK: 'en-GB',
    CA: 'en-CA',
    AE: 'en-AE',
    SA: 'en-SA',
    AU: 'en-AU',
    SG: 'en-SG',
    DE: 'de-DE',
    OTHER: 'en-US'
  };
  const locale = localeMap[config.code] || 'en-IN';
  return config.currencySymbol + Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Computes individual item tax coordinates respecting the active country tax system.
 */
export function calculateLineItemTax(
  price: number,
  qty: number,
  discount: number,
  taxRate: number,
  countryCode?: string,
  isInterstate?: boolean
): {
  cleanLineSub: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  total: number;
} {
  const config = getCountryConfig(countryCode);
  const rawSub = (Number(price || 0) * Number(qty || 0)) - Number(discount || 0);
  const cleanLineSub = Math.max(0, rawSub);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let taxAmount = 0;

  if (config.taxSystem === 'dual_gst') {
    if (isInterstate) {
      igst = parseFloat(((cleanLineSub * taxRate) / 100).toFixed(2));
      taxAmount = igst;
    } else {
      const halfRate = taxRate / 2;
      cgst = parseFloat(((cleanLineSub * halfRate) / 100).toFixed(2));
      sgst = parseFloat(((cleanLineSub * halfRate) / 100).toFixed(2));
      taxAmount = parseFloat((cgst + sgst).toFixed(2));
    }
  } else if (config.taxSystem === 'canadian_gst_pst') {
    if (taxRate === 13 || taxRate === 15) {
      // HST Province
      igst = parseFloat(((cleanLineSub * taxRate) / 100).toFixed(2));
      taxAmount = igst;
    } else {
      // GST 5% + PST
      cgst = parseFloat(((cleanLineSub * 5) / 100).toFixed(2));
      const pstRate = Math.max(0, taxRate - 5);
      sgst = parseFloat(((cleanLineSub * pstRate) / 100).toFixed(2));
      taxAmount = parseFloat((cgst + sgst).toFixed(2));
    }
  } else {
    // Single VAT or Sales Tax:
    taxAmount = parseFloat(((cleanLineSub * taxRate) / 100).toFixed(2));
    igst = taxAmount; // Map into igst for uniform record keeping
  }

  const total = parseFloat((cleanLineSub + taxAmount).toFixed(2));
  return { cleanLineSub, cgst, sgst, igst, taxAmount, total };
}
