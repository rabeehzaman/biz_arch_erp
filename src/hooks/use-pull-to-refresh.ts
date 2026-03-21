"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHaptics } from "@/hooks/use-haptics";

const THRESHOLD = 60;
const MAX_PULL = 100;

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, disabled }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const { impactMedium } = useHaptics();
  const hapticFired = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (window.scrollY > 0) return;
      touchStartY.current = e.touches[0].clientY;
      pulling.current = false;
      hapticFired.current = false;
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (window.scrollY > 0) {
        if (pulling.current) {
          pulling.current = false;
          setPullDistance(0);
        }
        return;
      }

      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta < 0) return;

      pulling.current = true;
      const distance = Math.min(delta * 0.5, MAX_PULL);
      setPullDistance(distance);

      if (distance >= THRESHOLD && !hapticFired.current) {
        hapticFired.current = true;
        impactMedium();
      }
    },
    [disabled, isRefreshing, impactMedium]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullDistance, isRefreshing };
}
