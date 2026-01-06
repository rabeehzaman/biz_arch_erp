"use client";

import { Combobox } from "@/components/ui/combobox";

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  sku?: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
}

export function ProductCombobox({
  products,
  value,
  onValueChange,
  required = false,
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
      renderItem={(product) => (
        <div className="flex flex-col">
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-slate-500">
            {product.sku && <span>SKU: {product.sku} | </span>}
            ₹{Number(product.price).toLocaleString("en-IN")}
          </div>
        </div>
      )}
      placeholder="Search products..."
      emptyText="No products found."
      required={required}
    />
  );
}
