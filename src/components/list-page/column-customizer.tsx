"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Search, Columns3 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/lib/column-configs";

interface ColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnDef[];
  visibleColumns: string[];
  onSave: (columns: string[]) => void;
}

export function ColumnCustomizer({
  open,
  onOpenChange,
  columns,
  visibleColumns,
  onSave,
}: ColumnCustomizerProps) {
  const { t } = useLanguage();
  const [localVisible, setLocalVisible] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setLocalVisible(new Set(visibleColumns));
      setSearch("");
    }
  }, [open, visibleColumns]);

  const filteredColumns = useMemo(() => {
    if (!search.trim()) return columns;
    const q = search.toLowerCase();
    return columns.filter((c) => {
      const label = t(c.labelKey) || c.key;
      return label.toLowerCase().includes(q);
    });
  }, [columns, search, t]);

  const toggleColumn = (key: string, checked: boolean) => {
    setLocalVisible((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSave = () => {
    // Preserve order: required first, then rest in config order
    const ordered = columns
      .filter((c) => localVisible.has(c.key))
      .map((c) => c.key);
    onSave(ordered);
    onOpenChange(false);
  };

  const selectedCount = localVisible.size;
  const totalCount = columns.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Columns3 className="h-4.5 w-4.5 text-slate-500" />
              <DialogTitle className="text-base">
                {t("views.customizeColumns") || "Customize Columns"}
              </DialogTitle>
            </div>
            <span className="text-sm text-slate-500">
              {selectedCount} of {totalCount} Selected
            </span>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("views.searchColumns") || "Search"}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Column list */}
        <div className="max-h-[400px] overflow-y-auto px-2">
          {filteredColumns.map((col) => {
            const isChecked = localVisible.has(col.key);
            const isRequired = col.required;
            const label = t(col.labelKey) || col.key;

            return (
              <div
                key={col.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors",
                  isRequired
                    ? "opacity-70"
                    : "hover:bg-slate-50 cursor-pointer"
                )}
                onClick={() => {
                  if (!isRequired) toggleColumn(col.key, !isChecked);
                }}
              >
                <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                {isRequired ? (
                  <div className="h-4 w-4 shrink-0" />
                ) : (
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      toggleColumn(col.key, checked === true)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                )}
                <span className="text-sm text-slate-700">{label}</span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="px-5 pb-5 pt-3 border-t border-slate-100">
          <Button onClick={handleSave}>
            {t("common.save")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
