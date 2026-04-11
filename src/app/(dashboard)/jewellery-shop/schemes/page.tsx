"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, CreditCard, Wallet } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800", COMPLETED: "bg-blue-100 text-blue-800",
  WITHDRAWN: "bg-yellow-100 text-yellow-800", DEFAULTED: "bg-red-100 text-red-800",
};

export default function SchemesPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const { data, mutate, isLoading } = useSWR("/api/jewellery/schemes", fetcher);
  const { data: customers } = useSWR("/api/customers?limit=200", fetcher);
  const schemes = Array.isArray(data) ? data : [];
  const customerList = Array.isArray(customers) ? customers : customers?.customers || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    schemeName: "", customerId: "", monthlyAmount: "", durationMonths: "11", startDate: new Date().toISOString().split("T")[0],
  });
  const [payAmount, setPayAmount] = useState("");

  const handleCreate = useCallback(async () => {
    if (!form.schemeName || !form.customerId || !form.monthlyAmount) { toast.error(t("jewellery.allFieldsRequired")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/jewellery/schemes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, monthlyAmount: Number(form.monthlyAmount), durationMonths: Number(form.durationMonths) }),
      });
      if (res.ok) { toast.success("Scheme created"); setDialogOpen(false); setForm({ schemeName: "", customerId: "", monthlyAmount: "", durationMonths: "11", startDate: new Date().toISOString().split("T")[0] }); mutate(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error(t("jewellery.failed")); } finally { setSaving(false); }
  }, [form, mutate]);

  const handlePayment = useCallback(async () => {
    if (!payAmount || !selectedScheme) { toast.error(t("jewellery.amountIsRequired")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/jewellery/schemes/${selectedScheme.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(payAmount) }),
      });
      if (res.ok) { toast.success("Payment recorded"); setPayDialogOpen(false); setPayAmount(""); mutate(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error(t("jewellery.failed")); } finally { setSaving(false); }
  }, [payAmount, selectedScheme, mutate]);

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.customerSchemes")}</h1>
            <p className="text-muted-foreground">Gold savings schemes for customers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Scheme</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Customer Scheme</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Scheme Name *</Label><Input value={form.schemeName} onChange={(e) => setForm({ ...form, schemeName: e.target.value })} placeholder="e.g., Gold Savings Plan 2024" /></div>
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customerList.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Monthly Amount *</Label><Input type="number" step="0.001" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Duration (months)</Label><Input type="number" min="1" max="24" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p>Total: {fmt(Number(form.monthlyAmount || 0) * Number(form.durationMonths || 0))} over {form.durationMonths} months + 1 bonus month from jeweller</p>
                </div>
                <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Scheme</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : schemes.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Monthly</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schemes.map((s: any) => {
                      const total = Number(s.monthlyAmount) * s.durationMonths;
                      const paidPct = total > 0 ? Math.min(100, (Number(s.totalPaid) / total) * 100) : 0;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.schemeName}</TableCell>
                          <TableCell>{s.customer?.name || "—"}</TableCell>
                          <TableCell className="text-right">{fmt(Number(s.monthlyAmount))}</TableCell>
                          <TableCell>{s.durationMonths} + {s.bonusMonths} months</TableCell>
                          <TableCell className="text-right">{fmt(Number(s.totalPaid))}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-green-500" style={{ width: `${paidPct}%` }} />
                              </div>
                              <span className="text-xs">{paidPct.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                              {s.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {s.status === "ACTIVE" && (
                              <Button variant="outline" size="sm" onClick={() => { setSelectedScheme(s); setPayAmount(String(Number(s.monthlyAmount))); setPayDialogOpen(true); }}>
                                <Wallet className="mr-1 h-3 w-3" /> Pay
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No customer schemes yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment — {selectedScheme?.schemeName}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Payment Amount</Label><Input type="number" step="0.001" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <Button onClick={handlePayment} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Payment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageAnimation>
  );
}
