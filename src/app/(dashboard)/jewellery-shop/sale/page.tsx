"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Using native <select> to avoid Radix Select hydration crash with next-themes
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Trash2, Gem, Receipt, Search, Download, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";
import { useJewelleryRates } from "@/hooks/use-jewellery-rates";
import { calculateJewelleryLinePrice } from "@/lib/jewellery/client-pricing";

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

const PURITY_LABELS: Record<string, string> = {
  K24: "24K", K22: "22K", K21: "21K", K18: "18K", K14: "14K", K9: "9K",
};

interface JewelleryItem {
  id: string;
  tagNumber: string;
  purity: string;
  metalType: string;
  grossWeight: string;
  stoneWeight: string;
  netWeight: string;
  fineWeight: string;
  makingChargeType: string;
  makingChargeValue: string;
  wastagePercent: string;
  stoneValue: string;
  costPrice: string;
  huidNumber: string | null;
  category?: { name: string } | null;
}

export default function JewellerySalePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { fmt } = useCurrency();
  const { data: stockData, mutate: mutateStock } = useSWR(mounted ? "/api/jewellery/items?status=IN_STOCK" : null, fetcher);
  const { data: customerData } = useSWR(mounted ? "/api/customers" : null, fetcher);
  const { data: oldGoldData, mutate: mutateOldGold } = useSWR(mounted ? "/api/jewellery/old-gold?unadjusted=true" : null, fetcher);
  const { getRate } = useJewelleryRates(mounted);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [oldGoldId, setOldGoldId] = useState("none");
  const [processing, setProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [search, setSearch] = useState("");

  const allItems: JewelleryItem[] = (stockData?.items || stockData || []);
  const items = search
    ? allItems.filter((i: JewelleryItem) =>
        i.tagNumber.toLowerCase().includes(search.toLowerCase()) ||
        i.purity.toLowerCase().includes(search.toLowerCase()) ||
        i.metalType.toLowerCase().includes(search.toLowerCase()) ||
        (i.huidNumber && i.huidNumber.toLowerCase().includes(search.toLowerCase())) ||
        (i.category?.name && i.category.name.toLowerCase().includes(search.toLowerCase()))
      )
    : allItems;
  const customers = (customerData?.data || customerData?.customers || (Array.isArray(customerData) ? customerData : []));
  const oldGoldPurchases = (oldGoldData?.purchases || oldGoldData?.data || (Array.isArray(oldGoldData) ? oldGoldData : []));

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleSale = useCallback(async () => {
    if (!customerId) { toast.error("Please select a customer"); return; }
    if (selectedItems.length === 0) { toast.error("Please select at least one item"); return; }

    setProcessing(true);
    try {
      const body: any = { customerId, itemIds: selectedItems, paymentType };
      if (oldGoldId && oldGoldId !== "none") body.oldGoldAdjustmentId = oldGoldId;

      const res = await fetch("/api/jewellery/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setLastInvoice(data);
        setSelectedItems([]);
        setOldGoldId("none");
        mutateStock();
        mutateOldGold();
        toast.success(`Invoice ${data.invoice.invoiceNumber} created`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Sale failed");
      }
    } catch {
      toast.error("Sale failed");
    } finally {
      setProcessing(false);
    }
  }, [customerId, selectedItems, paymentType, oldGoldId, mutateStock, mutateOldGold]);

  const selectedItemDetails = allItems.filter((i: JewelleryItem) => selectedItems.includes(i.id));

  if (!mounted) {
    return (
      <PageAnimation>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      </PageAnimation>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-7 w-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jewellery Sale</h1>
            <p className="text-muted-foreground">Select items, customer, and create invoice</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Item Selection */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base">Select Items to Sell</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search tag, HUID, purity..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Tag</TableHead>
                          <TableHead>Purity</TableHead>
                          <TableHead className="text-right">Gross Wt</TableHead>
                          <TableHead className="text-right">Net Wt</TableHead>
                          <TableHead className="text-right">Fine Wt</TableHead>
                          <TableHead>Making</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item: JewelleryItem) => (
                          <TableRow
                            key={item.id}
                            className={`cursor-pointer ${selectedItems.includes(item.id) ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                            onClick={() => toggleItem(item.id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedItems.includes(item.id)}
                                onCheckedChange={() => toggleItem(item.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.tagNumber}</div>
                              {item.huidNumber && <div className="text-[10px] text-muted-foreground">HUID: {item.huidNumber}</div>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{PURITY_LABELS[item.purity] || item.purity}</Badge>
                              <span className="ml-1 text-xs text-muted-foreground">{item.metalType}</span>
                            </TableCell>
                            <TableCell className="text-right">{Number(item.grossWeight).toFixed(2)}g</TableCell>
                            <TableCell className="text-right">{Number(item.netWeight).toFixed(2)}g</TableCell>
                            <TableCell className="text-right">{Number(item.fineWeight).toFixed(3)}g</TableCell>
                            <TableCell>
                              <span className="text-xs">
                                {item.makingChargeType === "PER_GRAM" ? `${fmt(Number(item.makingChargeValue))}/g` :
                                 item.makingChargeType === "PERCENTAGE" ? `${item.makingChargeValue}%` :
                                 fmt(Number(item.makingChargeValue))}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium">{fmt(Number(item.costPrice))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {search ? `No items matching "${search}"` : "No items in stock"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Sale Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Sale Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Select customer</option>
                    {customers.map((c: { id: string; name: string; phone?: string }) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CREDIT">Credit (On Account)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Old Gold Adjustment (Optional)</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={oldGoldId}
                    onChange={(e) => setOldGoldId(e.target.value)}
                  >
                    <option value="none">None</option>
                    {oldGoldPurchases.map((og: { id: string; weight: string; testedPurity: string; totalValue: string; customerName?: string; customer?: { name: string } }) => (
                      <option key={og.id} value={og.id}>
                        {og.customer?.name || og.customerName || "Walk-in"} — {Number(og.weight).toFixed(1)}g {og.testedPurity} ({fmt(Number(og.totalValue))})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice Preview with Pricing */}
                {selectedItemDetails.length > 0 && (() => {
                  const oldGoldValue = oldGoldId !== "none" ? Number(oldGoldPurchases.find((o: { id: string }) => o.id === oldGoldId)?.totalValue || 0) : 0;
                  let totalGoldValue = 0, totalWastage = 0, totalMaking = 0, totalStones = 0, totalSubtotal = 0, totalFineWeight = 0, totalGrossWeight = 0;

                  const itemPricings = selectedItemDetails.map((item: JewelleryItem) => {
                    const rate = getRate(item.purity, item.metalType);
                    const pricing = calculateJewelleryLinePrice({
                      grossWeight: Number(item.grossWeight), stoneWeight: Number(item.stoneWeight || 0),
                      purity: item.purity, metalType: item.metalType, goldRate: rate,
                      wastagePercent: Number(item.wastagePercent), makingChargeType: item.makingChargeType as "PER_GRAM" | "PERCENTAGE" | "FIXED",
                      makingChargeValue: Number(item.makingChargeValue), stoneValue: Number(item.stoneValue),
                    });
                    totalGoldValue += pricing.goldValue; totalWastage += pricing.wastageValue;
                    totalMaking += pricing.makingCharges; totalStones += pricing.stoneValue;
                    totalSubtotal += pricing.subtotal; totalFineWeight += pricing.fineWeight;
                    totalGrossWeight += Number(item.grossWeight);
                    return { item, pricing, rate };
                  });

                  const estimatedTax = Math.round(totalSubtotal * 0.03 * 100) / 100;
                  const estimatedTotal = Math.round((totalSubtotal + estimatedTax - oldGoldValue) * 100) / 100;

                  return (
                    <div className="border rounded-lg overflow-hidden bg-amber-50/50 dark:bg-amber-950/10">
                      <div className="px-3 py-2 bg-amber-100/50 dark:bg-amber-900/20 border-b">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Invoice Preview — {selectedItemDetails.length} item(s)
                        </p>
                      </div>
                      <div className="p-3 space-y-2">
                        {/* Per-item breakdown */}
                        {itemPricings.map(({ item, pricing, rate }) => (
                          <div key={item.id} className="text-xs border-b pb-2 last:border-0">
                            <div className="flex items-center justify-between font-medium">
                              <span>{item.tagNumber} <span className="text-muted-foreground">({PURITY_LABELS[item.purity]}, {Number(item.grossWeight).toFixed(1)}g)</span></span>
                              <button onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}>
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 mt-1 text-muted-foreground">
                              <span>Gold ({fmt(rate)}/g)</span><span className="text-right">{fmt(pricing.goldValue)}</span>
                              {pricing.wastageValue > 0 && <><span>Wastage ({item.wastagePercent}%)</span><span className="text-right">{fmt(pricing.wastageValue)}</span></>}
                              {pricing.makingCharges > 0 && <><span>Making</span><span className="text-right">{fmt(pricing.makingCharges)}</span></>}
                              {pricing.stoneValue > 0 && <><span>Stones</span><span className="text-right">{fmt(pricing.stoneValue)}</span></>}
                            </div>
                            <div className="flex justify-between mt-1 font-medium">
                              <span>Item Total</span><span>{fmt(pricing.subtotal)}</span>
                            </div>
                          </div>
                        ))}

                        {/* Totals */}
                        <div className="border-t pt-2 space-y-1 text-xs">
                          <div className="flex justify-between"><span>Gross Weight</span><span>{totalGrossWeight.toFixed(2)}g</span></div>
                          <div className="flex justify-between"><span>Fine Weight</span><span>{totalFineWeight.toFixed(3)}g</span></div>
                          <div className="flex justify-between"><span>Gold Value</span><span>{fmt(totalGoldValue)}</span></div>
                          {totalWastage > 0 && <div className="flex justify-between"><span>Wastage</span><span>{fmt(totalWastage)}</span></div>}
                          {totalMaking > 0 && <div className="flex justify-between"><span>Making Charges</span><span>{fmt(totalMaking)}</span></div>}
                          {totalStones > 0 && <div className="flex justify-between"><span>Stone Value</span><span>{fmt(totalStones)}</span></div>}
                          <div className="flex justify-between font-semibold border-t pt-1"><span>Subtotal</span><span>{fmt(totalSubtotal)}</span></div>
                          <div className="flex justify-between text-muted-foreground"><span>Est. GST (~3%)</span><span>{fmt(estimatedTax)}</span></div>
                          {oldGoldValue > 0 && <div className="flex justify-between text-amber-700"><span>Old Gold Deduction</span><span>-{fmt(oldGoldValue)}</span></div>}
                          <div className="flex justify-between font-bold text-sm border-t pt-1 mt-1">
                            <span>Estimated Total</span><span>{fmt(Math.max(0, estimatedTotal))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <Button
                  className="w-full"
                  onClick={handleSale}
                  disabled={processing || !customerId || selectedItems.length === 0}
                >
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Gem className="mr-2 h-4 w-4" />
                  Create Sale Invoice
                </Button>
              </CardContent>
            </Card>

            {/* Last Invoice */}
            {lastInvoice && (
              <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Invoice Created</p>
                  <p className="text-lg font-bold mt-1">{lastInvoice.invoice.invoiceNumber}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between"><span>Subtotal</span><span>{fmt(Number(lastInvoice.invoice.subtotal))}</span></div>
                    {Number(lastInvoice.invoice.totalCgst) > 0 && (
                      <div className="flex justify-between"><span>CGST + SGST</span><span>{fmt(Number(lastInvoice.invoice.totalCgst) + Number(lastInvoice.invoice.totalSgst))}</span></div>
                    )}
                    {lastInvoice.breakdown?.oldGoldDeduction > 0 && (
                      <div className="flex justify-between text-amber-700"><span>Old Gold Deduction</span><span>-{fmt(lastInvoice.breakdown.oldGoldDeduction)}</span></div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>{fmt(Number(lastInvoice.invoice.total))}</span></div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/invoices/${lastInvoice.invoice.id}/pdf`);
                          if (!res.ok) { toast.error("Failed to generate PDF"); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${lastInvoice.invoice.invoiceNumber}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch { toast.error("Download failed"); }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/invoices/${lastInvoice.invoice.id}/pdf`);
                          if (!res.ok) { toast.error("Failed to generate PDF"); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const win = window.open(url, "_blank");
                          if (win) setTimeout(() => win.print(), 500);
                        } catch { toast.error("Print failed"); }
                      }}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Print
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageAnimation>
  );
}
