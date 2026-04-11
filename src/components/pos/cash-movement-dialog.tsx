"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onSuccess: () => void;
}

type MovementType = "CASH_OUT" | "CASH_IN";

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

const CASH_OUT_REASONS = [
  { value: "EXPENSE", labelEn: "Expense", labelAr: "مصروف" },
  { value: "SUPPLIER_PAYMENT", labelEn: "Supplier Payment", labelAr: "دفعة مورد" },
  { value: "OWNER_DRAWING", labelEn: "Owner Drawing", labelAr: "سحب مالك" },
] as const;

const CASH_IN_REASONS = [
  { value: "OWNER_INVESTMENT", labelEn: "Owner Investment", labelAr: "استثمار مالك" },
  { value: "OTHER_INCOME", labelEn: "Other Income", labelAr: "دخل آخر" },
] as const;

export function CashMovementDialog({
  open,
  onOpenChange,
  sessionId,
  onSuccess,
}: CashMovementDialogProps) {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();

  const [movementType, setMovementType] = useState<MovementType>("CASH_OUT");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data for dropdowns
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Load expense accounts and suppliers when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/suppliers?compact=true").then((r) => r.json()),
    ])
      .then(([accountsData, suppliersData]) => {
        setExpenseAccounts(
          (accountsData || []).filter(
            (a: any) => a.accountType === "EXPENSE" && !a.isSystem
          )
        );
        setSuppliers(suppliersData || []);
      })
      .catch(() => {
        toast.error("Failed to load accounts/suppliers");
      })
      .finally(() => setLoadingData(false));
  }, [open]);

  const resetForm = useCallback(() => {
    setMovementType("CASH_OUT");
    setReason("");
    setAmount("");
    setDescription("");
    setNotes("");
    setSupplierId("");
    setExpenseAccountId("");
  }, []);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  // Reset reason when movement type changes
  useEffect(() => {
    setReason("");
    setSupplierId("");
    setExpenseAccountId("");
  }, [movementType]);

  const reasons = movementType === "CASH_OUT" ? CASH_OUT_REASONS : CASH_IN_REASONS;

  const handleSubmit = async () => {
    if (!reason) {
      toast.error(lang === "ar" ? "اختر السبب" : "Select a reason");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error(lang === "ar" ? "أدخل مبلغ صحيح" : "Enter a valid amount");
      return;
    }
    if (reason === "EXPENSE" && !expenseAccountId) {
      toast.error(lang === "ar" ? "اختر حساب المصروف" : "Select an expense account");
      return;
    }
    if (reason === "SUPPLIER_PAYMENT" && !supplierId) {
      toast.error(lang === "ar" ? "اختر المورد" : "Select a supplier");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/pos/cash-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          movementType,
          reason,
          amount: Number(amount),
          description: description || undefined,
          notes: notes || undefined,
          supplierId: reason === "SUPPLIER_PAYMENT" ? supplierId : undefined,
          expenseAccountId: reason === "EXPENSE" ? expenseAccountId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create cash movement");
      }

      toast.success(
        lang === "ar"
          ? `تم تسجيل ${movementType === "CASH_IN" ? "الإيداع" : "السحب"} بنجاح`
          : `${movementType === "CASH_IN" ? "Cash In" : "Cash Out"} recorded successfully`
      );
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to record cash movement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lang === "ar" ? "حركة نقدية" : "Cash In / Out"}
          </DialogTitle>
          <DialogDescription>
            {lang === "ar"
              ? "تسجيل إيداع أو سحب نقدي من الصندوق"
              : "Record cash added to or removed from the register"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Movement Type Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition-colors",
                movementType === "CASH_OUT"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                  : "border-muted hover:border-muted-foreground/30"
              )}
              onClick={() => setMovementType("CASH_OUT")}
            >
              <ArrowUpCircle className="h-5 w-5" />
              {lang === "ar" ? "سحب نقدي" : "Cash Out"}
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition-colors",
                movementType === "CASH_IN"
                  ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : "border-muted hover:border-muted-foreground/30"
              )}
              onClick={() => setMovementType("CASH_IN")}
            >
              <ArrowDownCircle className="h-5 w-5" />
              {lang === "ar" ? "إيداع نقدي" : "Cash In"}
            </button>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "السبب" : "Reason"}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue
                  placeholder={lang === "ar" ? "اختر السبب..." : "Select reason..."}
                />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {lang === "ar" ? r.labelAr : r.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expense Account - shown only for EXPENSE reason */}
          {reason === "EXPENSE" && (
            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "حساب المصروف" : "Expense Account"}</Label>
              <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingData
                        ? lang === "ar" ? "جاري التحميل..." : "Loading..."
                        : lang === "ar" ? "اختر الحساب..." : "Select account..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Supplier - shown only for SUPPLIER_PAYMENT reason */}
          {reason === "SUPPLIER_PAYMENT" && (
            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "المورد" : "Supplier"}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingData
                        ? lang === "ar" ? "جاري التحميل..." : "Loading..."
                        : lang === "ar" ? "اختر المورد..." : "Select supplier..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "المبلغ" : "Amount"}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-semibold"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "الوصف" : "Description"}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === "ar" ? "وصف مختصر..." : "Brief description..."}
            />
          </div>

          {/* Notes (optional) */}
          <div className="space-y-1.5">
            <Label>
              {lang === "ar" ? "ملاحظات" : "Notes"}{" "}
              <span className="text-muted-foreground text-xs">
                ({lang === "ar" ? "اختياري" : "optional"})
              </span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === "ar" ? "ملاحظات إضافية..." : "Additional notes..."}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason || !amount || Number(amount) <= 0}
            className={
              movementType === "CASH_OUT"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {lang === "ar"
              ? movementType === "CASH_IN" ? "تسجيل الإيداع" : "تسجيل السحب"
              : movementType === "CASH_IN" ? "Record Cash In" : "Record Cash Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
