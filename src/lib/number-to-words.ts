/**
 * Converts a number to Indian English words
 * Supports numbers up to crores (10,000,000)
 */

const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
];

const teens = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertLessThanThousand(num: number): string {
  if (num === 0) return "";

  if (num < 10) {
    return ones[num];
  } else if (num < 20) {
    return teens[num - 10];
  } else if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? " " + ones[one] : "");
  } else {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return (
      ones[hundred] +
      " Hundred" +
      (remainder > 0 ? " And " + convertLessThanThousand(remainder) : "")
    );
  }
}

/**
 * Converts a number to Indian English words format
 * @param num - The number to convert
 * @returns String representation in words (e.g., "Rupees Twelve Thousand Three Hundred Forty Five Only")
 */
export function numberToWords(num: number): string {
  if (num === 0) return "Zero Only";

  // Handle negative numbers
  if (num < 0) return "Minus " + numberToWords(Math.abs(num));

  // Split into rupees and paise
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = "";

  // Handle crores (10,000,000)
  if (rupees >= 10000000) {
    const crores = Math.floor(rupees / 10000000);
    result += convertLessThanThousand(crores) + " Crore ";
  }

  // Handle lakhs (100,000)
  const remainingAfterCrores = rupees % 10000000;
  if (remainingAfterCrores >= 100000) {
    const lakhs = Math.floor(remainingAfterCrores / 100000);
    result += convertLessThanThousand(lakhs) + " Lakh ";
  }

  // Handle thousands (1,000)
  const remainingAfterLakhs = remainingAfterCrores % 100000;
  if (remainingAfterLakhs >= 1000) {
    const thousands = Math.floor(remainingAfterLakhs / 1000);
    result += convertLessThanThousand(thousands) + " Thousand ";
  }

  // Handle remaining hundreds, tens, and ones
  const remainingAfterThousands = remainingAfterLakhs % 1000;
  if (remainingAfterThousands > 0) {
    result += convertLessThanThousand(remainingAfterThousands);
  }

  // Trim and format
  result = result.trim();

  // Add paise if present
  if (paise > 0) {
    result += " And Paise " + convertLessThanThousand(paise);
  }

  return "Rupees " + result + " Only";
}
