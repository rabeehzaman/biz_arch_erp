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
import { localDateStr } from "@/lib/date-utils";

interface AsOfDateSelectorProps {
  asOfDate: string;
  onDateChange: (date: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

function getPresetDate(preset: string): string | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const fmt = localDateStr;

  switch (preset) {
    case "today":
      return fmt(now);
    case "endOfLastMonth":
      return fmt(new Date(year, month, 0));
    case "endOfLastQuarter": {
      const qStart = Math.floor(month / 3) * 3;
      return fmt(new Date(year, qStart, 0));
    }
    case "endOfLastYear":
      return fmt(new Date(year - 1, 11, 31));
    default:
      return null;
  }
}

export function AsOfDateSelector({
  asOfDate,
  onDateChange,
  onGenerate,
  isLoading,
}: AsOfDateSelectorProps) {
  const { t } = useLanguage();

  const handlePresetChange = (preset: string) => {
    const date = getPresetDate(preset);
    if (date) {
      onDateChange(date);
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
            <SelectItem value="today">{t("reports.today")}</SelectItem>
            <SelectItem value="endOfLastMonth">{t("reports.endOfLastMonth")}</SelectItem>
            <SelectItem value="endOfLastQuarter">{t("reports.endOfLastQuarter")}</SelectItem>
            <SelectItem value="endOfLastYear">{t("reports.endOfLastYear")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-slate-500">{t("reports.asOfDate")}</Label>
        <Input
          type="date"
          value={asOfDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      <Button onClick={onGenerate} disabled={isLoading}>
        {t("reports.generate")}
      </Button>
    </div>
  );
}
