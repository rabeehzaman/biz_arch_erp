"use client";

import { LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

interface ViewModeToggleProps {
  viewMode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
}

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  const { t } = useLanguage();

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0"
      onClick={() => onChange(viewMode === "grid" ? "list" : "grid")}
      aria-label={viewMode === "grid" ? t("pos.listView") : t("pos.gridView")}
    >
      {viewMode === "grid" ? (
        <LayoutList className="h-4 w-4" />
      ) : (
        <LayoutGrid className="h-4 w-4" />
      )}
    </Button>
  );
}
