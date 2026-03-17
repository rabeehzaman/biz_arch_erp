"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";

interface DateRangePresetSelectorProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

function getPresetDates(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "thisMonth":
      return { from: fmt(new Date(year, month, 1)), to: fmt(now) };
    case "thisQuarter": {
      const qStart = Math.floor(month / 3) * 3;
      return { from: fmt(new Date(year, qStart, 1)), to: fmt(now) };
    }
    case "thisYear":
      return { from: fmt(new Date(year, 0, 1)), to: fmt(now) };
    case "previousMonth":
      return {
        from: fmt(new Date(year, month - 1, 1)),
        to: fmt(new Date(year, month, 0)),
      };
    case "previousQuarter": {
      const pqStart = Math.floor(month / 3) * 3 - 3;
      return {
        from: fmt(new Date(year, pqStart, 1)),
        to: fmt(new Date(year, pqStart + 3, 0)),
      };
    }
    case "previousYear":
      return {
        from: fmt(new Date(year - 1, 0, 1)),
        to: fmt(new Date(year - 1, 11, 31)),
      };
    case "last30Days": {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      return { from: fmt(d30), to: fmt(now) };
    }
    case "last90Days": {
      const d90 = new Date(now);
      d90.setDate(d90.getDate() - 90);
      return { from: fmt(d90), to: fmt(now) };
    }
    default:
      return null;
  }
}

export function DateRangePresetSelector({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onGenerate,
  isLoading,
}: DateRangePresetSelectorProps) {
  const { t } = useLanguage();

  const handlePresetChange = (preset: string) => {
    const dates = getPresetDates(preset);
    if (dates) {
      onFromDateChange(dates.from);
      onToDateChange(dates.to);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
      <div className="grid gap-2">
        <Label className="text-xs text-slate-500">{t("reports.dateRange")}</Label>
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t("reports.custom")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thisMonth">{t("reports.thisMonth")}</SelectItem>
            <SelectItem value="thisQuarter">{t("reports.thisQuarter")}</SelectItem>
            <SelectItem value="thisYear">{t("reports.thisYear")}</SelectItem>
            <SelectItem value="previousMonth">{t("reports.previousMonth")}</SelectItem>
            <SelectItem value="previousQuarter">{t("reports.previousQuarter")}</SelectItem>
            <SelectItem value="previousYear">{t("reports.previousYear")}</SelectItem>
            <SelectItem value="last30Days">{t("reports.last30Days")}</SelectItem>
            <SelectItem value="last90Days">{t("reports.last90Days")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-slate-500">{t("reports.fromDate")}</Label>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-slate-500">{t("reports.toDate")}</Label>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
        />
      </div>
      <Button onClick={onGenerate} disabled={isLoading}>
        {t("reports.generate")}
      </Button>
    </div>
  );
}
