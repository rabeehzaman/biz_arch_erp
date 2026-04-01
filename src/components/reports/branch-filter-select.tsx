"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";

interface BranchFilterSelectProps {
  branches: { id: string; name: string; code: string }[];
  filterBranchId: string;
  onBranchChange: (branchId: string) => void;
  multiBranchEnabled: boolean;
}

export function BranchFilterSelect({
  branches,
  filterBranchId,
  onBranchChange,
  multiBranchEnabled,
}: BranchFilterSelectProps) {
  const { t } = useLanguage();

  if (!multiBranchEnabled || branches.length === 0) return null;

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-slate-500">{t("reports.branch")}</Label>
      <Select value={filterBranchId} onValueChange={onBranchChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder={t("reports.allBranches")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("reports.allBranches")}</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
