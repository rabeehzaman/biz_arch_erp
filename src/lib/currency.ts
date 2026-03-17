// Centralized currency configuration — single source of truth

export const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; code: string }> = {
  INR: { symbol: "\u20B9", locale: "en-IN", code: "INR" },
  SAR: { symbol: "SAR ", locale: "en-US", code: "SAR" },
};

export function formatCurrency(amount: number, currencyCode: string = "INR"): string {
  const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.INR;
  return `${config.symbol}${amount.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_CONFIG[currencyCode]?.symbol || CURRENCY_CONFIG.INR.symbol;
}

export function getLocaleForCurrency(currencyCode: string): string {
  return CURRENCY_CONFIG[currencyCode]?.locale || CURRENCY_CONFIG.INR.locale;
}
