"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";

interface OldGoldPurchase {
  id: string;
  weight: number;
  testedPurity: string;
  purityPercentage: number;
  totalValue: number;
  customerName: string | null;
  customer: { name: string } | null;
  createdAt: string;
}

interface OldGoldAdjustmentProps {
  customerId: string;
  onSelect: (id: string | null, amount: number) => void;
  selectedId: string | null;
  fmt: (n: number) => string;
}

export function OldGoldAdjustment({ customerId, onSelect, selectedId, fmt }: OldGoldAdjustmentProps) {
  const [purchases, setPurchases] = useState<OldGoldPurchase[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setPurchases([]);
      return;
    }
    setLoading(true);
    fetch(`/api/jewellery/old-gold?customerId=${customerId}&unadjusted=true`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPurchases(Array.isArray(data) ? data : data.purchases || []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (purchases.length === 0 && !loading) return null;

  const selected = purchases.find((p) => p.id === selectedId);

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
          <Coins className="h-4 w-4" />
          Old Gold Adjustment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select
          value={selectedId || "none"}
          onValueChange={(v) => {
            if (v === "none") {
              onSelect(null, 0);
            } else {
              const purchase = purchases.find((p) => p.id === v);
              onSelect(v, Number(purchase?.totalValue) || 0);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select old gold purchase to adjust" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No adjustment</SelectItem>
            {purchases.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.weight}g {p.testedPurity} — {fmt(Number(p.totalValue))} — {new Date(p.createdAt).toLocaleDateString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="border-amber-400 text-amber-800">
              Deduction: -{fmt(Number(selected.totalValue))}
            </Badge>
            <span className="text-xs text-amber-700">
              {selected.weight}g at {selected.purityPercentage}% purity
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
