"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";

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
  onSupplierCreated?: (supplier: Supplier) => void;
  autoFocus?: boolean;
}

export function SupplierCombobox({
  suppliers,
  value,
  onValueChange,
  required = false,
  onSelect,
  onSelectFocusNext,
  onSupplierCreated,
  autoFocus = false,
}: SupplierComboboxProps) {
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);

  const handleSupplierCreated = (newSupplier: Supplier) => {
    // Auto-select the newly created supplier
    onValueChange(newSupplier.id);
    if (onSupplierCreated) {
      onSupplierCreated(newSupplier);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full relative">
      <div className="flex-1">
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
          emptyText="No suppliers found. Click + to add one."
          required={required}
          onSelect={onSelect}
          onSelectFocusNext={onSelectFocusNext}
          autoFocus={autoFocus}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsSupplierDialogOpen(true)}
        title="Add new supplier"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <SupplierFormDialog
        open={isSupplierDialogOpen}
        onOpenChange={setIsSupplierDialogOpen}
        onSuccess={handleSupplierCreated}
      />
    </div>
  );
}
