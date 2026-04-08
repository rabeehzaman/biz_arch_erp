"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";

interface Variant {
  id: string;
  name: string;
  price: number;
  barcode?: string | null;
}

interface VariantPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  variants: Variant[];
  modifiers?: string[];
  onSelect: (variant: Variant | null, selectedModifiers: string[]) => void;
}

export function VariantPickerDialog({
  open,
  onOpenChange,
  productName,
  variants,
  modifiers = [],
  onSelect,
}: VariantPickerDialogProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);

  const hasVariants = variants.length > 0;
  const hasModifiers = modifiers.length > 0;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedVariant(null);
      setSelectedModifiers([]);
    }
  }, [open]);

  const toggleModifier = (mod: string) => {
    setSelectedModifiers((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleAdd = () => {
    onSelect(selectedVariant, selectedModifiers);
    onOpenChange(false);
  };

  // If only variants and no modifiers, keep the quick-tap behavior
  if (hasVariants && !hasModifiers) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{productName}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("pos.chooseVariant")}</p>
          </DialogHeader>
          <div className="grid gap-2">
            {variants.map((v) => (
              <Button
                key={v.id}
                variant="outline"
                className="h-auto justify-between px-4 py-3"
                onClick={() => {
                  onSelect(v, []);
                  onOpenChange(false);
                }}
              >
                <span className="font-medium">{v.name}</span>
                <span className="text-muted-foreground">{fmt(v.price)}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Combined variant + modifier dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{productName}</DialogTitle>
        </DialogHeader>

        {/* Variant selection */}
        {hasVariants && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{t("pos.chooseVariant")}</p>
            <div className="grid grid-cols-2 gap-2">
              {variants.map((v) => (
                <Button
                  key={v.id}
                  variant={selectedVariant?.id === v.id ? "default" : "outline"}
                  className="h-auto flex-col gap-0.5 px-3 py-2.5"
                  onClick={() => setSelectedVariant(v)}
                >
                  <span className="font-medium">{v.name}</span>
                  <span className={selectedVariant?.id === v.id ? "text-primary-foreground/70" : "text-muted-foreground"}>{fmt(v.price)}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Modifier chips */}
        {hasModifiers && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{t("pos.modifiers")}</p>
            <div className="flex flex-wrap gap-2">
              {modifiers.map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleModifier(mod)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selectedModifiers.includes(mod)
                      ? "border-orange-500 bg-orange-50 text-orange-700 font-medium"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add button */}
        <Button
          className="w-full mt-2"
          disabled={hasVariants && !selectedVariant}
          onClick={handleAdd}
        >
          {t("pos.addToCart")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
