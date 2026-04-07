"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { CashFlowMonth } from "@/hooks/use-dashboard-charts";
import { ChartCard } from "./chart-card";

interface CashFlowChartProps {
  data: CashFlowMonth[] | undefined;
  totalIncoming: number;
  totalOutgoing: number;
  isLoading: boolean;
  period: string;
  onPeriodChange: (value: string) => void;
}

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMonth(monthStr: string) {
  const [, m] = monthStr.split("-");
  return MONTH_SHORT[parseInt(m, 10) - 1] || monthStr;
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

export function CashFlowChart({
  data,
  totalIncoming,
  totalOutgoing,
  isLoading,
  period,
  onPeriodChange,
}: CashFlowChartProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const chartData = (data || []).map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <ChartCard
      title={t("dashboard.cashFlow")}
      isLoading={isLoading}
      period={period}
      onPeriodChange={onPeriodChange}
    >
      <div className="space-y-4">
        {/* Summary row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">{t("dashboard.incoming")}</span>{" "}
            <span className="font-semibold text-emerald-600">{fmt(totalIncoming)}</span>
            <span className="mx-1.5 text-slate-400">(+)</span>
          </div>
          <div>
            <span className="text-slate-500">{t("dashboard.outgoing")}</span>{" "}
            <span className="font-semibold text-red-500">{fmt(totalOutgoing)}</span>
            <span className="mx-1.5 text-slate-400">(-)</span>
          </div>
          <div>
            <span className="text-slate-500">{t("dashboard.netCashFlow")}</span>{" "}
            <span
              className={`font-semibold ${totalIncoming - totalOutgoing >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {fmt(totalIncoming - totalOutgoing)}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashFlowIncoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(161 76% 39%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(161 76% 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cashFlowOutgoing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(344 83% 60%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(344 83% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCompact}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 4px 20px -2px rgba(0,0,0,0.08)",
                  fontSize: "13px",
                }}
                formatter={(value, name) => [
                  fmt(Number(value)),
                  name === "incoming" ? t("dashboard.incoming") : t("dashboard.outgoing"),
                ]}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="incoming"
                stroke="hsl(161 76% 39%)"
                strokeWidth={2}
                fill="url(#cashFlowIncoming)"
              />
              <Area
                type="monotone"
                dataKey="outgoing"
                stroke="hsl(344 83% 60%)"
                strokeWidth={2}
                fill="url(#cashFlowOutgoing)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}
