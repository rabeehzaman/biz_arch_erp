"use client";

import { cn } from "@/lib/utils";
import { Banknote, CreditCard, Smartphone, Building2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const methodIcons: Record<string, React.ElementType> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  UPI: Smartphone,
  BANK_TRANSFER: Building2,
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
  const { t } = useLanguage();
  const Icon = methodIcons[method] || Banknote;

  const methodLabels: Record<string, string> = {
    CASH: t("payments.cash") || "Cash",
    CREDIT_CARD: t("pos.card") || "Card",
    UPI: "UPI",
    BANK_TRANSFER: t("pos.bankMethod") || "Bank",
  };

  const label = methodLabels[method] || method;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 p-2 min-h-[60px] sm:p-4 sm:min-h-[80px] transition-all",
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
