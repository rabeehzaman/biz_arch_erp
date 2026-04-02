"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import type { PriceListData } from "./price-list-settings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceListData | null;
  onSaved: () => void;
}

export function PriceListFormDialog({ open, onOpenChange, priceList, onSaved }: Props) {
  const { t } = useLanguage();
  const isEdit = !!priceList;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultDiscountPercent, setDefaultDiscountPercent] = useState("0");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      if (priceList) {
        setName(priceList.name);
        setDescription(priceList.description ?? "");
        setDefaultDiscountPercent(String(Number(priceList.defaultDiscountPercent)));
        setIsActive(priceList.isActive);
      } else {
        setName("");
        setDescription("");
        setDefaultDiscountPercent("0");
        setIsActive(true);
      }
    }
  }, [open, priceList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        defaultDiscountPercent: parseFloat(defaultDiscountPercent) || 0,
        isActive,
      };

      const res = await fetch(
        isEdit ? `/api/price-lists/${priceList.id}` : "/api/price-lists",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      toast.success(isEdit ? t("priceLists.updated") : t("priceLists.created"));
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("priceLists.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("priceLists.edit") : t("priceLists.create")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pl-name">{t("priceLists.name")} *</Label>
            <Input
              id="pl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("priceLists.namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-desc">{t("priceLists.description")}</Label>
            <Input
              id="pl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("priceLists.descriptionPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-discount">{t("priceLists.defaultDiscount")} (%)</Label>
            <Input
              id="pl-discount"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={defaultDiscountPercent}
              onChange={(e) => setDefaultDiscountPercent(e.target.value)}
            />
            <p className="text-xs text-slate-500">{t("priceLists.defaultDiscountHint")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="pl-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="pl-active">{t("common.active")}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isEdit ? t("common.save") : t("priceLists.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
