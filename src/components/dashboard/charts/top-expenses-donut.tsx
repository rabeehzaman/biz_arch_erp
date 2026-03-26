"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { TopExpense } from "@/hooks/use-dashboard-charts";
import { ChartCard } from "./chart-card";

interface TopExpensesDonutProps {
  data: TopExpense[] | undefined;
  isLoading: boolean;
  period: string;
  onPeriodChange: (value: string) => void;
}

const COLORS = [
  "hsl(198 92% 53%)",  // chart-1
  "hsl(161 76% 39%)",  // chart-2
  "hsl(39 96% 56%)",   // chart-3
  "hsl(215 88% 56%)",  // chart-4
  "hsl(344 83% 60%)",  // chart-5
];

export function TopExpensesDonut({
  data,
  isLoading,
  period,
  onPeriodChange,
}: TopExpensesDonutProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const expenses = data || [];
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <ChartCard
      title={t("dashboard.topExpenses")}
      isLoading={isLoading}
      period={period}
      onPeriodChange={onPeriodChange}
    >
      {expenses.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">
          {t("dashboard.noExpensesYet")}
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Donut chart */}
          <div className="relative mx-auto h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenses}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {expenses.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 20px -2px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                  }}
                  formatter={(value) => [fmt(Number(value))]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] font-medium text-slate-500">{t("dashboard.total")}</p>
              <p className="text-sm font-bold text-slate-900">{fmt(totalExpenses)}</p>
            </div>
          </div>

          {/* Legend list */}
          <div className="flex-1 space-y-2.5">
            {expenses.map((expense, index) => (
              <div
                key={expense.category}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-slate-700">{expense.category}</span>
                </div>
                <span className="shrink-0 font-semibold text-slate-900 tabular-nums">
                  {fmt(expense.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
