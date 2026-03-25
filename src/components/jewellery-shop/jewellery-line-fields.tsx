"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Gem } from "lucide-react";
import { calculateJewelleryLinePrice, type JewelleryPricingResult } from "@/lib/jewellery/client-pricing";
import { useMemo } from "react";

export interface JewelleryItemData {
  id: string;
  tagNumber: string;
  huidNumber: string | null;
  metalType: string;
  purity: string;
  grossWeight: number;
  stoneWeight: number;
  netWeight: number;
  fineWeight: number;
  makingChargeType: string;
  makingChargeValue: number;
  wastagePercent: number;
  stoneValue: number;
  costPrice: number;
  status: string;
  categoryId: string | null;
  category: { name: string } | null;
}

export interface JewelleryLineState {
  jewelleryItemId: string;
  goldRate: number;
  purity: string;
  metalType: string;
  grossWeight: number;
  stoneWeight: number;
  wastagePercent: number;
  makingChargeType: "PER_GRAM" | "PERCENTAGE" | "FIXED";
  makingChargeValue: number;
  stoneValue: number;
  tagNumber: string;
  huidNumber: string;
}

interface JewelleryLineFieldsProps {
  jewelleryData: JewelleryLineState;
  goldRate: number;
  onUpdate: (field: keyof JewelleryLineState, value: string | number) => void;
  fmt: (n: number) => string;
  readOnly?: boolean;
}

export function JewelleryLineFields({
  jewelleryData,
  goldRate,
  onUpdate,
  fmt,
  readOnly = false,
}: JewelleryLineFieldsProps) {
  const pricing: JewelleryPricingResult = useMemo(() => {
    return calculateJewelleryLinePrice({
      grossWeight: jewelleryData.grossWeight,
      stoneWeight: jewelleryData.stoneWeight || 0,
      purity: jewelleryData.purity,
      metalType: jewelleryData.metalType,
      goldRate: jewelleryData.goldRate || goldRate,
      wastagePercent: jewelleryData.wastagePercent,
      makingChargeType: jewelleryData.makingChargeType,
      makingChargeValue: jewelleryData.makingChargeValue,
      stoneValue: jewelleryData.stoneValue,
    });
  }, [jewelleryData, goldRate]);

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2 text-amber-800 text-xs font-medium">
        <Gem className="h-3.5 w-3.5" />
        <span>Jewellery Item — Tag #{jewelleryData.tagNumber}</span>
        {jewelleryData.huidNumber && (
          <Badge variant="outline" className="text-[10px] border-amber-300">
            HUID: {jewelleryData.huidNumber}
          </Badge>
        )}
      </div>

      {/* Row 1: Weights & Purity */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div>
          <Label className="text-[10px] text-amber-700">Gross Wt (g)</Label>
          <Input
            type="number"
            step="0.001"
            min="0"
            value={jewelleryData.grossWeight || ""}
            onChange={(e) => onUpdate("grossWeight", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-white"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Stone Wt (g)</Label>
          <Input
            type="number"
            step="0.001"
            min="0"
            value={jewelleryData.stoneWeight || ""}
            onChange={(e) => onUpdate("stoneWeight", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-white"
            disabled={readOnly}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Net Wt (g)</Label>
          <Input
            type="number"
            value={pricing.netWeight}
            className="h-8 text-sm bg-slate-50"
            disabled
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Fine Wt (g)</Label>
          <Input
            type="number"
            value={pricing.fineWeight}
            className="h-8 text-sm bg-slate-50"
            disabled
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Purity</Label>
          <Select
            value={jewelleryData.purity}
            onValueChange={(v) => onUpdate("purity", v)}
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["K24", "K22", "K21", "K18", "K14", "K9"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Rate, Making Charges, Wastage, Stone Value */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div>
          <Label className="text-[10px] text-amber-700">Gold Rate/g</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={jewelleryData.goldRate || goldRate || ""}
            onChange={(e) => onUpdate("goldRate", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-white"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Making Type</Label>
          <Select
            value={jewelleryData.makingChargeType}
            onValueChange={(v) => onUpdate("makingChargeType", v)}
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PER_GRAM">Per Gram</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
              <SelectItem value="FIXED">Fixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Making Value</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={jewelleryData.makingChargeValue || ""}
            onChange={(e) => onUpdate("makingChargeValue", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-white"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Wastage %</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={jewelleryData.wastagePercent || ""}
            onChange={(e) => onUpdate("wastagePercent", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-white"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-[10px] text-amber-700">Stone Value</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={jewelleryData.stoneValue || ""}
            onChange={(e) => onUpdate("stoneValue", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-white"
            disabled={readOnly}
          />
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800 border-t border-amber-200 pt-2">
        <span>Gold: {fmt(pricing.goldValue)}</span>
        <span>Wastage: {fmt(pricing.wastageValue)}</span>
        <span>Making: {fmt(pricing.makingCharges)}</span>
        {pricing.stoneValue > 0 && <span>Stones: {fmt(pricing.stoneValue)}</span>}
        <span className="font-semibold">Subtotal: {fmt(pricing.subtotal)}</span>
      </div>
    </div>
  );
}

/**
 * Create initial jewellery line state from a JewelleryItem (from product API).
 */
export function createJewelleryLineState(
  item: JewelleryItemData,
  goldRate: number
): JewelleryLineState {
  return {
    jewelleryItemId: item.id,
    goldRate: goldRate,
    purity: item.purity,
    metalType: item.metalType,
    grossWeight: Number(item.grossWeight),
    stoneWeight: Number(item.stoneWeight) || 0,
    wastagePercent: Number(item.wastagePercent),
    makingChargeType: item.makingChargeType as "PER_GRAM" | "PERCENTAGE" | "FIXED",
    makingChargeValue: Number(item.makingChargeValue),
    stoneValue: Number(item.stoneValue),
    tagNumber: item.tagNumber,
    huidNumber: item.huidNumber || "",
  };
}
