/**
 * Converts a numeric value to words (Indian numbering system).
 */

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const doubleDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const formatTable = [
    { label: 'Crore', value: 10000000 },
    { label: 'Lakh', value: 100000 },
    { label: 'Thousand', value: 1000 },
    { label: 'Hundred', value: 100 },
  ];

  let str = '';

  // Handle integers
  let n = Math.floor(num);
  
  if (n === 0 && num > 0) {
    // Only decimals
  } else {
    for (const { label, value } of formatTable) {
      if (n >= value) {
        const quotient = Math.floor(n / value);
        str += convertSection(quotient) + ' ' + label + ' ';
        n %= value;
      }
    }
    if (n > 0) {
      str += convertSection(n) + ' ';
    }
    str += 'Rupees ';
  }

  // Handle decimals (paise)
  const paise = Math.round((num % 1) * 100);
  if (paise > 0) {
    if (str !== '') str += 'and ';
    str += convertSection(paise) + ' Paise ';
  }

  return str.trim() + ' Only';

  function convertSection(n: number): string {
    let res = '';
    if (n < 10) {
      res = singleDigits[n];
    } else if (n < 20) {
      res = doubleDigits[n - 10];
    } else {
      res = tensDigits[Math.floor(n / 10)];
      if (n % 10 > 0) {
        res += ' ' + singleDigits[n % 10];
      }
    }
    return res;
  }
}
