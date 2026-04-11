"use client";

import { useState, useCallback, useMemo } from "react";
import type { ColumnDef } from "@/lib/column-configs";

const STORAGE_PREFIX = "columns:";

function getDefaultColumns(columns: ColumnDef[]): string[] {
  return columns.filter((c) => c.required || c.defaultVisible).map((c) => c.key);
}

function loadFromStorage(module: string, columns: ColumnDef[]): string[] {
  if (typeof window === "undefined") return getDefaultColumns(columns);
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${module}`);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      // Validate: ensure required columns are always included
      const required = columns.filter((c) => c.required).map((c) => c.key);
      const valid = parsed.filter((k) => columns.some((c) => c.key === k));
      // Add any required columns that are missing
      for (const rk of required) {
        if (!valid.includes(rk)) valid.unshift(rk);
      }
      return valid.length > 0 ? valid : getDefaultColumns(columns);
    }
  } catch {
    // ignore
  }
  return getDefaultColumns(columns);
}

export function useColumnVisibility(module: string, columnDefs: ColumnDef[]) {
  const [visibleColumns, setVisibleColumnsState] = useState<string[]>(() =>
    loadFromStorage(module, columnDefs)
  );

  const setVisibleColumns = useCallback(
    (cols: string[]) => {
      // Ensure required columns are always present
      const required = columnDefs.filter((c) => c.required).map((c) => c.key);
      const merged = [...new Set([...required, ...cols])];
      setVisibleColumnsState(merged);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${module}`, JSON.stringify(merged));
      } catch {
        // ignore
      }
    },
    [module, columnDefs]
  );

  const isColumnVisible = useCallback(
    (key: string) => visibleColumns.includes(key),
    [visibleColumns]
  );

  const selectedCount = visibleColumns.length;
  const totalCount = columnDefs.length;

  return useMemo(
    () => ({
      visibleColumns,
      setVisibleColumns,
      isColumnVisible,
      selectedCount,
      totalCount,
    }),
    [visibleColumns, setVisibleColumns, isColumnVisible, selectedCount, totalCount]
  );
}
