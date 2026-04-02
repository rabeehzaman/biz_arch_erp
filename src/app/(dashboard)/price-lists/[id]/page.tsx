"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useEdition } from "@/hooks/use-edition";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PriceListDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  defaultDiscountPercent: number;
  assignments: Array<{
    id: string;
    user: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
  }>;
}

interface PriceListItemData {
  id: string;
  productId: string;
  overrideType: string;
  fixedPrice: number | null;
  percentOffset: number | null;
  product: { id: string; name: string; sku: string | null; price: number };
}

export default function PriceListViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { config: editionConfig } = useEdition();
  const currencySymbol = editionConfig?.currencySymbol ?? "\u20B9";

  const [priceList, setPriceList] = useState<PriceListDetail | null>(null);
  const [items, setItems] = useState<PriceListItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [plRes, itemsRes] = await Promise.all([
          fetch(`/api/price-lists/${id}`),
          fetch(`/api/price-lists/${id}/items`),
        ]);
        if (!plRes.ok) throw new Error();
        const plData = await plRes.json();
        setPriceList(plData);

        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(
            itemsData.map((i: any) => ({
              ...i,
              fixedPrice: i.fixedPrice !== null ? Number(i.fixedPrice) : null,
              percentOffset: i.percentOffset !== null ? Number(i.percentOffset) : null,
              product: { ...i.product, price: Number(i.product.price) },
            }))
          );
        }
      } catch {
        toast.error(t("priceLists.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id, t]);

  const effectivePrice = (item: PriceListItemData) => {
    const base = item.product.price;
    if (item.overrideType === "FIXED" && item.fixedPrice !== null) return item.fixedPrice;
    if (item.overrideType === "PERCENTAGE" && item.percentOffset !== null) {
      return Math.round(base * (1 + item.percentOffset / 100) * 100) / 100;
    }
    return base;
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/price-lists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("priceLists.deleted"));
      router.push("/price-lists");
    } catch {
      toast.error(t("priceLists.deleteFailed"));
    }
  };

  if (isLoading) {
    return (
      <PageAnimation>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </PageAnimation>
    );
  }

  if (!priceList) {
    return (
      <PageAnimation>
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-slate-500">{t("priceLists.loadFailed")}</p>
          <Link href="/price-lists" className="mt-4">
            <Button variant="outline">{t("priceLists.back")}</Button>
          </Link>
        </div>
      </PageAnimation>
    );
  }

  const assignedUsers = priceList.assignments.filter((a) => a.user);
  const assignedCustomers = priceList.assignments.filter((a) => a.customer);

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <Link href="/price-lists">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{priceList.name}</h2>
                <Badge variant={priceList.isActive ? "default" : "secondary"}>
                  {priceList.isActive ? t("priceLists.active") : t("priceLists.inactive")}
                </Badge>
              </div>
              {priceList.description && (
                <p className="text-slate-500">{priceList.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/price-lists/${id}/edit`)}
            >
              <Pencil className="mr-1 h-4 w-4" /> {t("common.edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/price-lists/new?duplicate=${id}`)}
            >
              <Copy className="mr-1 h-4 w-4" /> {t("priceLists.duplicate")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" /> {t("common.delete")}
            </Button>
          </div>
        </div>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t("priceLists.details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-sm text-slate-500">{t("priceLists.name")}</p>
                <p className="font-medium">{priceList.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{t("priceLists.description")}</p>
                <p className="font-medium">{priceList.description || "\u2014"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{t("priceLists.defaultDiscount")}</p>
                <p className="font-medium">
                  {Number(priceList.defaultDiscountPercent) > 0
                    ? `${Number(priceList.defaultDiscountPercent)}%`
                    : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{t("priceLists.status")}</p>
                <Badge variant={priceList.isActive ? "default" : "secondary"}>
                  {priceList.isActive ? t("priceLists.active") : t("priceLists.inactive")}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>{t("priceLists.lineItems")} ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-slate-500">
                {t("priceLists.noItems")}
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden sm:block">
                  <div className="overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>#</TableHead>
                          <TableHead>{t("priceLists.product")}</TableHead>
                          <TableHead>{t("priceLists.basePrice")}</TableHead>
                          <TableHead>{t("priceLists.overrideType")}</TableHead>
                          <TableHead>{t("priceLists.value")}</TableHead>
                          <TableHead>{t("priceLists.effectivePrice")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs text-slate-400">{index + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{item.product.name}</p>
                                {item.product.sku && (
                                  <p className="text-xs text-slate-400">{item.product.sku}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {currencySymbol}{Number(item.product.price).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.overrideType === "FIXED" ? t("priceLists.fixed") : t("priceLists.percentage")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.overrideType === "FIXED"
                                ? `${currencySymbol}${Number(item.fixedPrice ?? 0).toLocaleString()}`
                                : `${Number(item.percentOffset ?? 0)}%`}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {currencySymbol}{effectivePrice(item).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile */}
                <div className="space-y-3 sm:hidden">
                  {items.map((item, index) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.product.name}</p>
                          {item.product.sku && (
                            <p className="text-xs text-slate-400">{item.product.sku}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {item.overrideType === "FIXED" ? t("priceLists.fixed") : t("priceLists.percentage")}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          {t("priceLists.basePrice")}: {currencySymbol}{Number(item.product.price).toLocaleString()}
                        </span>
                        <span className="font-medium">
                          {currencySymbol}{effectivePrice(item).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>{t("priceLists.assignments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("priceLists.assignedUsers")}</h4>
                <div className="flex flex-wrap gap-2">
                  {assignedUsers.length === 0 ? (
                    <span className="text-xs text-slate-400">{t("priceLists.noUsersAssigned")}</span>
                  ) : (
                    assignedUsers.map((a) => (
                      <Badge key={a.id} variant="secondary">{a.user!.name}</Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("priceLists.assignedCustomers")}</h4>
                <div className="flex flex-wrap gap-2">
                  {assignedCustomers.length === 0 ? (
                    <span className="text-xs text-slate-400">{t("priceLists.noCustomersAssigned")}</span>
                  ) : (
                    assignedCustomers.map((a) => (
                      <Badge key={a.id} variant="secondary">{a.customer!.name}</Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("priceLists.deleteConfirmTitle")}
        description={t("priceLists.deleteConfirmDesc")}
        onConfirm={handleDelete}
      />
    </PageAnimation>
  );
}
