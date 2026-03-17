"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { useLanguage } from "@/lib/i18n";

interface Customer {
  id: string;
  name: string;
  email: string | null;
}

interface CustomerComboboxProps {
  customers: Customer[];
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  onSelect?: () => void;
  onSelectFocusNext?: (triggerRef: React.RefObject<HTMLButtonElement | null>) => void;
  onCustomerCreated?: (customer: Customer) => void;
  autoFocus?: boolean;
}

export function CustomerCombobox({
  customers,
  value,
  onValueChange,
  required = false,
  onSelect,
  onSelectFocusNext,
  onCustomerCreated,
  autoFocus = false,
}: CustomerComboboxProps) {
  const { t } = useLanguage();
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [localCustomer, setLocalCustomer] = useState<Customer | null>(null);

  const handleCustomerCreated = (newCustomer: Customer) => {
    setLocalCustomer(newCustomer);
    // Auto-select the newly created customer
    onValueChange(newCustomer.id);
    if (onCustomerCreated) {
      onCustomerCreated(newCustomer);
    }
  };

  const combinedCustomers = localCustomer
    ? [...customers.filter(c => c.id !== localCustomer.id), localCustomer]
    : customers;

  return (
    <div className="flex items-center gap-2 w-full relative">
      <div className="flex-1">
        <Combobox
          items={combinedCustomers}
          value={value}
          onValueChange={onValueChange}
          getId={(customer) => customer.id}
          getLabel={(customer) => customer.name}
          filterFn={(customer, query) =>
            customer.name.toLowerCase().includes(query) ||
            (customer.email?.toLowerCase().includes(query) ?? false)
          }
          renderItem={(customer) => (
            <div className="flex flex-col">
              <div className="font-medium">{customer.name}</div>
              {customer.email && (
                <div className="text-sm text-slate-500">{customer.email}</div>
              )}
            </div>
          )}
          placeholder={t("customers.searchCustomers")}
          emptyText={t("customers.noCustomers")}
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
        onClick={() => setIsCustomerDialogOpen(true)}
        title={t("customers.addCustomer")}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <CustomerFormDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onSuccess={handleCustomerCreated}
      />
    </div>
  );
}
