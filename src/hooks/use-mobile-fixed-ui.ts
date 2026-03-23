"use client";

import { useEffect, useRef, useState } from "react";
import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";
import { getPreserveScrollY, clearPreserveScrollY } from "@/lib/mobile-viewport";

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
  const [scrolledDown, setScrolledDown] = useState(false);
  const previousBusyRef = useRef(false);
  const recoveryTimeoutsRef = useRef<number[]>([]);
  const lastScrollYRef = useRef(0);

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
      clearRecoveryTimeouts();

      // Check if a combobox/select requested scroll preservation.
      // Read on every call (don't consume) so re-triggered recovery
      // passes still use the correct target.
      const targetScrollY = getPreserveScrollY();

      const lastDelay = MOBILE_FIXED_UI_RECOVERY_DELAYS[MOBILE_FIXED_UI_RECOVERY_DELAYS.length - 1];

      recoveryTimeoutsRef.current = MOBILE_FIXED_UI_RECOVERY_DELAYS.map((delay) =>
        window.setTimeout(() => {
          // Nudge iOS Safari into recalculating window.innerHeight by
          // doing a micro-scroll. Without this, Safari can leave
          // innerHeight at the keyboard-shrunk value after modal close,
          // causing the bottom nav to float above a gap.
          // When preserveScroll was requested, restore to that position instead.
          window.scrollTo(0, targetScrollY ?? 0);

          const overlayOpen = hasBlockingOverlayOpen();
          const viewportState = measureViewportState();

          setHasBlockingOverlay(overlayOpen);
          applyViewportState(viewportState, { allowBottomOffset: true });

          // Clear the preserve-scroll target after the last recovery pass
          if (delay === lastDelay && targetScrollY != null) {
            clearPreserveScrollY();
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


    // RAF-debounced sync for MutationObserver
    let mutationRafId = 0;
    const debouncedSync = () => {
      if (mutationRafId) return;
      mutationRafId = requestAnimationFrame(() => {
        mutationRafId = 0;
        sync();
      });
    };

    // Scroll-direction detection for hide-on-scroll
    let scrollRafId = 0;
    const handleScrollDirection = () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = 0;
        const currentY = window.scrollY;
        const delta = currentY - lastScrollYRef.current;
        if (Math.abs(delta) < 10) return;
        if (currentY < 80) {
          setScrolledDown(false);
        } else {
          setScrolledDown(delta > 0);
        }
        lastScrollYRef.current = currentY;
      });
    };

    const viewport = window.visualViewport;
    const observer = new MutationObserver(debouncedSync);

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
    window.addEventListener("scroll", handleScrollDirection, { passive: true });
    window.addEventListener("orientationchange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("mobile-dialog-viewport-reset", handleDialogViewportReset);

    // Capacitor Keyboard plugin: more reliable keyboard height on native
    let keyboardCleanup: (() => void) | undefined;
    if (isCapacitorEnvironment()) {
      import("@capacitor/keyboard").then(({ Keyboard }) => {
        const showHandle = Keyboard.addListener("keyboardWillShow", () => {
          setKeyboardOpen(true);
          // Auto-scroll focused input into view
          const el = document.activeElement;
          if (el && "scrollIntoView" in el) {
            setTimeout(() => (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" }), 100);
          }
        });
        const hideHandle = Keyboard.addListener("keyboardWillHide", () => {
          previousBusyRef.current = true;
          sync();
        });
        keyboardCleanup = () => {
          showHandle.then((h) => h.remove());
          hideHandle.then((h) => h.remove());
        };
      }).catch(() => {});
    }

    return () => {
      observer.disconnect();
      if (mutationRafId) cancelAnimationFrame(mutationRafId);
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
      window.removeEventListener("scroll", handleScrollDirection);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("mobile-dialog-viewport-reset", handleDialogViewportReset);
      keyboardCleanup?.();

      clearRecoveryTimeouts();

      document.documentElement.style.setProperty("--mobile-fixed-ui-offset", "0px");
    };
  }, []);

  return {
    bottomOffset,
    hideFixedUi: hasBlockingOverlay || keyboardOpen,
    scrolledDown,
  };
}
