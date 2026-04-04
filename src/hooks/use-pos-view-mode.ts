"use client";

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "bizarch-pos-view-mode";

type ViewMode = "grid" | "list";

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((fn) => fn());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ViewMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function getServerSnapshot(): ViewMode {
  return "grid";
}

export function usePosViewMode() {
  const viewMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    emitChange();
  }, []);

  return { viewMode, setViewMode };
}
