"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Search, Package, Scale } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

const PURITY_LABELS: Record<string, string> = {
  K24: "24K", K22: "22K", K21: "21K", K18: "18K", K14: "14K", K9: "9K",
};

const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: "bg-green-100 text-green-800",
  SOLD: "bg-blue-100 text-blue-800",
  IN_REPAIR: "bg-yellow-100 text-yellow-800",
  ON_APPROVAL: "bg-purple-100 text-purple-800",
  CONSIGNMENT: "bg-orange-100 text-orange-800",
};

export default function JewelleryInventoryPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [purityFilter, setPurityFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
  if (purityFilter !== "ALL") queryParams.set("purity", purityFilter);

  const { data, mutate, isLoading } = useSWR(`/api/jewellery/items?${queryParams}`, fetcher);
  const { data: categories } = useSWR("/api/jewellery/categories", fetcher);
  const items = data?.items || [];
  const total = data?.total || 0;

  // Form state
  const [form, setForm] = useState({
    tagNumber: "", categoryId: "", metalType: "GOLD", purity: "K22",
    grossWeight: "", stoneWeight: "0", makingChargeType: "PER_GRAM",
    makingChargeValue: "", wastagePercent: "5", costPrice: "", goldRateAtPurchase: "",
    stoneValue: "0", huidNumber: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!form.tagNumber || !form.grossWeight) {
      toast.error("Tag number and gross weight are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jewellery/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          grossWeight: Number(form.grossWeight),
          stoneWeight: Number(form.stoneWeight),
          makingChargeValue: Number(form.makingChargeValue) || 0,
          wastagePercent: Number(form.wastagePercent),
          costPrice: Number(form.costPrice) || 0,
          goldRateAtPurchase: Number(form.goldRateAtPurchase) || 0,
          stoneValue: Number(form.stoneValue) || 0,
        }),
      });
      if (res.ok) {
        toast.success("Item added");
        setDialogOpen(false);
        setForm({ tagNumber: "", categoryId: "", metalType: "GOLD", purity: "K22", grossWeight: "", stoneWeight: "0", makingChargeType: "PER_GRAM", makingChargeValue: "", wastagePercent: "5", costPrice: "", goldRateAtPurchase: "", stoneValue: "0", huidNumber: "", notes: "" });
        mutate();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to add item");
      }
    } catch {
      toast.error("Failed to add item");
    } finally {
      setSaving(false);
    }
  }, [form, mutate]);

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.jewelleryInventory")}</h1>
            <p className="text-muted-foreground">{total} items in inventory</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Opening Stock</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Opening Stock</DialogTitle>
                <p className="text-xs text-muted-foreground">For supplier purchases, use <a href="/purchase-invoices/new" className="underline text-primary">Purchase Stock</a> instead.</p>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tag Number *</Label>
                    <Input value={form.tagNumber} onChange={(e) => setForm({ ...form, tagNumber: e.target.value })} placeholder="JW-001" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {Array.isArray(categories) && categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metal Type</Label>
                    <Select value={form.metalType} onValueChange={(v) => setForm({ ...form, metalType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOLD">Gold</SelectItem>
                        <SelectItem value="SILVER">Silver</SelectItem>
                        <SelectItem value="PLATINUM">Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>HUID Number</Label>
                    <Input value={form.huidNumber} onChange={(e) => setForm({ ...form, huidNumber: e.target.value })} placeholder="6-digit HUID" maxLength={6} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Purity</Label>
                    <Select value={form.purity} onValueChange={(v) => setForm({ ...form, purity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PURITY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Gross Weight (g) *</Label>
                    <Input type="number" step="0.001" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stone Weight (g)</Label>
                    <Input type="number" step="0.001" value={form.stoneWeight} onChange={(e) => setForm({ ...form, stoneWeight: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Net Weight</Label>
                    <Input readOnly value={(Number(form.grossWeight) - Number(form.stoneWeight)).toFixed(3)} className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Making Charge Type</Label>
                    <Select value={form.makingChargeType} onValueChange={(v) => setForm({ ...form, makingChargeType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PER_GRAM">Per Gram</SelectItem>
                        <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                        <SelectItem value="FIXED">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Making Charge Value</Label>
                    <Input type="number" step="0.01" value={form.makingChargeValue} onChange={(e) => setForm({ ...form, makingChargeValue: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Wastage %</Label>
                    <Input type="number" step="0.01" value={form.wastagePercent} onChange={(e) => setForm({ ...form, wastagePercent: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cost Price</Label>
                    <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Gold Rate at Purchase</Label>
                    <Input type="number" step="0.01" value={form.goldRateAtPurchase} onChange={(e) => setForm({ ...form, goldRateAtPurchase: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stone Value</Label>
                    <Input type="number" step="0.01" value={form.stoneValue} onChange={(e) => setForm({ ...form, stoneValue: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by tag number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="IN_STOCK">In Stock</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="IN_REPAIR">In Repair</SelectItem>
              <SelectItem value="ON_APPROVAL">On Approval</SelectItem>
              <SelectItem value="CONSIGNMENT">Consignment</SelectItem>
            </SelectContent>
          </Select>
          <Select value={purityFilter} onValueChange={setPurityFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Purity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {Object.entries(PURITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Items Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Purity</TableHead>
                      <TableHead className="text-right">Gross (g)</TableHead>
                      <TableHead className="text-right">Net (g)</TableHead>
                      <TableHead className="text-right">Fine (g)</TableHead>
                      <TableHead>HUID</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.tagNumber}</TableCell>
                        <TableCell>{item.category?.name || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{item.purity}</Badge></TableCell>
                        <TableCell className="text-right">{Number(item.grossWeight).toFixed(3)}</TableCell>
                        <TableCell className="text-right">{Number(item.netWeight).toFixed(3)}</TableCell>
                        <TableCell className="text-right">{Number(item.fineWeight).toFixed(3)}</TableCell>
                        <TableCell className="font-mono text-xs">{item.huidNumber || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || "bg-gray-100"}`}>
                            {(item.status || "UNKNOWN").replace(/_/g, " ")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No items found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageAnimation>
  );
}
