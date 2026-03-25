import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ClientDashboardLayout from "./client-layout";
import { getOrgId } from "@/lib/auth-utils";
import { isSubscriptionExpired } from "@/lib/subscription";
import { SETTING_KEYS, type OrgFormConfig } from "@/lib/form-config/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const cookieStore = await cookies();

  if (!session) {
    redirect("/login");
  }

  // POS users shouldn't be in the dashboard layout at all
  if (session.user && (session.user as any).role === "pos") {
    redirect("/pos");
  }

  // Check subscription status (superadmin is exempt)
  if (session.user && session.user.role !== "superadmin") {
    try {
      const organizationId = getOrgId(session);
      if (organizationId) {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { subscriptionStatus: true, subscriptionEndDate: true },
        });
        if (org && isSubscriptionExpired(org)) {
          redirect("/subscription-expired");
        }
      }
    } catch (_error) {
      // Don't block access if subscription check fails
    }
  }

  // Pre-fetch disabled sidebar items to prevent flicker
  let disabledSidebarItems: string[] = [];
  try {
    if (session.user && session.user.role !== "superadmin") {
      let organizationId;
      try {
        organizationId = getOrgId(session);
      } catch (_error) {
        // ignore
      }

      if (organizationId) {
        const setting = await prisma.setting.findFirst({
          where: {
            organizationId,
            key: "disabledSidebarItems",
          },
        });

        if (setting && setting.value) {
          try {
            disabledSidebarItems = JSON.parse(setting.value);
          } catch (_error) {
            // ignore
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to pre-fetch disabled sidebar items:", error);
  }

  // Pre-fetch form config (field defaults, hidden fields, sidebar mode, etc.)
  let formConfig: OrgFormConfig = {
    fields: {},
    disabledReports: [],
    sidebarMode: "full",
    sidebarSectionOrder: null,
    mobileNavTabs: null,
    defaultLandingPage: null,
  };
  try {
    if (session.user && session.user.role !== "superadmin") {
      let orgId;
      try {
        orgId = getOrgId(session);
      } catch {
        // ignore
      }

      if (orgId) {
        const configSettings = await prisma.setting.findMany({
          where: {
            organizationId: orgId,
            key: {
              in: [
                SETTING_KEYS.FORM_FIELD_CONFIG,
                SETTING_KEYS.DISABLED_REPORTS,
                SETTING_KEYS.SIDEBAR_MODE,
                SETTING_KEYS.SIDEBAR_SECTION_ORDER,
                SETTING_KEYS.MOBILE_NAV_CONFIG,
                SETTING_KEYS.DEFAULT_LANDING_PAGE,
              ],
            },
          },
        });

        const map = new Map(configSettings.map((s) => [s.key, s.value]));
        const p = <T,>(v: string | undefined, fb: T): T => {
          if (!v) return fb;
          try { return JSON.parse(v) as T; } catch { return fb; }
        };

        formConfig = {
          fields: p(map.get(SETTING_KEYS.FORM_FIELD_CONFIG), {}),
          disabledReports: p(map.get(SETTING_KEYS.DISABLED_REPORTS), []),
          sidebarMode: p(map.get(SETTING_KEYS.SIDEBAR_MODE), "full"),
          sidebarSectionOrder: p(map.get(SETTING_KEYS.SIDEBAR_SECTION_ORDER), null),
          mobileNavTabs: p(map.get(SETTING_KEYS.MOBILE_NAV_CONFIG), null),
          defaultLandingPage: p(map.get(SETTING_KEYS.DEFAULT_LANDING_PAGE), null),
        };

        // Merge per-user defaults
        const usr = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { formDefaults: true },
        });
        if (usr?.formDefaults) {
          const userDefaults = p<Record<string, Record<string, unknown>>>(usr.formDefaults, {});
          for (const [formName, defs] of Object.entries(userDefaults)) {
            const key = formName as keyof typeof formConfig.fields;
            if (!formConfig.fields[key]) {
              formConfig.fields[key] = { hidden: [], defaults: {} };
            }
            formConfig.fields[key]!.defaults = { ...formConfig.fields[key]!.defaults, ...defs as Record<string, string | number | boolean> };
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to pre-fetch form config:", error);
  }

  // Prefer the browser-stored language so Arabic loads immediately on refresh.
  const cookieLanguage = cookieStore.get("preferred-language")?.value;
  const initialLang =
    cookieLanguage === "ar" || cookieLanguage === "en"
      ? cookieLanguage
      : (session.user as { language?: string })?.language || "en";

  return (
    <ClientDashboardLayout
      session={session}
      swrFallback={{
        "/api/sidebar": disabledSidebarItems,
        "/api/form-config": formConfig,
      }}
      initialLang={initialLang}
    >
      {children}
    </ClientDashboardLayout>
  );
}
