"use client";

import { Combobox } from "@/components/ui/combobox";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface SupplierComboboxProps {
  suppliers: Supplier[];
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  onSelect?: () => void;
  onSelectFocusNext?: (triggerRef: React.RefObject<HTMLButtonElement | null>) => void;
  autoFocus?: boolean;
}

export function SupplierCombobox({
  suppliers,
  value,
  onValueChange,
  required = false,
  onSelect,
  onSelectFocusNext,
  autoFocus = false,
}: SupplierComboboxProps) {
  return (
    <Combobox
      items={suppliers}
      value={value}
      onValueChange={onValueChange}
      getId={(supplier) => supplier.id}
      getLabel={(supplier) => supplier.name}
      filterFn={(supplier, query) =>
        supplier.name.toLowerCase().includes(query) ||
        (supplier.email?.toLowerCase().includes(query) ?? false)
      }
      renderItem={(supplier) => (
        <div className="flex flex-col">
          <div className="font-medium">{supplier.name}</div>
          {supplier.email && (
            <div className="text-sm text-slate-500">{supplier.email}</div>
          )}
        </div>
      )}
      placeholder="Search suppliers..."
      emptyText="No suppliers found."
      required={required}
      onSelect={onSelect}
      onSelectFocusNext={onSelectFocusNext}
      autoFocus={autoFocus}
    />
  );
}
