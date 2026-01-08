"use client";

import { Combobox } from "@/components/ui/combobox";

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
}

export function CustomerCombobox({
  customers,
  value,
  onValueChange,
  required = false,
  onSelect,
}: CustomerComboboxProps) {
  return (
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
      emptyText="No customers found."
      required={required}
      onSelect={onSelect}
    />
  );
}
