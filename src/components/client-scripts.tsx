"use client";

import { useEffect } from "react";

export function ClientScripts({ standaloneBootstrap }: { standaloneBootstrap: string }) {
  useEffect(() => {
    // Execute standalone shell bootstrap
    try {
      new Function(standaloneBootstrap)();
    } catch {
      // Ignore errors in standalone detection
    }

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [standaloneBootstrap]);

  return null;
}
