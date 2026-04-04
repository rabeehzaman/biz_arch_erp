"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

interface Product {
  id: string;
  name: string;
  price: number;
  unitId?: string | null;
  unit?: { id: string; name: string; code: string } | null;
  sku?: string;
  barcode?: string;
  isService?: boolean;
  availableStock?: number;
  unitConversions?: { unitId: string; unit?: { name: string; code?: string }; conversionFactor: number | { toString(): string }; price?: number | { toString(): string } | null; isDefaultUnit?: boolean }[];
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  onSelect?: () => void;
  onSelectFocusNext?: (triggerRef: React.RefObject<HTMLButtonElement | null>) => void;
  onProductCreated?: (product: Product) => void;
}

export function ProductCombobox({
  products,
  value,
  onValueChange,
  required = false,
  onSelect,
  onSelectFocusNext,
  onProductCreated,
}: ProductComboboxProps) {
  const { t } = useLanguage();
  const { symbol, locale } = useCurrency();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [localProduct, setLocalProduct] = useState<Product | null>(null);

  const handleProductCreated = (newProduct: any) => {
    setLocalProduct(newProduct);
    // We get a raw Product back, it might not match exact Product definition for Combobox perfectly
    // if `unit` expects a string but API returns an object.
    // Let's assume onProductCreated handles refetching the perfectly shaped product list
    onValueChange(newProduct.id);
    if (onProductCreated) {
      onProductCreated(newProduct);
    }
  };

  const combinedProducts = localProduct
    ? [...products.filter(p => p.id !== localProduct.id), localProduct]
    : products;

  return (
    <div className="flex items-center gap-2 w-full relative">
      <div className="flex-1">
        <Combobox
          items={combinedProducts}
          value={value}
          onValueChange={onValueChange}
          getId={(product) => product.id}
          getLabel={(product) => product.name}
          filterFn={(product, query) => {
            const lowerQuery = query.toLowerCase();
            return (
              product.name.toLowerCase().includes(lowerQuery) ||
              (product.sku?.toLowerCase().includes(lowerQuery) ?? false) ||
              (product.barcode?.toLowerCase().includes(lowerQuery) ?? false)
            );
          }}
          renderItem={(product) => {
            const baseStock = product.availableStock ?? 0;
            const defaultUc = product.unitConversions?.find((uc) => uc.isDefaultUnit);
            const factor = defaultUc ? Number(defaultUc.conversionFactor) : 1;
            const displayPrice = defaultUc
              ? (defaultUc.price != null ? Number(defaultUc.price) : Number(product.price) * factor)
              : Number(product.price);
            const displayStock = factor > 1 ? Math.floor(baseStock / factor) : baseStock;
            const isOutOfStock = !product.isService && baseStock === 0;
            const isLowStock = !product.isService && baseStock > 0 && displayStock <= 5;
            const unitLabel = defaultUc?.unit?.name || defaultUc?.unit?.code || "";

            return (
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{product.name}</span>
                  {isOutOfStock && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                      {t("products.outOfStock2")}
                    </span>
                  )}
                  {isLowStock && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">
                      {t("products.lowStock2")}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {product.sku && <span>{t("products.skuPrefix")} {product.sku} | </span>}
                  {symbol}{displayPrice.toLocaleString(locale)}
                  {unitLabel && <span className="text-xs text-slate-400">/{unitLabel}</span>}
                  {product.isService ? (
                    <span className="ml-2 text-blue-600">{t("products.service")}</span>
                  ) : (
                    <span className="ml-2">
                      {t("products.stockLabel")} <span className={isOutOfStock ? "text-red-600 font-medium" : isLowStock ? "text-yellow-600 font-medium" : ""}>{displayStock}{unitLabel ? ` ${unitLabel}` : ""}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          }}
          placeholder={t("products.searchPlaceholder")}
          emptyText={t("products.noProductsFound")}
          required={required}
          onSelect={onSelect}
          onSelectFocusNext={onSelectFocusNext}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsProductDialogOpen(true)}
        title={t("products.addProduct")}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <ProductFormDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        onSuccess={handleProductCreated}
      />
    </div>
  );
}
