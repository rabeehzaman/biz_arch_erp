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
  compact?: boolean;
}

export function PaymentMethodButton({
  method,
  isSelected,
  onClick,
  compact = false,
}: PaymentMethodButtonProps) {
  const { t } = useLanguage();
  const Icon = methodIcons[method] || Banknote;

  const methodLabels: Record<string, string> = {
    CASH: t("payments.cash"),
    CREDIT_CARD: t("pos.card"),
    UPI: "UPI",
    BANK_TRANSFER: t("pos.bankMethod"),
  };

  const label = methodLabels[method] || method;

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "rounded-2xl border transition-all duration-150",
        compact
          ? "flex min-h-[52px] items-center gap-2.5 px-3 py-2 text-left"
          : "flex flex-col items-center justify-center p-2 sm:min-h-[80px] sm:p-4",
        isSelected
          ? "border-primary/70 bg-primary/[0.08] text-primary shadow-[0_16px_30px_-24px_rgba(14,165,233,0.55)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {compact ? (
        <>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl border",
              isSelected
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-slate-200 bg-slate-50 text-slate-500",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-current">
            {label}
          </span>
        </>
      ) : (
        <>
          <Icon className="mb-1 h-6 w-6" />
          <span className="text-sm font-medium">{label}</span>
        </>
      )}
    </button>
  );
}
