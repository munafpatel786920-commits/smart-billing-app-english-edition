/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CountryCode = 'IN' | 'US' | 'UK' | 'CA';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  currencySymbol: string;
  currencyCode: 'INR' | 'USD' | 'GBP' | 'CAD';
  taxName: string;                     // e.g. "GST", "Sales Tax", "VAT", "GST/HST"
  taxLabel: string;                    // e.g. "GSTIN", "Tax ID (EIN)", "VAT Reg No", "Business Number (BN)"
  taxLabelPlaceholder: string;         // e.g. "24AAAAP1234A1Z1", "12-3456789", "GB123456789", "123456789 RT 0001"
  taxFormatLabel: string;
  taxComponents: string[];             // ["CGST", "SGST", "IGST"] or ["State Tax", "Local Tax"] or ["VAT"] or ["GST", "HST/PST"]
  statesOrProvinces: string[];
  taxRates: number[];                  // [0, 5, 12, 18, 28] or [0, 5, 20] or [0, 5, 12, 13, 15] or [0, 4, 5, 6, 7, 8, 9, 10]
  unitOfMeasures: string[];
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  IN: {
    code: 'IN',
    name: 'India',
    currencySymbol: '₹',
    currencyCode: 'INR',
    taxName: 'GST',
    taxLabel: 'India GSTIN',
    taxLabelPlaceholder: '24AAAAP1234A1Z1',
    taxFormatLabel: 'Enter 15-character GSTIN Number',
    taxComponents: ['CGST', 'SGST', 'IGST'],
    statesOrProvinces: [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 
      'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
      'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 
      'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 
      'Lakshadweep', 'Puducherry'
    ],
    taxRates: [0, 5, 12, 18, 28],
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET']
  },
  US: {
    code: 'US',
    name: 'United States (USA)',
    currencySymbol: '$',
    currencyCode: 'USD',
    taxName: 'Sales Tax',
    taxLabel: 'Tax ID (EIN)',
    taxLabelPlaceholder: '12-3456789',
    taxFormatLabel: 'Enter 9-digit EIN (XX-XXXXXXX) or Tax ID',
    taxComponents: ['State Tax', 'Local Tax'],
    statesOrProvinces: [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 
      'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 
      'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 
      'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 
      'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
    ],
    taxRates: [0, 4, 5, 6, 7, 8, 8.25, 9, 10],
    unitOfMeasures: ['PCS', 'LBS', 'GAL', 'BOX', 'FT', 'DOZ', 'SET']
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom (UK)',
    currencySymbol: '£',
    currencyCode: 'GBP',
    taxName: 'VAT',
    taxLabel: 'VAT Reg No (VRN)',
    taxLabelPlaceholder: 'GB123456789',
    taxFormatLabel: 'Enter 9-digit VAT Registration Number (e.g. GB123456789)',
    taxComponents: ['VAT'],
    statesOrProvinces: [
      'England', 'Scotland', 'Wales', 'Northern Ireland', 'London', 'General UK'
    ],
    taxRates: [0, 5, 20],
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET', 'PACK']
  },
  CA: {
    code: 'CA',
    name: 'Canada (CAN)',
    currencySymbol: '$',
    currencyCode: 'CAD',
    taxName: 'GST/HST/PST',
    taxLabel: 'Business Number (BN)',
    taxLabelPlaceholder: '123456789 RT 0001',
    taxFormatLabel: 'Enter 9-digit Business Number + Account identifier (e.g. RT0001)',
    taxComponents: ['GST', 'PST/HST'],
    statesOrProvinces: [
      'Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 
      'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island', 
      'Northwest Territories', 'Yukon', 'Nunavut'
    ],
    taxRates: [0, 5, 12, 13, 15],
    unitOfMeasures: ['PCS', 'KG', 'LITER', 'BOX', 'MTR', 'SET', 'PACK']
  }
};

export function getCountryConfig(countryCode?: string): CountryConfig {
  const code = (countryCode || 'IN').toUpperCase();
  if (code === 'IN' || code === 'US' || code === 'UK' || code === 'CA') {
    return COUNTRIES[code as CountryCode];
  }
  return COUNTRIES.IN;
}

export function formatCurrencyValue(value: number, countryCode?: string): string {
  const config = getCountryConfig(countryCode);
  const localeMap: Record<CountryCode, string> = {
    IN: 'en-IN',
    US: 'en-US',
    UK: 'en-GB',
    CA: 'en-CA'
  };
  const locale = localeMap[config.code] || 'en-IN';
  return config.currencySymbol + value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
