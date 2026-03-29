import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  SETTING_KEYS,
  type FormFieldConfig,
  type FieldConfig,
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

const ALL_KEYS = [
  SETTING_KEYS.FORM_FIELD_CONFIG,
  SETTING_KEYS.DISABLED_REPORTS,
  SETTING_KEYS.DISABLED_SIDEBAR_ITEMS,
  SETTING_KEYS.SIDEBAR_MODE,
  SETTING_KEYS.SIDEBAR_SECTION_ORDER,
  SETTING_KEYS.MOBILE_NAV_CONFIG,
  SETTING_KEYS.DEFAULT_LANDING_PAGE,
];

/** Merge user-level field config over org-level, per form */
function mergeFieldConfigs(
  orgFields: FormFieldConfig,
  userFields: FormFieldConfig
): FormFieldConfig {
  const merged: FormFieldConfig = { ...orgFields };
  for (const [formName, userFormConfig] of Object.entries(userFields)) {
    const key = formName as keyof FormFieldConfig;
    const orgFormConfig = orgFields[key];
    if (!orgFormConfig) {
      merged[key] = userFormConfig;
    } else {
      merged[key] = {
        hidden: userFormConfig.hidden ?? orgFormConfig.hidden,
        defaults: { ...orgFormConfig.defaults, ...userFormConfig.defaults },
        hiddenColumns:
          userFormConfig.hiddenColumns ?? orgFormConfig.hiddenColumns,
      } as FieldConfig;
    }
  }
  return merged;
}

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

    const userId = session.user.id;

    // Fetch org-level and user-level settings in parallel
    const [orgSettings, userSettings] = await Promise.all([
      prisma.setting.findMany({
        where: { organizationId, userId: null, key: { in: ALL_KEYS } },
      }),
      userId
        ? prisma.setting.findMany({
            where: { organizationId, userId, key: { in: ALL_KEYS } },
          })
        : Promise.resolve([]),
    ]);

    const orgMap = new Map(orgSettings.map((s) => [s.key, s.value]));
    const userMap = new Map(userSettings.map((s) => [s.key, s.value]));

    // Helper: user value overrides org value if present
    function resolve<T>(key: string, fallback: T): T {
      const userVal = userMap.get(key);
      if (userVal !== undefined) return parseJSON<T>(userVal, fallback);
      return parseJSON<T>(orgMap.get(key), fallback);
    }

    // For form_field_config, do a deep per-form merge
    const orgFields = parseJSON<FormFieldConfig>(
      orgMap.get(SETTING_KEYS.FORM_FIELD_CONFIG),
      {}
    );
    const userFields = parseJSON<FormFieldConfig>(
      userMap.get(SETTING_KEYS.FORM_FIELD_CONFIG),
      {}
    );
    const mergedFields =
      Object.keys(userFields).length > 0
        ? mergeFieldConfigs(orgFields, userFields)
        : orgFields;

    const config: OrgFormConfig = {
      fields: mergedFields,
      disabledReports: resolve<string[]>(SETTING_KEYS.DISABLED_REPORTS, []),
      disabledSidebarItems: resolve<string[]>(
        SETTING_KEYS.DISABLED_SIDEBAR_ITEMS,
        []
      ),
      sidebarMode: resolve<"full" | "hidden">(SETTING_KEYS.SIDEBAR_MODE, "full"),
      sidebarSectionOrder: resolve<string[] | null>(
        SETTING_KEYS.SIDEBAR_SECTION_ORDER,
        null
      ),
      mobileNavTabs: resolve<MobileNavTab[] | null>(
        SETTING_KEYS.MOBILE_NAV_CONFIG,
        null
      ),
      defaultLandingPage: resolve<string | null>(
        SETTING_KEYS.DEFAULT_LANDING_PAGE,
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
