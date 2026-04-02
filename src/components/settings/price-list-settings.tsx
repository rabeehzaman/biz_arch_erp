"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, List, Users, Trash2 } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { PriceListFormDialog } from "./price-list-form-dialog";
import { PriceListItemsDialog } from "./price-list-items-dialog";
import { PriceListAssignDialog } from "./price-list-assign-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface PriceListData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  defaultDiscountPercent: number;
  _count: { items: number; assignments: number };
  assignments: Array<{
    id: string;
    user: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
  }>;
}

export function PriceListSettings() {
  const { t } = useLanguage();
  const [priceLists, setPriceLists] = useState<PriceListData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceListData | null>(null);
  const [itemsDialogPriceList, setItemsDialogPriceList] = useState<PriceListData | null>(null);
  const [assignDialogPriceList, setAssignDialogPriceList] = useState<PriceListData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriceListData | null>(null);

  useEffect(() => {
    fetchPriceLists();
  }, []);

  const fetchPriceLists = async () => {
    try {
      const res = await fetch("/api/price-lists");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPriceLists(data);
    } catch {
      toast.error(t("priceLists.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/price-lists/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("priceLists.deleted"));
      fetchPriceLists();
    } catch {
      toast.error(t("priceLists.deleteFailed"));
    } finally {
      setDeleteTarget(null);
    }
  };

  const userCount = (pl: PriceListData) =>
    pl.assignments.filter((a) => a.user).length;
  const customerCount = (pl: PriceListData) =>
    pl.assignments.filter((a) => a.customer).length;

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t("priceLists.title")}</h3>
          <p className="text-sm text-slate-500">{t("priceLists.subtitle")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingPriceList(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> {t("priceLists.create")}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton columns={6} rows={3} />
        ) : priceLists.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-slate-500">
            {t("priceLists.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("priceLists.name")}</TableHead>
                <TableHead>{t("priceLists.defaultDiscount")}</TableHead>
                <TableHead>{t("priceLists.items")}</TableHead>
                <TableHead>{t("priceLists.assignedTo")}</TableHead>
                <TableHead>{t("priceLists.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.map((pl) => (
                <TableRow key={pl.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{pl.name}</p>
                      {pl.description && (
                        <p className="text-xs text-slate-500">{pl.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {Number(pl.defaultDiscountPercent) > 0
                      ? `${Number(pl.defaultDiscountPercent)}%`
                      : "—"}
                  </TableCell>
                  <TableCell>{pl._count.items}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userCount(pl) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {userCount(pl)} {userCount(pl) === 1 ? "user" : "users"}
                        </Badge>
                      )}
                      {customerCount(pl) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {customerCount(pl)} {customerCount(pl) === 1 ? "customer" : "customers"}
                        </Badge>
                      )}
                      {userCount(pl) === 0 && customerCount(pl) === 0 && "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pl.isActive ? "default" : "secondary"}>
                      {pl.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t("common.edit")}
                        onClick={() => {
                          setEditingPriceList(pl);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t("priceLists.manageItems")}
                        onClick={() => setItemsDialogPriceList(pl)}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t("priceLists.assign")}
                        onClick={() => setAssignDialogPriceList(pl)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        title={t("common.delete")}
                        onClick={() => setDeleteTarget(pl)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <PriceListFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        priceList={editingPriceList}
        onSaved={fetchPriceLists}
      />

      {itemsDialogPriceList && (
        <PriceListItemsDialog
          open={!!itemsDialogPriceList}
          onOpenChange={(open) => {
            if (!open) {
              setItemsDialogPriceList(null);
              fetchPriceLists();
            }
          }}
          priceList={itemsDialogPriceList}
        />
      )}

      {assignDialogPriceList && (
        <PriceListAssignDialog
          open={!!assignDialogPriceList}
          onOpenChange={(open) => {
            if (!open) {
              setAssignDialogPriceList(null);
              fetchPriceLists();
            }
          }}
          priceList={assignDialogPriceList}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("priceLists.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("priceLists.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
