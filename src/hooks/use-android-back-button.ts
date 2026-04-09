"use client";

import { useEffect, useRef } from "react";

/**
 * Register a handler for the Android hardware/gesture back button.
 * Handlers are called in LIFO order (last registered = highest priority).
 * Return `true` from the handler to consume the event (stop propagation).
 * Return `false` to let it fall through to the next handler.
 *
 * When no handler consumes the event, the default behavior is history.back()
 * or app exit (handled in capacitor-plugins.ts).
 */
export function useAndroidBackButton(
  handler: () => boolean,
  enabled = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const listener = (e: Event) => {
      if (handlerRef.current()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    // Use capture phase so higher-priority (later-mounted) listeners
    // that also use capture will still fire in the correct LIFO order.
    window.addEventListener("capacitor-back-button", listener);

    return () => {
      window.removeEventListener("capacitor-back-button", listener);
    };
  }, [enabled]);
}
