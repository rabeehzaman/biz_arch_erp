"use client";

import { useEffect } from "react";

export function CapacitorBootstrap() {
  useEffect(() => {
    import("@/lib/capacitor-plugins").then(({ initCapacitorPlugins }) => {
      initCapacitorPlugins();
    });
  }, []);

  return null;
}
