"use client";

import { useState, useCallback } from "react";
import type { RecentItem } from "./types";

const STORAGE_KEY = "bizarch-command-history";
const MAX_RECENT = 8;

export function useRecentCommands() {
  const [recents, setRecents] = useState<RecentItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as RecentItem[];
      }
    } catch {
      // ignore
    }
    return [];
  });

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
