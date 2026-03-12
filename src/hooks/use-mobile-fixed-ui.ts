"use client";

import { useEffect, useRef, useState } from "react";

const MOBILE_FIXED_UI_RECOVERY_DELAYS = [0, 80, 180, 320, 500, 720, 960, 1200, 1500];

function isMobileViewport() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(max-width: 767px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function hasBlockingOverlayOpen() {
  if (typeof document === "undefined") return false;

  return Boolean(
    document.querySelector(
      '[data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="alert-dialog-content"]'
    )
  );
}

function measureViewportState() {
  if (typeof window === "undefined" || !isMobileViewport()) {
    return { bottomOffset: 0, keyboardOpen: false };
  }

  const viewport = window.visualViewport;

  if (!viewport) {
    return { bottomOffset: 0, keyboardOpen: false };
  }

  const viewportBottom = viewport.offsetTop + viewport.height;
  const delta = Math.round(viewportBottom - window.innerHeight);
  const heightDiff = window.innerHeight - viewport.height;
  const keyboardOpen = heightDiff > 120 && viewport.height < window.innerHeight - 80;

  return {
    bottomOffset: keyboardOpen ? 0 : Math.max(delta, 0),
    keyboardOpen,
  };
}

export function useMobileFixedUi() {
  const [hasBlockingOverlay, setHasBlockingOverlay] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const previousBusyRef = useRef(false);
  const recoveryTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isMobileViewport()) {
      document.documentElement.style.setProperty("--mobile-fixed-ui-offset", "0px");
      return;
    }

    const applyViewportState = (
      viewportState: ReturnType<typeof measureViewportState>,
      options?: { allowBottomOffset?: boolean }
    ) => {
      const nextBottomOffset =
        options?.allowBottomOffset && !viewportState.keyboardOpen
          ? viewportState.bottomOffset
          : 0;

      setKeyboardOpen(viewportState.keyboardOpen);
      setBottomOffset(nextBottomOffset);
      document.documentElement.style.setProperty(
        "--mobile-fixed-ui-offset",
        `${nextBottomOffset}px`
      );
    };

    const clearRecoveryTimeouts = () => {
      recoveryTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      recoveryTimeoutsRef.current = [];
    };

    const scheduleRecoveryPasses = () => {
      setRecovering(true);
      clearRecoveryTimeouts();

      recoveryTimeoutsRef.current = MOBILE_FIXED_UI_RECOVERY_DELAYS.map((delay, index) =>
        window.setTimeout(() => {
          // Nudge iOS Safari into recalculating window.innerHeight by
          // doing a micro-scroll. Without this, Safari can leave
          // innerHeight at the keyboard-shrunk value after modal close,
          // causing the bottom nav to float above a gap.
          window.scrollTo(0, 0);

          const overlayOpen = hasBlockingOverlayOpen();
          const viewportState = measureViewportState();

          setHasBlockingOverlay(overlayOpen);
          applyViewportState(viewportState, { allowBottomOffset: true });

          if (index === MOBILE_FIXED_UI_RECOVERY_DELAYS.length - 1) {
            setRecovering(false);
          }
        }, delay)
      );
    };

    const sync = () => {
      const overlayOpen = hasBlockingOverlayOpen();
      const viewportState = measureViewportState();
      const isBusy = overlayOpen || viewportState.keyboardOpen;

      setHasBlockingOverlay(overlayOpen);
      applyViewportState(viewportState);

      if (isBusy) {
        setRecovering(false);
        clearRecoveryTimeouts();
      } else if (previousBusyRef.current) {
        scheduleRecoveryPasses();
      }

      previousBusyRef.current = isBusy;
    };

    const handleDialogViewportReset = () => {
      previousBusyRef.current = true;
      sync();
    };

    const viewport = window.visualViewport;
    const observer = new MutationObserver(sync);

    sync();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "open"],
    });

    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("orientationchange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("mobile-dialog-viewport-reset", handleDialogViewportReset);

    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("mobile-dialog-viewport-reset", handleDialogViewportReset);

      clearRecoveryTimeouts();

      document.documentElement.style.setProperty("--mobile-fixed-ui-offset", "0px");
    };
  }, []);

  return {
    bottomOffset,
    hideFixedUi: hasBlockingOverlay || keyboardOpen || recovering,
  };
}
