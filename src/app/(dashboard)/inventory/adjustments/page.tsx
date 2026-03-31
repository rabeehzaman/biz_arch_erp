"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ClipboardList, Search, Warehouse, TrendingUp, TrendingDown, Eye, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  isActive: boolean;
}

interface AdjustmentItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    unit: { name: string; code: string } | null;
  };
  systemQuantity: number;
  physicalQuantity: number;
  adjustmentType: "INCREASE" | "DECREASE";
  quantity: number;
  unitCost: number;
  reason: string | null;
}

interface Adjustment {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  notes: string | null;
  status: "DRAFT" | "RECONCILED";
  reconciledAt: string | null;
  warehouseId: string | null;
  warehouse?: { id: string; name: string; code: string } | null;
  items: AdjustmentItem[];
}

export default function StockTakesPage() {
  const { data: session } = useSession();
  const { symbol, locale } = useCurrency();
  const { t } = useLanguage();
  const multiBranchEnabled = session?.user?.multiBranchEnabled;

  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("all");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [_deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [adjRes, warehousesRes] = await Promise.all([
        fetch("/api/inventory-adjustments"),
        fetch("/api/warehouses"),
      ]);

      if (adjRes.ok) setAdjustments(await adjRes.json());
      if (warehousesRes.ok) {
        const w = await warehousesRes.json();
        setWarehouses(w.filter((x: WarehouseItem) => x.isActive));
      }
    } catch {
      toast.error(t("inventory.failedToLoadStockTakes"));
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = adjustments.filter((a) => {
    const matchSearch = a.adjustmentNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.items.some((i) => i.product.name.toLowerCase().includes(search.toLowerCase()));
    const matchWh =
      filterWarehouse === "all" ||
      (filterWarehouse === "none" ? !a.warehouseId : a.warehouseId === filterWarehouse);
    return matchSearch && matchWh;
  });

  const draftCount = adjustments.filter((a) => a.status === "DRAFT").length;
  const reconciledCount = adjustments.filter((a) => a.status === "RECONCILED").length;

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory-adjustments/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("inventory.stockTakeDeleted"));
        setDeleteId(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || t("inventory.failedToDeleteStockTake"));
      }
    } catch {
      toast.error(t("inventory.failedToDeleteStockTake"));
    } finally {
      setDeleting(false);
    }
  }

  function getItemSummary(adj: Adjustment) {
    let shortages = 0;
    let surpluses = 0;
    for (const item of adj.items) {
      const qty = Number(item.quantity);
      if (qty === 0) continue;
      if (item.adjustmentType === "DECREASE") shortages++;
      else surpluses++;
    }
    return { shortages, surpluses };
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("inventory.stockTakes")}</h2>
            <p className="text-slate-500">{t("inventory.noStockTakesDesc")}</p>
          </div>
          <Link href="/inventory/adjustments/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("inventory.newStockTake")}
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <StaggerContainer>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StaggerItem>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <ClipboardList className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t("inventory.totalStockTakes")}</p>
                      <p className="text-2xl font-bold">{adjustments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t("inventory.draft")}</p>
                      <p className="text-2xl font-bold text-amber-600">{draftCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t("inventory.reconciled")}</p>
                      <p className="text-2xl font-bold text-emerald-600">{reconciledCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </div>
        </StaggerContainer>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("inventory.searchStockTakes")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {multiBranchEnabled && warehouses.length > 0 && (
                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={t("inventory.allWarehouses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("inventory.allWarehouses")}</SelectItem>
                    <SelectItem value="none">{t("inventory.noWarehouseGlobal")}</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.branch.name} &rarr; {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("inventory.stockTakes")} ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <ClipboardList className="h-12 w-12 mb-3 text-slate-300" />
                <p className="font-medium">{t("inventory.noStockTakes")}</p>
                <p className="text-sm">{t("inventory.noStockTakesDesc")}</p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 p-4 sm:hidden">
                  {filtered.map((adj) => {
                    const { shortages, surpluses } = getItemSummary(adj);
                    return (
                      <Link key={adj.id} href={`/inventory/adjustments/${adj.id}`} className="block">
                        <div className="border rounded-lg p-4 space-y-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{adj.adjustmentNumber}</p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(adj.adjustmentDate), "dd MMM yyyy")}
                              </p>
                            </div>
                            <Badge
                              variant={adj.status === "DRAFT" ? "outline" : "default"}
                              className={adj.status === "DRAFT"
                                ? "border-amber-300 text-amber-700 bg-amber-50"
                                : "bg-emerald-100 text-emerald-800"}
                            >
                              {adj.status === "DRAFT"
                                ? <><Clock className="h-3 w-3 mr-1" />{t("inventory.draft")}</>
                                : <><CheckCircle className="h-3 w-3 mr-1" />{t("inventory.reconciled")}</>}
                            </Badge>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-500">{t("inventory.countItems")}: {adj.items.length}</span>
                            {shortages > 0 && (
                              <Badge variant="destructive" className="text-xs py-0">
                                <TrendingDown className="h-3 w-3 mr-1" />{shortages} {t("inventory.shortage")}
                              </Badge>
                            )}
                            {surpluses > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-xs py-0">
                                <TrendingUp className="h-3 w-3 mr-1" />{surpluses} {t("inventory.surplus")}
                              </Badge>
                            )}
                          </div>
                          {adj.warehouse && (
                            <p className="text-xs text-slate-500">
                              <Warehouse className="inline h-3 w-3 mr-1" />
                              {adj.warehouse.name}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("inventory.stockTakeNumber")}</TableHead>
                        <TableHead>{t("inventory.countDate")}</TableHead>
                        <TableHead className="text-center">{t("common.status")}</TableHead>
                        {multiBranchEnabled && <TableHead>{t("inventory.warehouse")}</TableHead>}
                        <TableHead className="text-center">{t("inventory.countItems")}</TableHead>
                        <TableHead className="text-center">{t("inventory.difference")}</TableHead>
                        <TableHead>{t("common.notes")}</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((adj) => {
                        const { shortages, surpluses } = getItemSummary(adj);
                        return (
                          <TableRow key={adj.id} className="cursor-pointer hover:bg-slate-50">
                            <TableCell className="font-medium">
                              <Link href={`/inventory/adjustments/${adj.id}`} className="hover:underline">
                                {adj.adjustmentNumber}
                              </Link>
                            </TableCell>
                            <TableCell>{format(new Date(adj.adjustmentDate), "dd MMM yyyy")}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={adj.status === "DRAFT" ? "outline" : "default"}
                                className={adj.status === "DRAFT"
                                  ? "border-amber-300 text-amber-700 bg-amber-50"
                                  : "bg-emerald-100 text-emerald-800"}
                              >
                                {adj.status === "DRAFT"
                                  ? <><Clock className="h-3 w-3 mr-1" />{t("inventory.draft")}</>
                                  : <><CheckCircle className="h-3 w-3 mr-1" />{t("inventory.reconciled")}</>}
                              </Badge>
                            </TableCell>
                            {multiBranchEnabled && (
                              <TableCell>{adj.warehouse?.name || "\u2014"}</TableCell>
                            )}
                            <TableCell className="text-center">{adj.items.length}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                {surpluses > 0 && (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                                    <TrendingUp className="h-3 w-3 mr-1" />+{surpluses}
                                  </Badge>
                                )}
                                {shortages > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    <TrendingDown className="h-3 w-3 mr-1" />-{shortages}
                                  </Badge>
                                )}
                                {surpluses === 0 && shortages === 0 && (
                                  <span className="text-slate-400 text-sm">{t("inventory.noChange")}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-slate-500 text-sm">
                              {adj.notes || "\u2014"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Link href={`/inventory/adjustments/${adj.id}`}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                  onClick={(e) => { e.preventDefault(); setDeleteId(adj.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => { if (!open) setDeleteId(null); }}
          title={t("inventory.deleteStockTake")}
          description={t("inventory.deleteStockTakeConfirm")}
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </PageAnimation>
  );
}
