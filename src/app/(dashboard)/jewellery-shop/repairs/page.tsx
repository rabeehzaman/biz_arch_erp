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
import { Loader2, Plus, Wrench } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800", IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  READY: "bg-green-100 text-green-800", DELIVERED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function RepairsPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const queryParams = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
  const { data, mutate, isLoading } = useSWR(`/api/jewellery/repairs${queryParams}`, fetcher);
  const repairs = Array.isArray(data) ? data : [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: "", itemDescription: "", repairType: "", estimatedCost: "", notes: "",
  });

  const handleCreate = useCallback(async () => {
    if (!form.customerId || !form.itemDescription) { toast.error("Customer and description are required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/jewellery/repairs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, estimatedCost: Number(form.estimatedCost) || null }),
      });
      if (res.ok) { toast.success("Repair created"); setDialogOpen(false); mutate(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  }, [form, mutate]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/jewellery/repairs/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { toast.success(`Status updated to ${status}`); mutate(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed"); }
  }, [mutate]);

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.jewelleryRepairs")}</h1>
            <p className="text-muted-foreground">Track repair orders from intake to delivery</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Repair</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Repair Order</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Customer ID *</Label><Input value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} placeholder="Enter customer ID" /></div>
                <div className="space-y-2"><Label>Item Description *</Label><Input value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} placeholder="e.g., Gold chain repair, ring resizing" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Repair Type</Label><Input value={form.repairType} onChange={(e) => setForm({ ...form, repairType: e.target.value })} placeholder="e.g., Soldering, Resizing" /></div>
                  <div className="space-y-2"><Label>Estimated Cost</Label><Input type="number" step="0.01" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Repair</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {["ALL", "RECEIVED", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"].map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "ALL" ? "All" : s.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : repairs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repair #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Est. Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairs.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-medium">{r.repairNumber}</TableCell>
                        <TableCell>{r.customer?.name || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.itemDescription}</TableCell>
                        <TableCell>{r.repairType || "—"}</TableCell>
                        <TableCell className="text-right">{r.estimatedCost ? fmt(Number(r.estimatedCost)) : "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(r.receivedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {r.status === "RECEIVED" && <Button variant="outline" size="sm" onClick={() => handleStatusChange(r.id, "IN_PROGRESS")}>Start</Button>}
                          {r.status === "IN_PROGRESS" && <Button variant="outline" size="sm" onClick={() => handleStatusChange(r.id, "READY")}>Mark Ready</Button>}
                          {r.status === "READY" && <Button variant="outline" size="sm" onClick={() => handleStatusChange(r.id, "DELIVERED")}>Deliver</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Wrench className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No repair orders yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageAnimation>
  );
}
