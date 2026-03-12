"use client";

import { useMemo, useState } from "react";
import { Loader2, UserCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const openSelector = () => {
    setIsOpen(true);

    if (customersLoaded || isLoading) {
      return;
    }

    setIsLoading(true);
    fetch("/api/customers?compact=true")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data);
        setCustomersLoaded(true);
      })
      .catch(() => { })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const filtered = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(search.toLowerCase()) ||
          (customer.phone && customer.phone.includes(search))
      ),
    [customers, search]
  );

  if (!isOpen) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={openSelector}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openSelector(); }}
        className="flex w-full items-center gap-2 rounded-lg border bg-white p-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <span className={selectedCustomer ? "font-medium" : "text-muted-foreground"}>
          {selectedCustomer ? selectedCustomer.name : t("pos.walkInCustomerDefault").split(" (")[0]}
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
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="p-2">
        <Input
          placeholder={t("pos.searchCustomers")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="h-8 text-sm"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("common.loading")}</span>
          </div>
        ) : null}
        <button
          onClick={() => {
            onSelect(null);
            setIsOpen(false);
          }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-muted-foreground"
        >
          {t("pos.walkInCustomerDefault")}
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
        {!isLoading && filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">
            {t("common.noResultsFound")}
          </div>
        ) : null}
      </div>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setIsOpen(false)}
        >
          {t("pos.cancel")}
        </Button>
      </div>
    </div>
  );
}
