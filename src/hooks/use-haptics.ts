"use client";

import { useCallback } from "react";
import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";

export function useHaptics() {
  const impactLight = useCallback(async () => {
    if (!isCapacitorEnvironment()) return;
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }, []);

  const impactMedium = useCallback(async () => {
    if (!isCapacitorEnvironment()) return;
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  }, []);

  const notificationWarning = useCallback(async () => {
    if (!isCapacitorEnvironment()) return;
    try {
      const { Haptics, NotificationType } = await import("@capacitor/haptics");
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {}
  }, []);

  const notificationSuccess = useCallback(async () => {
    if (!isCapacitorEnvironment()) return;
    try {
      const { Haptics, NotificationType } = await import("@capacitor/haptics");
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  }, []);

  const selectionChanged = useCallback(async () => {
    if (!isCapacitorEnvironment()) return;
    try {
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.selectionChanged();
    } catch {}
  }, []);

  return {
    impactLight,
    impactMedium,
    notificationWarning,
    notificationSuccess,
    selectionChanged,
  };
}
