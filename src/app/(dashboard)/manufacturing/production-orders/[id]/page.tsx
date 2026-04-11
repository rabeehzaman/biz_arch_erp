"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Play, Square, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ProductionOrderDetail {
  id: string;
  productionNumber: string;
  status: string;
  plannedQuantity: string;
  completedQuantity: string;
  scrapQuantity: string;
  plannedDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalMaterialCost: string;
  unitProductionCost: string;
  notes: string | null;
  product: { id: string; name: string; sku: string | null; price: string; cost: string };
  bom: { id: string; name: string; version: number; bomType: string; outputQuantity: string };
  items: Array<{
    id: string;
    requiredQuantity: string;
    consumedQuantity: string;
    issueMethod: string;
    unitCost: string;
    totalCost: string;
    product: { id: string; name: string; sku: string | null };
  }>;
  sourceWarehouse: { id: string; name: string; code: string } | null;
  outputWarehouse: { id: string; name: string; code: string } | null;
  outputLots: Array<{ id: string; unitCost: string; initialQuantity: string; remainingQuantity: string }>;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function ProductionOrderDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<ProductionOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionQty, setCompletionQty] = useState(0);
  const [scrapQty, setScrapQty] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { fetchOrder(); }, [params.id]);

  async function fetchOrder() {
    try {
      const res = await fetch(`/api/manufacturing/production-orders/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        setCompletionQty(Number(data.plannedQuantity) - Number(data.completedQuantity));
      }
    } catch {
      toast.error(t("manufacturing.failedToLoadOrder"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    setProcessing(true);
    try {
      const res = await fetch(`/api/manufacturing/production-orders/${params.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "complete"
          ? JSON.stringify({ completionQuantity: completionQty, scrapQuantity: scrapQty })
          : "{}",
      });
      if (res.ok) {
        const actionKey = action === "confirm" ? "orderConfirmed" : action === "start" ? "orderStarted" : action === "complete" ? "orderCompleted" : "orderCancelled";
        toast.success(t(`manufacturing.${actionKey}`));
        setCompleteOpen(false);
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error(t("manufacturing.actionFailed"));
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this draft order?")) return;
    const res = await fetch(`/api/manufacturing/production-orders/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("manufacturing.orderDeleted"));
      router.push("/manufacturing/production-orders");
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!order) {
    return <div className="p-6 text-center text-muted-foreground">Production order not found</div>;
  }

  const remaining = Number(order.plannedQuantity) - Number(order.completedQuantity);
  const progress = Number(order.plannedQuantity) > 0
    ? (Number(order.completedQuantity) / Number(order.plannedQuantity)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/manufacturing/production-orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{order.productionNumber}</h1>
            <Badge className={statusColors[order.status]}>
              {order.status === "IN_PROGRESS" ? t("manufacturing.inProgress") : t(`manufacturing.${order.status.toLowerCase()}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{order.product.name} &middot; {order.bom.name} v{order.bom.version}</p>
        </div>
        <div className="flex gap-2">
          {order.status === "DRAFT" && (
            <>
              <Button onClick={() => handleAction("confirm")} disabled={processing}>
                <CheckCircle className="mr-1 h-4 w-4" /> {t("manufacturing.confirmOrder")}
              </Button>
              <Button onClick={handleDelete} variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
          {order.status === "CONFIRMED" && (
            <Button onClick={() => handleAction("start")} disabled={processing}>
              <Play className="mr-1 h-4 w-4" /> {t("manufacturing.startProduction")}
            </Button>
          )}
          {order.status === "IN_PROGRESS" && (
            <Button onClick={() => setCompleteOpen(true)}>
              <Square className="mr-1 h-4 w-4" /> {t("manufacturing.completeProduction")}
            </Button>
          )}
          {(order.status === "DRAFT" || order.status === "CONFIRMED" || order.status === "IN_PROGRESS") && (
            <Button onClick={() => handleAction("cancel")} variant="outline" disabled={processing}>
              <XCircle className="mr-1 h-4 w-4" /> {t("manufacturing.cancelProduction")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("manufacturing.plannedQuantity")}</p>
          <p className="text-lg font-semibold">{Number(order.plannedQuantity)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("manufacturing.completedQuantity")}</p>
          <p className="text-lg font-semibold">{Number(order.completedQuantity)}</p>
          <div className="mt-1 h-1.5 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("manufacturing.scrapQuantity")}</p>
          <p className="text-lg font-semibold">{Number(order.scrapQuantity)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("manufacturing.totalMaterialCost")}</p>
          <p className="text-lg font-semibold">{Number(order.totalMaterialCost).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("manufacturing.costPerUnit")}</p>
          <p className="text-lg font-semibold">{Number(order.unitProductionCost).toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("manufacturing.materialConsumption")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.requiredQty")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.consumedQty")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.unitCost")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.lineCost")}</TableHead>
                <TableHead>{t("manufacturing.issueMethod")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell className="text-right">{Number(item.requiredQuantity).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(item.consumedQuantity).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(item.unitCost).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{Number(item.totalCost).toFixed(2)}</TableCell>
                  <TableCell>{item.issueMethod === "MANUAL" ? t("manufacturing.manual") : t("manufacturing.backflush")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.outputLots.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Output Stock Lots</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot ID</TableHead>
                  <TableHead className="text-right">{t("manufacturing.unitCost")}</TableHead>
                  <TableHead className="text-right">{t("common.quantity")}</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.outputLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-mono text-xs">{lot.id.slice(-8)}</TableCell>
                    <TableCell className="text-right">{Number(lot.unitCost).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(lot.initialQuantity)}</TableCell>
                    <TableCell className="text-right">{Number(lot.remainingQuantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("manufacturing.completeProduction")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t("manufacturing.completedQuantity")} (max: {remaining})</Label>
              <Input type="number" min="0.0001" max={remaining} step="any" value={completionQty} onChange={(e) => setCompletionQty(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t("manufacturing.scrapQuantity")}</Label>
              <Input type="number" min="0" step="any" value={scrapQty} onChange={(e) => setScrapQty(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => handleAction("complete")} disabled={processing || completionQty <= 0}>
              {processing ? t("common.saving") + "..." : t("manufacturing.completeProduction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
