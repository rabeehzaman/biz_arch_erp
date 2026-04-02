"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import { useEdition } from "@/hooks/use-edition";
import type { PriceListData } from "./price-list-settings";

interface PriceListItemData {
  id: string;
  productId: string;
  overrideType: string;
  fixedPrice: number | null;
  percentOffset: number | null;
  product: { id: string; name: string; sku: string | null; price: number };
}

interface CompactProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceListData;
}

export function PriceListItemsDialog({ open, onOpenChange, priceList }: Props) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const { config: editionConfig } = useEdition();
  const isTaxInclusive = (session?.user as { isTaxInclusivePrice?: boolean })?.isTaxInclusivePrice ?? false;
  const currencySymbol = editionConfig?.currencySymbol ?? "₹";

  const [items, setItems] = useState<PriceListItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<CompactProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState("-10");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/price-lists/${priceList.id}/items`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.map((i: PriceListItemData) => ({
        ...i,
        fixedPrice: i.fixedPrice !== null ? Number(i.fixedPrice) : null,
        percentOffset: i.percentOffset !== null ? Number(i.percentOffset) : null,
        product: { ...i.product, price: Number(i.product.price) },
      })));
    } catch {
      toast.error(t("priceLists.itemsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [priceList.id, t]);

  useEffect(() => {
    if (open) {
      fetchItems();
      // Fetch products for the add dropdown
      fetch("/api/products?compact=true")
        .then((r) => r.json())
        .then((data) => {
          setProducts(
            data.map((p: { id: string; name: string; sku: string | null; price: number; basePrice?: number }) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              price: Number(p.basePrice ?? p.price),
            }))
          );
        })
        .catch(() => {});
    }
  }, [open, fetchItems]);

  const effectivePrice = (item: PriceListItemData) => {
    const base = item.product.price;
    if (item.overrideType === "FIXED" && item.fixedPrice !== null) return item.fixedPrice;
    if (item.overrideType === "PERCENTAGE" && item.percentOffset !== null) {
      return Math.round(base * (1 + item.percentOffset / 100) * 100) / 100;
    }
    return base;
  };

  const handleAddProduct = async () => {
    if (!selectedProductId) return;
    setAdding(true);
    try {
      const prod = products.find((p) => p.id === selectedProductId);
      const res = await fetch(`/api/price-lists/${priceList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          overrideType: "FIXED",
          fixedPrice: prod?.price ?? 0,
        }),
      });
      if (!res.ok) throw new Error();
      setSelectedProductId("");
      fetchItems();
    } catch {
      toast.error(t("priceLists.addItemFailed"));
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/price-lists/${priceList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          overrideType: "PERCENTAGE",
          percentOffset: parseFloat(bulkPercent) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Added ${data.count} products`);
      setBulkOpen(false);
      fetchItems();
    } catch {
      toast.error(t("priceLists.bulkAddFailed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUpdateItem = async (item: PriceListItemData, updates: Partial<PriceListItemData>) => {
    try {
      const res = await fetch(`/api/price-lists/${priceList.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      fetchItems();
    } catch {
      toast.error(t("priceLists.updateItemFailed"));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/price-lists/${priceList.id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      toast.error(t("priceLists.deleteItemFailed"));
    }
  };

  const existingProductIds = new Set(items.map((i) => i.productId));
  const availableProducts = products.filter(
    (p) => !existingProductIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredItems = search
    ? items.filter((i) => i.product.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {priceList.name} — {t("priceLists.items")}
          </DialogTitle>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            {Number(priceList.defaultDiscountPercent) > 0 && (
              <span>{t("priceLists.defaultDiscount")}: {Number(priceList.defaultDiscountPercent)}%</span>
            )}
            <Badge variant="outline" className="text-xs">
              {t("priceLists.pricesAre")} {isTaxInclusive ? t("priceLists.inclTax") : t("priceLists.exclTax")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add product row */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t("priceLists.searchProducts")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex items-center gap-1">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={t("priceLists.selectProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.slice(0, 50).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAddProduct} disabled={!selectedProductId || adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkOpen(!bulkOpen)}
            >
              <PackagePlus className="mr-1 h-4 w-4" /> {t("priceLists.addAll")}
            </Button>
          </div>

          {/* Bulk add panel */}
          {bulkOpen && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm">{t("priceLists.bulkPercentLabel")}:</span>
              <Input
                type="number"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                className="w-24"
                step="0.01"
              />
              <span className="text-sm text-slate-500">%</span>
              <Button size="sm" onClick={handleBulkAdd} disabled={bulkLoading}>
                {bulkLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t("priceLists.addAll")}
              </Button>
            </div>
          )}

          {/* Items table */}
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-500">
              {items.length === 0 ? t("priceLists.noItems") : t("priceLists.noMatchingItems")}
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("priceLists.product")}</TableHead>
                    <TableHead>{t("priceLists.basePrice")}</TableHead>
                    <TableHead>{t("priceLists.overrideType")}</TableHead>
                    <TableHead>{t("priceLists.value")}</TableHead>
                    <TableHead>{t("priceLists.effectivePrice")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
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
                        <Select
                          value={item.overrideType}
                          onValueChange={(v) => {
                            const base = item.product.price;
                            if (v === "FIXED") {
                              handleUpdateItem(item, { overrideType: "FIXED", fixedPrice: base });
                            } else {
                              handleUpdateItem(item, { overrideType: "PERCENTAGE", percentOffset: 0 });
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FIXED">{t("priceLists.fixed")}</SelectItem>
                            <SelectItem value="PERCENTAGE">{t("priceLists.percentage")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {item.overrideType === "FIXED" ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 w-28 text-sm"
                            defaultValue={item.fixedPrice ?? ""}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val !== item.fixedPrice) {
                                handleUpdateItem(item, { fixedPrice: val });
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 w-20 text-sm"
                              defaultValue={item.percentOffset ?? ""}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== item.percentOffset) {
                                  handleUpdateItem(item, { percentOffset: val });
                                }
                              }}
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {currencySymbol}{effectivePrice(item).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
