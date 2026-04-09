"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ProductTile, type ProductTileProduct } from "./product-tile";
import { ProductListItem } from "./product-list-item";
import { PackageX } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

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

const GAP = 12; // gap-3 = 12px
const TILE_HEIGHT = 160;
const LIST_ITEM_HEIGHT = 56;

/** Compute column count from container width, matching the CSS breakpoints. */
function getColumnCount(width: number): number {
  if (width >= 1280) return 6; // xl
  if (width >= 1024) return 5; // lg
  if (width >= 768) return 4;  // md
  if (width >= 640) return 3;  // sm
  return 2;                     // default
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

  // Track column count from container width
  const [columnCount, setColumnCount] = useState(4);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || viewMode !== "grid") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setColumnCount(getColumnCount(width));
    });
    observer.observe(container);
    // Set initial value
    setColumnCount(getColumnCount(container.clientWidth));
    return () => observer.disconnect();
  }, [viewMode]);

  const rowCount = viewMode === "grid"
    ? Math.ceil(filtered.length / columnCount)
    : filtered.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => viewMode === "grid" ? TILE_HEIGHT + GAP : LIST_ITEM_HEIGHT,
    overscan: 5,
  });

  // Scroll restoration after cart add (selectionRevision changes)
  useLayoutEffect(() => {
    if (previousSelectionRevisionRef.current === selectionRevision) return;
    previousSelectionRevisionRef.current = selectionRevision;

    const container = scrollContainerRef.current;
    if (!container) return;

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
      virtualizer.scrollToOffset(0);
    }
  }, [viewMode, virtualizer]);

  const handleScroll = useCallback(() => {
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
  }, []);

  if (isLoading) {
    if (viewMode === "list") {
      return (
        <div
          data-testid="pos-product-grid"
          ref={scrollContainerRef}
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
        className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto content-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={`product-skeleton-${index}`}
            className="flex h-[160px] flex-col items-center justify-center rounded-xl bg-slate-100 p-3"
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

  const virtualItems = virtualizer.getVirtualItems();

  if (viewMode === "list") {
    return (
      <div
        data-testid="pos-product-grid"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white"
      >
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualItems.map((virtualRow) => {
            const product = filtered[virtualRow.index];
            if (!product) return null;
            return (
              <div
                key={product.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ProductListItem
                  product={product}
                  selectedQuantity={selectedQuantities[product.id] ?? 0}
                  onAdd={onAddToCart}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid mode
  return (
    <div
      data-testid="pos-product-grid"
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualItems.map((virtualRow) => {
          const startIdx = virtualRow.index * columnCount;
          return (
            <div
              key={virtualRow.index}
              className="grid gap-3"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                height: TILE_HEIGHT,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: columnCount }).map((_, colIdx) => {
                const product = filtered[startIdx + colIdx];
                if (!product) return <div key={`empty-${colIdx}`} />;
                return (
                  <ProductTile
                    key={product.id}
                    product={product}
                    selectedQuantity={selectedQuantities[product.id] ?? 0}
                    onAdd={onAddToCart}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
