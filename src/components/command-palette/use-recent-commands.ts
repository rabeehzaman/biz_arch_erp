"use client";

import { useState, useCallback, useEffect } from "react";
import type { RecentItem } from "./types";

const STORAGE_KEY = "bizarch-command-history";
const MAX_RECENT = 8;

export function useRecentCommands() {
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecents(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const addRecent = useCallback((item: RecentItem) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.id !== item.id);
      const updated = [
        { ...item, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { recents, addRecent, clearRecents };
}
