"use client";

import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { ReceivablesPayables } from "@/hooks/use-dashboard-charts";
import { ChartCard } from "./chart-card";

interface ReceivablesPayablesBarProps {
  title: string;
  subtitle: string;
  data: ReceivablesPayables | undefined;
  isLoading: boolean;
  colorCurrent: string;
  colorOverdue: string;
}

export function ReceivablesPayablesBar({
  title,
  subtitle,
  data,
  isLoading,
  colorCurrent,
  colorOverdue,
}: ReceivablesPayablesBarProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const total = data?.total || 0;
  const current = data?.current || 0;
  const overdue = data?.overdue || 0;
  const currentPct = total > 0 ? (current / total) * 100 : 0;
  const overduePct = total > 0 ? (overdue / total) * 100 : 100;

  return (
    <ChartCard title={title} isLoading={isLoading}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {fmt(total)}
          </p>
        </div>

        {/* Stacked horizontal bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {total > 0 && (
            <div className="flex h-full">
              {current > 0 && (
                <div
                  className="h-full rounded-l-full transition-all duration-500"
                  style={{
                    width: `${Math.max(currentPct, 2)}%`,
                    backgroundColor: colorCurrent,
                  }}
                />
              )}
              {overdue > 0 && (
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.max(overduePct, 2)}%`,
                    backgroundColor: colorOverdue,
                    borderRadius: current === 0 ? "9999px" : "0 9999px 9999px 0",
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorCurrent }}
            />
            <span className="text-slate-600">
              {t("dashboard.current")}:{" "}
              <span className="font-semibold text-slate-900">{fmt(current)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorOverdue }}
            />
            <span className="text-slate-600">
              {t("dashboard.overdue")}:{" "}
              <span className="font-semibold text-slate-900">{fmt(overdue)}</span>
            </span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
