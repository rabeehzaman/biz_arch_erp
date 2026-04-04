"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type UIEvent } from "react";
import { ProductTile, type ProductTileProduct } from "./product-tile";
import { ProductListItem } from "./product-list-item";
import { PackageX } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: ProductTileProduct[];
  isLoading?: boolean;
  searchQuery: string;
  selectedCategory: string | null;
  selectedQuantities: Record<string, number>;
  selectionRevision: number;
  onAddToCart: (product: ProductTileProduct) => void;
  viewMode?: "grid" | "list";
}

export function ProductGrid({
  products,
  isLoading = false,
  searchQuery,
  selectedCategory,
  selectedQuantities,
  selectionRevision,
  onAddToCart,
  viewMode = "grid",
}: ProductGridProps) {
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef(0);
  const previousSelectionRevisionRef = useRef(selectionRevision);
  const previousViewModeRef = useRef(viewMode);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearchQuery ||
        product.name.toLowerCase().includes(normalizedSearchQuery) ||
        (product.sku && product.sku.toLowerCase().includes(normalizedSearchQuery));
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, normalizedSearchQuery, selectedCategory]);

  useLayoutEffect(() => {
    if (previousSelectionRevisionRef.current === selectionRevision) {
      return;
    }

    previousSelectionRevisionRef.current = selectionRevision;

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextScrollTop = Math.min(savedScrollTopRef.current, maxScrollTop);
    container.scrollTop = nextScrollTop;
    savedScrollTopRef.current = nextScrollTop;
  }, [selectionRevision]);

  // Reset scroll when view mode changes
  useEffect(() => {
    if (previousViewModeRef.current !== viewMode) {
      previousViewModeRef.current = viewMode;
      savedScrollTopRef.current = 0;
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = 0;
      }
    }
  }, [viewMode]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    savedScrollTopRef.current = event.currentTarget.scrollTop;
  };

  if (isLoading) {
    if (viewMode === "list") {
      return (
        <div
          data-testid="pos-product-grid"
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex flex-1 flex-col divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white"
        >
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`list-skeleton-${index}`} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        data-testid="pos-product-grid"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto content-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={`product-skeleton-${index}`}
            className="flex h-[120px] flex-col items-center justify-center rounded-xl bg-slate-100 p-3"
          >
            <Skeleton className="mb-2 h-4 w-16 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground">
        <PackageX className="mb-3 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">{t("pos.noProductsFound")}</p>
        <p className="text-sm">
          {normalizedSearchQuery ? t("pos.tryAdjustingSearch") : t("pos.addProducts")}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="pos-product-grid"
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className={cn(
        "flex-1 overflow-y-auto",
        viewMode === "grid"
          ? "grid grid-cols-2 gap-3 content-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          : "flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white content-start"
      )}
    >
      {filtered.map((product) =>
        viewMode === "grid" ? (
          <ProductTile
            key={product.id}
            product={product}
            selectedQuantity={selectedQuantities[product.id] ?? 0}
            onAdd={onAddToCart}
          />
        ) : (
          <ProductListItem
            key={product.id}
            product={product}
            selectedQuantity={selectedQuantities[product.id] ?? 0}
            onAdd={onAddToCart}
          />
        )
      )}
    </div>
  );
}
