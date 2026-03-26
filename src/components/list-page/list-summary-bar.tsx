"use client";

import { cn } from "@/lib/utils";

interface SummaryItem {
  label: string;
  value: string;
  color?: "default" | "success" | "danger" | "warning";
}

interface ListSummaryBarProps {
  stats: SummaryItem[];
  className?: string;
}

const colorClasses = {
  default: "text-slate-900",
  success: "text-emerald-600",
  danger: "text-red-600",
  warning: "text-amber-600",
};

export function ListSummaryBar({ stats, className }: ListSummaryBarProps) {
  if (stats.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3",
        className
      )}
    >
      {stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-500">{stat.label}:</span>
          <span className={cn("font-semibold tabular-nums", colorClasses[stat.color || "default"])}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
