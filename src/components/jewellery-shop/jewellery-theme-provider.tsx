"use client";

import { useEffect } from "react";
import { getJewelleryThemeVars } from "@/lib/jewellery/theme";

interface JewelleryThemeProviderProps {
  enabled: boolean;
  preset: string | null;
  customColor: string | null;
  children: React.ReactNode;
}

export function JewelleryThemeProvider({ enabled, preset, customColor, children }: JewelleryThemeProviderProps) {
  useEffect(() => {
    if (!enabled) return;

    const vars = getJewelleryThemeVars(preset, customColor);
    const root = document.documentElement;

    // Store originals to restore on unmount
    const originals: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      originals[key] = root.style.getPropertyValue(key);
      root.style.setProperty(key, value);
    }

    return () => {
      for (const [key] of Object.entries(vars)) {
        if (originals[key]) {
          root.style.setProperty(key, originals[key]);
        } else {
          root.style.removeProperty(key);
        }
      }
    };
  }, [enabled, preset, customColor]);

  return <>{children}</>;
}
