"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Cog } from "lucide-react";
import { toast } from "sonner";

interface ProductionOrder {
  id: string;
  productionNumber: string;
  status: string;
  plannedQuantity: string;
  completedQuantity: string;
  scrapQuantity: string;
  plannedDate: string | null;
  totalMaterialCost: string;
  unitProductionCost: string;
  product: { id: string; name: string; sku: string | null };
  bom: { id: string; name: string; version: number; bomType: string };
  sourceWarehouse: { name: string; code: string } | null;
  outputWarehouse: { name: string; code: string } | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function ProductionOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  async function fetchOrders() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/manufacturing/production-orders?${params}`);
      if (res.ok) setOrders(await res.json());
    } catch {
      toast.error(t("manufacturing.failedToLoadOrders"));
    } finally {
      setLoading(false);
    }
  }

  const filtered = orders.filter((o) =>
    o.productionNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("manufacturing.productionOrders")}</h1>
        </div>
        <Link href="/manufacturing/production-orders/new">
          <Button><Plus className="mr-2 h-4 w-4" />{t("manufacturing.newProductionOrder")}</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("common.search") + "..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? t("common.all") : s === "IN_PROGRESS" ? t("manufacturing.inProgress") : t(`manufacturing.${s.toLowerCase()}`)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cog className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No production orders</p>
            <Link href="/manufacturing/production-orders/new" className="mt-4">
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" />{t("manufacturing.newProductionOrder")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Link key={order.id} href={`/manufacturing/production-orders/${order.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{order.productionNumber}</span>
                      <Badge className={statusColors[order.status]}>
                        {order.status === "IN_PROGRESS" ? t("manufacturing.inProgress") : t(`manufacturing.${order.status.toLowerCase()}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.product.name} &middot; {order.bom.name} v{order.bom.version}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {Number(order.completedQuantity)}/{Number(order.plannedQuantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.plannedDate ? new Date(order.plannedDate).toLocaleDateString() : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
