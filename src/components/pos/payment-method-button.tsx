"use client";

import { cn } from "@/lib/utils";
import { Banknote, CreditCard, Smartphone, Building2 } from "lucide-react";

const methodIcons: Record<string, React.ElementType> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  UPI: Smartphone,
  BANK_TRANSFER: Building2,
};

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  CREDIT_CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank",
};

interface PaymentMethodButtonProps {
  method: string;
  isSelected: boolean;
  onClick: () => void;
}

export function PaymentMethodButton({
  method,
  isSelected,
  onClick,
}: PaymentMethodButtonProps) {
  const Icon = methodIcons[method] || Banknote;
  const label = methodLabels[method] || method;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all min-h-[80px]",
        isSelected
          ? "border-primary bg-primary/5 text-primary"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <Icon className="h-6 w-6 mb-1" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
