"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ProductFormDialog } from "@/components/products/product-form-dialog";

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  sku?: string;
  barcode?: string;
  isService?: boolean;
  availableStock?: number;
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
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);

  const handleProductCreated = (newProduct: any) => {
    // We get a raw Product back, it might not match exact Product definition for Combobox perfectly
    // if `unit` expects a string but API returns an object.
    // Let's assume onProductCreated handles refetching the perfectly shaped product list
    onValueChange(newProduct.id);
    if (onProductCreated) {
      onProductCreated(newProduct);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full relative">
      <div className="flex-1">
        <Combobox
          items={products}
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
            const stock = product.availableStock ?? 0;
            const isOutOfStock = !product.isService && stock === 0;
            const isLowStock = !product.isService && stock > 0 && stock <= 5;

            return (
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{product.name}</span>
                  {isOutOfStock && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                      Out of stock
                    </span>
                  )}
                  {isLowStock && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">
                      Low stock
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {product.sku && <span>SKU: {product.sku} | </span>}
                  ₹{Number(product.price).toLocaleString("en-IN")}
                  {product.isService ? (
                    <span className="ml-2 text-blue-600">Service</span>
                  ) : (
                    <span className="ml-2">
                      Stock: <span className={isOutOfStock ? "text-red-600 font-medium" : isLowStock ? "text-yellow-600 font-medium" : ""}>{stock}</span> units
                    </span>
                  )}
                </div>
              </div>
            );
          }}
          placeholder="Search products..."
          emptyText="No products found. Click + to add one."
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
        title="Add new product"
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
