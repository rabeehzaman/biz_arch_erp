"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Users } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export default function KarigarsPage() {
  const { t } = useLanguage();
  const { data, mutate, isLoading } = useSWR("/api/jewellery/karigars", fetcher);
  const karigars = Array.isArray(data) ? data : [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [selectedKarigar, setSelectedKarigar] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", phone: "", specialization: "", address: "", wastageAllowancePercent: "3" });
  const [txForm, setTxForm] = useState({ type: "ISSUE", weight: "", purity: "K22", notes: "" });

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/jewellery/karigars", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, wastageAllowancePercent: Number(form.wastageAllowancePercent) }),
      });
      if (res.ok) { toast.success("Karigar added"); setDialogOpen(false); setForm({ name: "", phone: "", specialization: "", address: "", wastageAllowancePercent: "3" }); mutate(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  }, [form, mutate]);

  const handleTransaction = useCallback(async () => {
    if (!txForm.weight || !selectedKarigar) { toast.error("Weight is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/jewellery/karigars/${selectedKarigar.id}/transactions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...txForm, weight: Number(txForm.weight) }),
      });
      if (res.ok) { toast.success("Transaction recorded"); setTxDialogOpen(false); setTxForm({ type: "ISSUE", weight: "", purity: "K22", notes: "" }); mutate(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  }, [txForm, selectedKarigar, mutate]);

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.karigars")}</h1>
            <p className="text-muted-foreground">Manage artisans and gold issuance</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Karigar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Karigar</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g., Chains, Rings" /></div>
                  <div className="space-y-2"><Label>Wastage Allowance %</Label><Input type="number" step="0.001" value={form.wastageAllowancePercent} onChange={(e) => setForm({ ...form, wastageAllowancePercent: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Karigar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : karigars.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead className="text-right">Issued (g)</TableHead>
                      <TableHead className="text-right">Returned (g)</TableHead>
                      <TableHead className="text-right">Balance (g)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {karigars.map((k: any) => {
                      const balance = (Number(k.goldIssuedWeight) - Number(k.goldReturnedWeight) - Number(k.scrapReturnedWeight)).toFixed(3);
                      return (
                        <TableRow key={k.id}>
                          <TableCell className="font-medium">{k.name}</TableCell>
                          <TableCell>{k.phone}</TableCell>
                          <TableCell>{k.specialization || "—"}</TableCell>
                          <TableCell className="text-right">{Number(k.goldIssuedWeight).toFixed(3)}</TableCell>
                          <TableCell className="text-right">{Number(k.goldReturnedWeight).toFixed(3)}</TableCell>
                          <TableCell className="text-right font-medium">{balance}</TableCell>
                          <TableCell><Badge variant={k.isActive ? "default" : "secondary"}>{k.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => { setSelectedKarigar(k); setTxDialogOpen(true); }}>
                              Issue/Return
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No karigars added yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Dialog */}
        <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Transaction — {selectedKarigar?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={txForm.type} onValueChange={(v) => setTxForm({ ...txForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ISSUE">Issue Gold</SelectItem>
                      <SelectItem value="RETURN">Return (Finished Item)</SelectItem>
                      <SelectItem value="SCRAP">Return Scrap</SelectItem>
                      <SelectItem value="WASTAGE">Record Wastage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purity</Label>
                  <Select value={txForm.purity} onValueChange={(v) => setTxForm({ ...txForm, purity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="K24">24K</SelectItem><SelectItem value="K22">22K</SelectItem>
                      <SelectItem value="K21">21K</SelectItem><SelectItem value="K18">18K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Weight (g) *</Label><Input type="number" step="0.001" value={txForm.weight} onChange={(e) => setTxForm({ ...txForm, weight: e.target.value })} /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })} /></div>
              <Button onClick={handleTransaction} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Transaction</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageAnimation>
  );
}
