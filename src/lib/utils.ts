import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string }> = {
  INR: { symbol: "₹", locale: "en-IN" },
  SAR: { symbol: "SAR ", locale: "en-US" },
};

export function formatCurrency(amount: number, currency: string = "INR"): string {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  return `${config.symbol}${amount.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
