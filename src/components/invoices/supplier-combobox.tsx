"use client";

import { useState } from "react";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [isLoadingSupplier, setIsLoadingSupplier] = useState(false);

  const handleEditSupplier = async () => {
    if (!value) return;
    setIsLoadingSupplier(true);
    try {
      const response = await fetch(`/api/suppliers/${value}`);
      if (!response.ok) throw new Error("Failed to fetch supplier");
      const supplier = await response.json();
      setEditSupplier(supplier);
      setIsEditDialogOpen(true);
    } catch {
      // silently fail
    } finally {
      setIsLoadingSupplier(false);
    }
  };

  const handleSupplierEdited = (updatedSupplier: Supplier) => {
    onValueChange(updatedSupplier.id);
    if (onSupplierCreated) {
      onSupplierCreated(updatedSupplier);
    }
  };

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
          placeholder={t("suppliers.searchPlaceholder")}
          emptyText={t("suppliers.noSuppliersFound")}
          required={required}
          onSelect={onSelect}
          onSelectFocusNext={onSelectFocusNext}
          autoFocus={autoFocus}
        />
      </div>
      {value && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleEditSupplier}
          disabled={isLoadingSupplier}
          title={t("suppliers.editSupplier")}
        >
          {isLoadingSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsSupplierDialogOpen(true)}
        title={t("suppliers.addSupplier")}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <SupplierFormDialog
        open={isSupplierDialogOpen}
        onOpenChange={setIsSupplierDialogOpen}
        onSuccess={handleSupplierCreated}
      />

      <SupplierFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleSupplierEdited}
        supplierToEdit={editSupplier}
      />
    </div>
  );
}
