"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, Tags, Eye, Pencil, Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { FloatingActionButton } from "@/components/mobile/floating-action-button";
import { SwipeableCard } from "@/components/mobile/swipeable-card";

interface PriceListData {
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

export default function PriceListsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [priceLists, setPriceLists] = useState<PriceListData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchPriceLists = async () => {
    try {
      const res = await fetch("/api/price-lists");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPriceLists(data);
    } catch {
      toast.error(t("priceLists.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPriceLists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement?.tagName || ""))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = searchQuery
    ? priceLists.filter((pl) =>
        pl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pl.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : priceLists;

  const userCount = (pl: PriceListData) => pl.assignments.filter((a) => a.user).length;
  const customerCount = (pl: PriceListData) => pl.assignments.filter((a) => a.customer).length;

  const handleDelete = (pl: PriceListData) => {
    setConfirmDialog({
      title: t("priceLists.deleteConfirmTitle"),
      description: t("priceLists.deleteConfirmDesc"),
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/price-lists/${pl.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          toast.success(t("priceLists.deleted"));
          fetchPriceLists();
        } catch {
          toast.error(t("priceLists.deleteFailed"));
        }
      },
    });
  };

  return (
    <PageAnimation>
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("priceLists.title")}</h2>
            <p className="text-slate-500">{t("priceLists.subtitle")}</p>
          </div>
          <Link href="/price-lists/new" className="hidden sm:inline-flex">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("priceLists.newPriceList")}
            </Button>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  placeholder={t("priceLists.searchProducts")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={6} rows={4} />
              ) : priceLists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Tags className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("priceLists.empty")}</h3>
                  <Link href="/price-lists/new" className="mt-4">
                    <Button variant="outline">{t("priceLists.create")}</Button>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block">
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
                        {filtered.map((pl) => (
                          <TableRow
                            key={pl.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/price-lists/${pl.id}`)}
                          >
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
                                : "\u2014"}
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
                                {userCount(pl) === 0 && customerCount(pl) === 0 && "\u2014"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={pl.isActive ? "default" : "secondary"}>
                                {pl.isActive ? t("priceLists.active") : t("priceLists.inactive")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={t("common.view")}
                                  onClick={() => router.push(`/price-lists/${pl.id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={t("common.edit")}
                                  onClick={() => router.push(`/price-lists/${pl.id}/edit`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={t("priceLists.duplicate")}
                                  onClick={() => router.push(`/price-lists/new?duplicate=${pl.id}`)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700"
                                  title={t("common.delete")}
                                  onClick={() => handleDelete(pl)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {filtered.map((pl) => (
                      <SwipeableCard
                        key={pl.id}
                        actions={
                          <div className="flex h-full flex-col">
                            <button
                              type="button"
                              className="flex flex-1 items-center justify-center bg-slate-600 px-4 text-sm font-medium text-white"
                              onClick={() => router.push(`/price-lists/${pl.id}/edit`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="flex flex-1 items-center justify-center bg-red-500 px-4 text-sm font-medium text-white"
                              onClick={() => handleDelete(pl)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        }
                      >
                        <div
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/price-lists/${pl.id}`)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{pl.name}</p>
                              {pl.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{pl.description}</p>
                              )}
                            </div>
                            <Badge variant={pl.isActive ? "default" : "secondary"} className="text-xs">
                              {pl.isActive ? t("priceLists.active") : t("priceLists.inactive")}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>{pl._count.items} {t("priceLists.items").toLowerCase()}</span>
                            {Number(pl.defaultDiscountPercent) > 0 && (
                              <span>{Number(pl.defaultDiscountPercent)}% {t("priceLists.defaultDiscount").toLowerCase()}</span>
                            )}
                            {(userCount(pl) > 0 || customerCount(pl) > 0) && (
                              <span>
                                {userCount(pl) > 0 && `${userCount(pl)} users`}
                                {userCount(pl) > 0 && customerCount(pl) > 0 && ", "}
                                {customerCount(pl) > 0 && `${customerCount(pl)} customers`}
                              </span>
                            )}
                          </div>
                        </div>
                      </SwipeableCard>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <FloatingActionButton href="/price-lists/new" />

      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
      />
    </PageAnimation>
  );
}
