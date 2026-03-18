"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to warn users about unsaved changes when navigating away.
 * Uses beforeunload for tab close and intercepts Next.js navigation.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Warn on browser tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Warn on in-app navigation via popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      if (!isDirtyRef.current) return;
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmed) {
        // Push state back to cancel navigation
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}
