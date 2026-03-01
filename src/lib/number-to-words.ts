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

// ---------- Arabic Number to Words (Saudi Riyal) ----------

const onesAr = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
];

const teensAr = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const tensAr = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const hundredsAr = [
  "",
  "مائة",
  "مئتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertLessThanThousandAr(num: number): string {
  if (num === 0) return "";

  if (num < 10) {
    return onesAr[num];
  } else if (num < 20) {
    return teensAr[num - 10];
  } else if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    if (one === 0) return tensAr[ten];
    return onesAr[one] + " و" + tensAr[ten];
  } else {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) return hundredsAr[hundred];
    return hundredsAr[hundred] + " و" + convertLessThanThousandAr(remainder);
  }
}

/**
 * Converts a number to Arabic words with Saudi Riyal currency.
 * E.g. 150.50 → "مائة وخمسون ريالاً سعودياً وخمسون هللة"
 */
export function numberToWordsArabic(num: number): string {
  if (num === 0) return "صفر ريال سعودي";

  if (num < 0) return "سالب " + numberToWordsArabic(Math.abs(num));

  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let result = "";

  // Millions
  if (riyals >= 1000000) {
    const millions = Math.floor(riyals / 1000000);
    if (millions === 1) {
      result += "مليون ";
    } else if (millions === 2) {
      result += "مليونان ";
    } else {
      result += convertLessThanThousandAr(millions) + " ملايين ";
    }
  }

  // Thousands
  const remainingAfterMillions = riyals % 1000000;
  if (remainingAfterMillions >= 1000) {
    const thousands = Math.floor(remainingAfterMillions / 1000);
    if (thousands === 1) {
      result += "ألف ";
    } else if (thousands === 2) {
      result += "ألفان ";
    } else {
      result += convertLessThanThousandAr(thousands) + " آلاف ";
    }
  }

  // Hundreds, tens, ones
  const remaining = remainingAfterMillions % 1000;
  if (remaining > 0) {
    if (result) result += "و";
    result += convertLessThanThousandAr(remaining);
  }

  result = result.trim();

  // Add currency
  if (riyals === 1) {
    result = "ريال سعودي واحد";
  } else if (riyals === 2) {
    result = "ريالان سعوديان";
  } else {
    result += " ريالاً سعودياً";
  }

  // Add halalas
  if (halalas > 0) {
    if (halalas === 1) {
      result += " وهللة واحدة";
    } else if (halalas === 2) {
      result += " وهللتان";
    } else {
      result += " و" + convertLessThanThousandAr(halalas) + " هللة";
    }
  }

  return result;
}

/**
 * Language-aware amount-in-words converter.
 * @param amount - Number to convert
 * @param lang - "en" or "ar"
 */
export function numberToWordsLocalized(amount: number, lang: string = "en"): string {
  if (lang === "ar") return numberToWordsArabic(amount);
  return numberToWords(amount);
}
