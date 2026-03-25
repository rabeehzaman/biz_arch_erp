"use client";

import { useContext, useMemo } from "react";
import { useSession } from "next-auth/react";
import { FormConfigContext } from "@/lib/form-config/context";
import type { FormName, MobileNavTab } from "@/lib/form-config/types";

/**
 * Hook for form components to get field defaults and visibility.
 *
 * When no config exists for the org, all fields are visible and
 * getDefault returns the fallback — zero overhead.
 */
export function useFormConfig(formName: FormName, opts?: { isEdit?: boolean }) {
  const ctx = useContext(FormConfigContext);
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === "superadmin";

  return useMemo(() => {
    const formConfig = ctx?.fields?.[formName];
    const hiddenSet = new Set(formConfig?.hidden ?? []);
    const defaults = formConfig?.defaults ?? {};

    return {
      /** Returns true if the field should be hidden from the UI */
      isFieldHidden: (fieldName: string): boolean => {
        // Superadmin always sees everything
        if (isSuperadmin) return false;
        // Edit mode shows all fields by default
        if (opts?.isEdit) return false;
        return hiddenSet.has(fieldName);
      },
      /** Returns the configured default or the provided fallback */
      getDefault: <T,>(fieldName: string, fallback: T): T => {
        const val = defaults[fieldName];
        return val !== undefined ? (val as T) : fallback;
      },
      hiddenFields: formConfig?.hidden ?? [],
      defaults,
    };
  }, [ctx, formName, isSuperadmin, opts?.isEdit]);
}

/** Returns the list of disabled report slugs for the current org */
export function useDisabledReports(): string[] {
  const ctx = useContext(FormConfigContext);
  return ctx?.disabledReports ?? [];
}

/** Returns the sidebar display mode: "full" or "hidden" */
export function useSidebarMode(): "full" | "hidden" {
  const ctx = useContext(FormConfigContext);
  const { data: session } = useSession();
  // Superadmin always sees full sidebar
  if (session?.user?.role === "superadmin") return "full";
  return ctx?.sidebarMode ?? "full";
}

/** Returns the configured sidebar section order, or null for default */
export function useSidebarSectionOrder(): string[] | null {
  const ctx = useContext(FormConfigContext);
  return ctx?.sidebarSectionOrder ?? null;
}

/** Returns the configured mobile nav tabs, or null for default */
export function useMobileNavConfig(): MobileNavTab[] | null {
  const ctx = useContext(FormConfigContext);
  return ctx?.mobileNavTabs ?? null;
}

/** Returns the configured default landing page for the org */
export function useDefaultLandingPage(): string | null {
  const ctx = useContext(FormConfigContext);
  return ctx?.defaultLandingPage ?? null;
}
