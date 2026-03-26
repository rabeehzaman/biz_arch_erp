"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";

interface PeriodOption {
  value: string;
  label: string;
}

interface ChartCardProps {
  title: string;
  isLoading?: boolean;
  children: React.ReactNode;
  period?: string;
  onPeriodChange?: (value: string) => void;
  periodOptions?: PeriodOption[];
  action?: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  isLoading,
  children,
  period,
  onPeriodChange,
  periodOptions,
  action,
  className,
}: ChartCardProps) {
  const { t } = useLanguage();

  const defaultPeriodOptions: PeriodOption[] = [
    { value: "thisMonth", label: t("dashboard.thisMonth") },
    { value: "thisQuarter", label: t("dashboard.thisQuarter") },
    { value: "thisYear", label: t("dashboard.thisYear") },
  ];

  const options = periodOptions || defaultPeriodOptions;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold text-slate-900">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {action}
            {onPeriodChange && (
              <select
                value={period}
                onChange={(e) => onPeriodChange(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/30"
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-28 mb-3" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}
