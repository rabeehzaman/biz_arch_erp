"use client";

import { Combobox } from "@/components/ui/combobox";

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  sku?: string;
  isService?: boolean;
  availableStock?: number;
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  onSelect?: () => void;
}

export function ProductCombobox({
  products,
  value,
  onValueChange,
  required = false,
  onSelect,
}: ProductComboboxProps) {
  return (
    <Combobox
      items={products}
      value={value}
      onValueChange={onValueChange}
      getId={(product) => product.id}
      getLabel={(product) => product.name}
      filterFn={(product, query) =>
        product.name.toLowerCase().includes(query) ||
        (product.sku?.toLowerCase().includes(query) ?? false)
      }
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
      emptyText="No products found."
      required={required}
      onSelect={onSelect}
    />
  );
}
