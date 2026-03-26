"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { IncomeExpenseMonth } from "@/hooks/use-dashboard-charts";
import { ChartCard } from "./chart-card";

interface IncomeExpenseChartProps {
  data: IncomeExpenseMonth[] | undefined;
  totalIncome: number;
  totalExpense: number;
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

export function IncomeExpenseChart({
  data,
  totalIncome,
  totalExpense,
  isLoading,
  period,
  onPeriodChange,
}: IncomeExpenseChartProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const chartData = (data || []).map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <ChartCard
      title={t("dashboard.incomeAndExpense")}
      isLoading={isLoading}
      period={period}
      onPeriodChange={onPeriodChange}
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">{t("dashboard.totalIncome")}</span>{" "}
            <span className="font-semibold text-emerald-600">{fmt(totalIncome)}</span>
          </div>
          <div>
            <span className="text-slate-500">{t("dashboard.totalExpenseAmount")}</span>{" "}
            <span className="font-semibold text-amber-600">{fmt(totalExpense)}</span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                  name === "income" ? t("dashboard.income") : t("dashboard.expense"),
                ]}
                labelFormatter={(label) => label}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", color: "#64748b" }}
                formatter={(value) =>
                  value === "income" ? t("dashboard.income") : t("dashboard.expense")
                }
              />
              <Bar
                dataKey="income"
                fill="hsl(161 76% 39%)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="expense"
                fill="hsl(39 96% 56%)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}
