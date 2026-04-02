"use client";

import { useState, Fragment } from "react";
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
import { Trash2, PackagePlus, Loader2, Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { ProductCombobox } from "@/components/invoices/product-combobox";

export interface PriceListLineItem {
  id: string;
  productId: string;
  overrideType: "FIXED" | "PERCENTAGE";
  fixedPrice: number | null;
  percentOffset: number | null;
  isNew: boolean;
  isDeleted: boolean;
  product?: { id: string; name: string; sku?: string | null; price: number };
}

interface CompactProduct {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  barcode?: string;
}

interface Props {
  lineItems: PriceListLineItem[];
  products: CompactProduct[];
  currencySymbol: string;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: string, value: string | number | null) => void;
  onProductSelect: (itemId: string, productId: string) => void;
  onBulkAdd: (percentOffset: number) => void;
  onRemoveAll: () => void;
  focusNextFocusable: (el: HTMLElement | React.RefObject<HTMLElement | null> | null) => void;
  bulkLoading?: boolean;
}

export function PriceListLineItems({
  lineItems,
  products,
  currencySymbol,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onProductSelect,
  onBulkAdd,
  onRemoveAll,
  focusNextFocusable,
  bulkLoading,
}: Props) {
  const { t } = useLanguage();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState("-10");
  const [search, setSearch] = useState("");

  const visibleItems = lineItems.filter((item) => !item.isDeleted);
  const selectedProductIds = new Set(visibleItems.filter((i) => i.productId).map((i) => i.productId));

  const filteredItems = search
    ? visibleItems.filter((item) => {
        if (!item.product) return !item.productId;
        return item.product.name.toLowerCase().includes(search.toLowerCase());
      })
    : visibleItems;

  const availableProducts = products.filter((p) => !selectedProductIds.has(p.id));

  const effectivePrice = (item: PriceListLineItem) => {
    const base = item.product?.price ?? 0;
    if (item.overrideType === "FIXED" && item.fixedPrice !== null) return item.fixedPrice;
    if (item.overrideType === "PERCENTAGE" && item.percentOffset !== null) {
      return Math.round(base * (1 + item.percentOffset / 100) * 100) / 100;
    }
    return base;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {visibleItems.length > 0 && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t("priceLists.searchProducts")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setBulkOpen(!bulkOpen)}
        >
          <PackagePlus className="mr-1 h-4 w-4" /> {t("priceLists.addAll")}
        </Button>
        {visibleItems.filter((i) => i.productId).length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={onRemoveAll}
          >
            <Trash2 className="mr-1 h-4 w-4" /> {t("priceLists.removeAll")}
          </Button>
        )}
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
            step="0.001"
          />
          <span className="text-sm text-slate-500">%</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onBulkAdd(parseFloat(bulkPercent) || 0);
              setBulkOpen(false);
            }}
            disabled={bulkLoading}
          >
            {bulkLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t("priceLists.addAll")}
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block">
        {filteredItems.length === 0 && !visibleItems.some((i) => !i.productId) ? (
          <div className="flex h-24 items-center justify-center text-sm text-slate-500">
            {visibleItems.length === 0 ? t("priceLists.noItems") : t("priceLists.noMatchingItems")}
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead style={{ width: "30%" }}>{t("priceLists.product")} *</TableHead>
                  <TableHead>{t("priceLists.basePrice")}</TableHead>
                  <TableHead>{t("priceLists.overrideType")}</TableHead>
                  <TableHead>{t("priceLists.value")}</TableHead>
                  <TableHead>{t("priceLists.effectivePrice")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => (
                  <Fragment key={item.id}>
                    <TableRow className="group hover:bg-slate-50">
                      <TableCell className="text-center text-xs text-slate-400 border-r border-slate-100">
                        {index + 1}
                      </TableCell>
                      <TableCell className="border-r border-slate-100">
                        <ProductCombobox
                          products={(item.productId ? [...availableProducts, ...(item.product ? [item.product] : [])] : availableProducts).map(p => ({ ...p, sku: p.sku ?? undefined }))}
                          value={item.productId}
                          onValueChange={(value) => onProductSelect(item.id, value)}
                          onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                        />
                      </TableCell>
                      <TableCell className="text-sm border-r border-slate-100">
                        {item.product
                          ? `${currencySymbol}${Number(item.product.price).toLocaleString()}`
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="border-r border-slate-100">
                        {item.productId && (
                          <Select
                            value={item.overrideType}
                            onValueChange={(v) => {
                              onUpdateItem(item.id, "overrideType", v);
                              if (v === "FIXED") {
                                onUpdateItem(item.id, "fixedPrice", item.product?.price ?? 0);
                                onUpdateItem(item.id, "percentOffset", null);
                              } else {
                                onUpdateItem(item.id, "percentOffset", 0);
                                onUpdateItem(item.id, "fixedPrice", null);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px] border-0 bg-transparent text-xs focus-visible:ring-1 hover:bg-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">{t("priceLists.fixed")}</SelectItem>
                              <SelectItem value="PERCENTAGE">{t("priceLists.percentage")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-slate-100">
                        {item.productId && item.overrideType === "FIXED" ? (
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 w-28 border-0 bg-transparent text-sm focus-visible:ring-1 hover:bg-slate-100"
                            value={item.fixedPrice ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                              onUpdateItem(item.id, "fixedPrice", val);
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        ) : item.productId && item.overrideType === "PERCENTAGE" ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.001"
                              className="h-8 w-20 border-0 bg-transparent text-sm focus-visible:ring-1 hover:bg-slate-100"
                              value={item.percentOffset ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                onUpdateItem(item.id, "percentOffset", val);
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium text-sm border-r border-slate-100">
                        {item.productId
                          ? `${currencySymbol}${effectivePrice(item).toLocaleString()}`
                          : "\u2014"}
                      </TableCell>
                      <TableCell>
                        {item.productId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => onRemoveItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {filteredItems.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between">
              <span className="text-xs text-slate-400">#{index + 1}</span>
              {item.productId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500"
                  onClick={() => onRemoveItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <ProductCombobox
              products={(item.productId ? [...availableProducts, ...(item.product ? [item.product] : [])] : availableProducts).map(p => ({ ...p, sku: p.sku ?? undefined }))}
              value={item.productId}
              onValueChange={(value) => onProductSelect(item.id, value)}
              onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
            />
            {item.productId && (
              <>
                <div className="text-xs text-slate-500">
                  {t("priceLists.basePrice")}: {currencySymbol}{Number(item.product?.price ?? 0).toLocaleString()}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">{t("priceLists.overrideType")}</label>
                    <Select
                      value={item.overrideType}
                      onValueChange={(v) => {
                        onUpdateItem(item.id, "overrideType", v);
                        if (v === "FIXED") {
                          onUpdateItem(item.id, "fixedPrice", item.product?.price ?? 0);
                          onUpdateItem(item.id, "percentOffset", null);
                        } else {
                          onUpdateItem(item.id, "percentOffset", 0);
                          onUpdateItem(item.id, "fixedPrice", null);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">{t("priceLists.fixed")}</SelectItem>
                        <SelectItem value="PERCENTAGE">{t("priceLists.percentage")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">{t("priceLists.value")}</label>
                    {item.overrideType === "FIXED" ? (
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="h-9 text-sm"
                        value={item.fixedPrice ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : parseFloat(e.target.value);
                          onUpdateItem(item.id, "fixedPrice", val);
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.001"
                          className="h-9 text-sm"
                          value={item.percentOffset ?? ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            onUpdateItem(item.id, "percentOffset", val);
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-900">
                  {t("priceLists.effectivePrice")}: {currencySymbol}{effectivePrice(item).toLocaleString()}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
