import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  SETTING_KEYS,
  type FormFieldConfig,
  type MobileNavTab,
  type OrgFormConfig,
} from "@/lib/form-config/types";

function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_CONFIG: OrgFormConfig = {
  fields: {},
  disabledReports: [],
  disabledSidebarItems: [],
  sidebarMode: "full",
  sidebarSectionOrder: null,
  mobileNavTabs: null,
  defaultLandingPage: null,
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(EMPTY_CONFIG);
    }

    const role = (session.user as { role?: string }).role;

    // Superadmin sees no config restrictions
    if (role === "superadmin") {
      return NextResponse.json(EMPTY_CONFIG);
    }

    let organizationId: string | undefined;
    try {
      organizationId = getOrgId(session);
    } catch {
      // No org
    }

    if (!organizationId) {
      return NextResponse.json(EMPTY_CONFIG);
    }

    // Fetch all config settings in one query
    const settings = await prisma.setting.findMany({
      where: {
        organizationId,
        key: {
          in: [
            SETTING_KEYS.FORM_FIELD_CONFIG,
            SETTING_KEYS.DISABLED_REPORTS,
            SETTING_KEYS.DISABLED_SIDEBAR_ITEMS,
            SETTING_KEYS.SIDEBAR_MODE,
            SETTING_KEYS.SIDEBAR_SECTION_ORDER,
            SETTING_KEYS.MOBILE_NAV_CONFIG,
            SETTING_KEYS.DEFAULT_LANDING_PAGE,
          ],
        },
      },
    });

    const settingMap = new Map(settings.map((s) => [s.key, s.value]));

    const orgFields = parseJSON<FormFieldConfig>(
      settingMap.get(SETTING_KEYS.FORM_FIELD_CONFIG),
      {}
    );

    // Merge per-user defaults over org defaults
    try {
      const userId = session.user.id;
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { formDefaults: true },
        });

        if (user?.formDefaults) {
          const userDefaults = parseJSON<Record<string, Record<string, string | number | boolean>>>(
            user.formDefaults,
            {}
          );
          for (const [formName, userFormDefaults] of Object.entries(userDefaults)) {
            if (!orgFields[formName as keyof FormFieldConfig]) {
              orgFields[formName as keyof FormFieldConfig] = { hidden: [], defaults: {} };
            }
            const formConfig = orgFields[formName as keyof FormFieldConfig]!;
            formConfig.defaults = { ...formConfig.defaults, ...userFormDefaults };
          }
        }
      }
    } catch {
      // If user defaults merge fails, continue with org-only config
    }

    const config: OrgFormConfig = {
      fields: orgFields,
      disabledReports: parseJSON<string[]>(
        settingMap.get(SETTING_KEYS.DISABLED_REPORTS),
        []
      ),
      disabledSidebarItems: parseJSON<string[]>(
        settingMap.get(SETTING_KEYS.DISABLED_SIDEBAR_ITEMS),
        []
      ),
      sidebarMode: parseJSON<"full" | "hidden">(
        settingMap.get(SETTING_KEYS.SIDEBAR_MODE),
        "full"
      ),
      sidebarSectionOrder: parseJSON<string[] | null>(
        settingMap.get(SETTING_KEYS.SIDEBAR_SECTION_ORDER),
        null
      ),
      mobileNavTabs: parseJSON<MobileNavTab[] | null>(
        settingMap.get(SETTING_KEYS.MOBILE_NAV_CONFIG),
        null
      ),
      defaultLandingPage: parseJSON<string | null>(
        settingMap.get(SETTING_KEYS.DEFAULT_LANDING_PAGE),
        null
      ),
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to fetch form config:", error);
    // Return empty config rather than error to avoid breaking the UI
    return NextResponse.json(EMPTY_CONFIG);
  }
}
