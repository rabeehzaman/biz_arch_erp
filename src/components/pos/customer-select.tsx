"use client";

import { useState, useEffect } from "react";
import { UserCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface CustomerSelectProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
}

export function CustomerSelect({
  selectedCustomer,
  onSelect,
}: CustomerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/customers")
        .then((res) => res.json())
        .then((data) => setCustomers(data))
        .catch(() => {});
    }
  }, [isOpen]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  if (!isOpen) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsOpen(true); }}
        className="flex w-full items-center gap-2 rounded-lg border bg-white p-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <span className={selectedCustomer ? "font-medium" : "text-muted-foreground"}>
          {selectedCustomer ? selectedCustomer.name : "Walk-in Customer"}
        </span>
        {selectedCustomer && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-lg">
      <div className="p-2">
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="h-8 text-sm"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        <button
          onClick={() => {
            onSelect(null);
            setIsOpen(false);
          }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-muted-foreground"
        >
          Walk-in Customer (default)
        </button>
        {filtered.map((customer) => (
          <button
            key={customer.id}
            onClick={() => {
              onSelect(customer);
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex justify-between"
          >
            <span className="font-medium">{customer.name}</span>
            {customer.phone && (
              <span className="text-muted-foreground">{customer.phone}</span>
            )}
          </button>
        ))}
      </div>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setIsOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
