"use client";

import { useLanguage } from "@/lib/i18n";

interface FilterOption {
  value: string;
  label: string;
}

interface ListFiltersProps {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusOptions: FilterOption[];
  className?: string;
}

export function ListFilters({
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  className,
}: ListFiltersProps) {
  const { t } = useLanguage();

  return (
    <div className={className}>
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
