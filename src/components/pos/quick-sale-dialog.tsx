"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad } from "@/components/pos/numpad";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";

interface QuickSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (price: number, description: string) => void;
}

export function QuickSaleDialog({ open, onOpenChange, onAdd }: QuickSaleDialogProps) {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [priceStr, setPriceStr] = useState("");
  const [description, setDescription] = useState("");

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPriceStr("");
      setDescription("");
    }
  }, [open]);

  const parsedPrice = parseFloat(priceStr) || 0;
  const canAdd = parsedPrice > 0;

  const handleInput = (key: string) => {
    setPriceStr((prev) => {
      if (key === "." && prev.includes(".")) return prev;
      // Max 2 decimal places
      const dotIdx = prev.indexOf(".");
      if (dotIdx >= 0 && prev.length - dotIdx > 2 && key !== ".") return prev;
      return prev + key;
    });
  };

  const handleClear = () => setPriceStr("");
  const handleBackspace = () => setPriceStr((prev) => prev.slice(0, -1));

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(parsedPrice, description.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {lang === "ar" ? "بيع سريع" : "Quick Sale"}
          </DialogTitle>
        </DialogHeader>

        {/* Price display */}
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">
            {lang === "ar" ? "السعر" : "Price"}
          </p>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {priceStr || "0"}
          </p>
        </div>

        {/* Description */}
        <Input
          placeholder={lang === "ar" ? "الوصف (اختياري)" : "Description (optional)"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm"
          dir={lang === "ar" ? "rtl" : "ltr"}
        />

        {/* Numpad */}
        <Numpad
          compact
          onInput={handleInput}
          onClear={handleClear}
          onBackspace={handleBackspace}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button disabled={!canAdd} onClick={handleAdd}>
            {lang === "ar" ? "أضف إلى السلة" : "Add to Cart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
