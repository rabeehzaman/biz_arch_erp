"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export function POSSettings() {
  const [receiptPrinting, setReceiptPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/pos-receipt-printing")
      .then((r) => r.json())
      .then((data) => setReceiptPrinting(data.value === "true"))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggle = async (checked: boolean) => {
    const prev = receiptPrinting;
    setReceiptPrinting(checked);

    try {
      const res = await fetch("/api/settings/pos-receipt-printing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: checked ? "true" : "false" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Receipt printing ${checked ? "enabled" : "disabled"}`);
    } catch {
      setReceiptPrinting(prev);
      toast.error("Failed to update receipt printing setting");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          POS Receipts
        </CardTitle>
        <CardDescription>
          Configure receipt printing for the Point of Sale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="receipt-printing">Auto-print receipt after sale</Label>
            <p className="text-sm text-muted-foreground">
              Automatically open the print dialog with a thermal receipt after each POS checkout
            </p>
          </div>
          <Switch
            id="receipt-printing"
            checked={receiptPrinting}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
