"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ROUND_OFF_MODE,
  normalizeRoundOffMode,
  type RoundOffMode,
} from "@/lib/round-off";

export function useRoundOffSettings() {
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>(DEFAULT_ROUND_OFF_MODE);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setRoundOffMode(normalizeRoundOffMode(data.roundOffMode));
        }
      } catch {
        // Keep the default mode when settings cannot be loaded.
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    roundOffMode,
    roundOffEnabled: roundOffMode !== "NONE",
  };
}
