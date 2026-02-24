"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";

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
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);

  const handleCustomerCreated = (newCustomer: Customer) => {
    // Auto-select the newly created customer
    onValueChange(newCustomer.id);
    if (onCustomerCreated) {
      onCustomerCreated(newCustomer);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full relative">
      <div className="flex-1">
        <Combobox
          items={customers}
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
          placeholder="Search customers..."
          emptyText="No customers found. Click + to add one."
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
        title="Add new customer"
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
