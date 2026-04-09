"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { OrgFormConfig } from "@/lib/form-config/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EMPTY_SET = new Set<string>();

/**
 * Standalone hook for POS terminal to get hidden component slugs.
 * Works outside FormConfigProvider by fetching /api/form-config directly.
 */
export function usePosHiddenComponents(enabled: boolean = true) {
  const { data } = useSWR<OrgFormConfig>(
    enabled ? "/api/form-config" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return useMemo(() => {
    const hiddenSet = data?.posHiddenComponents?.length
      ? new Set(data.posHiddenComponents)
      : EMPTY_SET;

    return {
      hiddenComponents: hiddenSet,
      isHidden: (slug: string) => hiddenSet.has(slug),
    };
  }, [data?.posHiddenComponents]);
}
