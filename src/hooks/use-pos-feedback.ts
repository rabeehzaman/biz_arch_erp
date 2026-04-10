"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useHaptics } from "@/hooks/use-haptics";
import {
  playTap,
  playTick,
  playSuccess,
  playError,
  playScan,
  isSoundEnabled,
  setSoundEnabled,
} from "@/lib/pos/pos-sounds";

// ── Sound-enabled external store ─────────────────────────────
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): boolean {
  return isSoundEnabled();
}

function getServerSnapshot(): boolean {
  return true;
}

export function usePosFeedback() {
  const {
    impactLight,
    impactMedium,
    selectionChanged,
    notificationSuccess,
    notificationWarning,
  } = useHaptics();

  const soundEnabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleSound = useCallback(() => {
    setSoundEnabled(!isSoundEnabled());
    listeners.forEach((cb) => cb());
  }, []);

  const feedbackAddItem = useCallback(() => {
    impactLight();
    playTap();
  }, [impactLight]);

  const feedbackQuantity = useCallback(() => {
    selectionChanged();
    playTick();
  }, [selectionChanged]);

  const feedbackRemoveItem = useCallback(() => {
    impactMedium();
    playTick();
  }, [impactMedium]);

  const feedbackSelectMethod = useCallback(() => {
    selectionChanged();
    playTick();
  }, [selectionChanged]);

  const feedbackCompleteSale = useCallback(() => {
    notificationSuccess();
    playSuccess();
  }, [notificationSuccess]);

  const feedbackKotSent = useCallback(() => {
    notificationSuccess();
    playSuccess();
  }, [notificationSuccess]);

  const feedbackError = useCallback(() => {
    notificationWarning();
    playError();
  }, [notificationWarning]);

  const feedbackScan = useCallback(() => {
    impactLight();
    playScan();
  }, [impactLight]);

  const feedbackNavTap = useCallback(() => {
    impactLight();
    playTap();
  }, [impactLight]);

  return {
    soundEnabled,
    toggleSound,
    feedbackAddItem,
    feedbackQuantity,
    feedbackRemoveItem,
    feedbackSelectMethod,
    feedbackCompleteSale,
    feedbackKotSent,
    feedbackError,
    feedbackScan,
    feedbackNavTap,
  };
}
