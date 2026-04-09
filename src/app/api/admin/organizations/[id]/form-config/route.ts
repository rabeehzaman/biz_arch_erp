import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  FORM_REGISTRY,
  SETTING_KEYS,
  SIDEBAR_SECTIONS,
  ALL_REPORT_SLUGS,
  ALL_SIDEBAR_ITEM_NAMES,
  ALL_POS_COMPONENT_SLUGS,
  type FormFieldConfig,
  type MobileNavTab,
  type OrgFormConfig,
  type FormName,
} from "@/lib/form-config/types";

function parseSettingJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const settings = await prisma.setting.findMany({
      where: {
        organizationId: id,
        userId: null,
        key: {
          in: [
            SETTING_KEYS.FORM_FIELD_CONFIG,
            SETTING_KEYS.DISABLED_REPORTS,
            SETTING_KEYS.DISABLED_SIDEBAR_ITEMS,
            SETTING_KEYS.SIDEBAR_MODE,
            SETTING_KEYS.SIDEBAR_SECTION_ORDER,
            SETTING_KEYS.MOBILE_NAV_CONFIG,
            SETTING_KEYS.DEFAULT_LANDING_PAGE,
            SETTING_KEYS.POS_HIDDEN_COMPONENTS,
          ],
        },
      },
    });

    const settingMap = new Map(settings.map((s) => [s.key, s.value]));

    const config: OrgFormConfig = {
      fields: parseSettingJSON<FormFieldConfig>(
        settingMap.get(SETTING_KEYS.FORM_FIELD_CONFIG),
        {}
      ),
      disabledReports: parseSettingJSON<string[]>(
        settingMap.get(SETTING_KEYS.DISABLED_REPORTS),
        []
      ),
      disabledSidebarItems: parseSettingJSON<string[]>(
        settingMap.get(SETTING_KEYS.DISABLED_SIDEBAR_ITEMS),
        []
      ),
      sidebarMode: parseSettingJSON<"full" | "hidden">(
        settingMap.get(SETTING_KEYS.SIDEBAR_MODE),
        "full"
      ),
      sidebarSectionOrder: parseSettingJSON<string[] | null>(
        settingMap.get(SETTING_KEYS.SIDEBAR_SECTION_ORDER),
        null
      ),
      mobileNavTabs: parseSettingJSON<MobileNavTab[] | null>(
        settingMap.get(SETTING_KEYS.MOBILE_NAV_CONFIG),
        null
      ),
      defaultLandingPage: parseSettingJSON<string | null>(
        settingMap.get(SETTING_KEYS.DEFAULT_LANDING_PAGE),
        null
      ),
      posHiddenComponents: parseSettingJSON<string[]>(
        settingMap.get(SETTING_KEYS.POS_HIDDEN_COMPONENTS),
        []
      ),
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to fetch form config:", error);
    return NextResponse.json(
      { error: "Failed to fetch form config" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as Partial<OrgFormConfig>;

    // Validate form field config
    if (body.fields) {
      for (const [formName, fieldConfig] of Object.entries(body.fields)) {
        if (!(formName in FORM_REGISTRY)) {
          return NextResponse.json(
            { error: `Unknown form: ${formName}` },
            { status: 400 }
          );
        }

        const formDef = FORM_REGISTRY[formName as FormName] as { label: string; fields: Record<string, { canHide: boolean; required: boolean }>; columns?: Record<string, { canHide: boolean }> };

        // Validate hidden fields
        if (fieldConfig.hidden) {
          for (const fieldName of fieldConfig.hidden) {
            const field = formDef.fields[fieldName];
            if (!field) {
              return NextResponse.json(
                { error: `Unknown field "${fieldName}" in form "${formName}"` },
                { status: 400 }
              );
            }
            if (!field.canHide) {
              return NextResponse.json(
                { error: `Field "${fieldName}" in "${formName}" cannot be hidden` },
                { status: 400 }
              );
            }
            // If required and hidden, must have a default
            if (
              field.required &&
              (!fieldConfig.defaults ||
                fieldConfig.defaults[fieldName] === undefined ||
                fieldConfig.defaults[fieldName] === "")
            ) {
              return NextResponse.json(
                {
                  error: `Required field "${fieldName}" in "${formName}" is hidden but has no default value`,
                },
                { status: 400 }
              );
            }
          }
        }

        // Validate default field names
        if (fieldConfig.defaults) {
          for (const fieldName of Object.keys(fieldConfig.defaults)) {
            if (!(fieldName in formDef.fields)) {
              return NextResponse.json(
                { error: `Unknown default field "${fieldName}" in form "${formName}"` },
                { status: 400 }
              );
            }
          }
        }

        // Validate hidden columns
        if (fieldConfig.hiddenColumns) {
          if (!Array.isArray(fieldConfig.hiddenColumns)) {
            return NextResponse.json(
              { error: `hiddenColumns must be an array in form "${formName}"` },
              { status: 400 }
            );
          }
          if (!formDef.columns) {
            return NextResponse.json(
              { error: `Form "${formName}" does not have configurable columns` },
              { status: 400 }
            );
          }
          for (const colName of fieldConfig.hiddenColumns) {
            const colDef = formDef.columns[colName];
            if (!colDef) {
              return NextResponse.json(
                { error: `Unknown column "${colName}" in form "${formName}"` },
                { status: 400 }
              );
            }
            if (!colDef.canHide) {
              return NextResponse.json(
                { error: `Column "${colName}" in "${formName}" cannot be hidden` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // Validate disabled reports
    if (body.disabledReports) {
      if (!Array.isArray(body.disabledReports)) {
        return NextResponse.json(
          { error: "disabledReports must be an array" },
          { status: 400 }
        );
      }
      for (const slug of body.disabledReports) {
        if (!ALL_REPORT_SLUGS.includes(slug as (typeof ALL_REPORT_SLUGS)[number])) {
          return NextResponse.json(
            { error: `Unknown report slug: ${slug}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate disabled sidebar items — silently strip unknown legacy entries
    if (body.disabledSidebarItems) {
      if (!Array.isArray(body.disabledSidebarItems)) {
        return NextResponse.json(
          { error: "disabledSidebarItems must be an array" },
          { status: 400 }
        );
      }
      body.disabledSidebarItems = body.disabledSidebarItems.filter((item) =>
        ALL_SIDEBAR_ITEM_NAMES.includes(item as (typeof ALL_SIDEBAR_ITEM_NAMES)[number])
      );
    }

    // Validate sidebar mode
    if (body.sidebarMode && !["full", "hidden"].includes(body.sidebarMode)) {
      return NextResponse.json(
        { error: "sidebarMode must be 'full' or 'hidden'" },
        { status: 400 }
      );
    }

    // Validate sidebar section order
    if (body.sidebarSectionOrder) {
      if (!Array.isArray(body.sidebarSectionOrder)) {
        return NextResponse.json(
          { error: "sidebarSectionOrder must be an array" },
          { status: 400 }
        );
      }
      for (const section of body.sidebarSectionOrder) {
        if (!SIDEBAR_SECTIONS.includes(section as (typeof SIDEBAR_SECTIONS)[number])) {
          return NextResponse.json(
            { error: `Unknown sidebar section: ${section}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate POS hidden components — silently strip unknown slugs
    if (body.posHiddenComponents) {
      if (!Array.isArray(body.posHiddenComponents)) {
        return NextResponse.json(
          { error: "posHiddenComponents must be an array" },
          { status: 400 }
        );
      }
      body.posHiddenComponents = body.posHiddenComponents.filter((item) =>
        ALL_POS_COMPONENT_SLUGS.includes(item)
      );
    }

    // Validate mobile nav tabs
    if (body.mobileNavTabs) {
      if (!Array.isArray(body.mobileNavTabs)) {
        return NextResponse.json(
          { error: "mobileNavTabs must be an array" },
          { status: 400 }
        );
      }
      if (body.mobileNavTabs.length < 2 || body.mobileNavTabs.length > 5) {
        return NextResponse.json(
          { error: "mobileNavTabs must have between 2 and 5 tabs" },
          { status: 400 }
        );
      }
    }

    // Upsert all settings
    const upserts: { key: string; value: string }[] = [];

    if (body.fields !== undefined) {
      upserts.push({
        key: SETTING_KEYS.FORM_FIELD_CONFIG,
        value: JSON.stringify(body.fields),
      });
    }
    if (body.disabledReports !== undefined) {
      upserts.push({
        key: SETTING_KEYS.DISABLED_REPORTS,
        value: JSON.stringify(body.disabledReports),
      });
    }
    if (body.disabledSidebarItems !== undefined) {
      upserts.push({
        key: SETTING_KEYS.DISABLED_SIDEBAR_ITEMS,
        value: JSON.stringify(body.disabledSidebarItems),
      });
    }
    if (body.sidebarMode !== undefined) {
      upserts.push({
        key: SETTING_KEYS.SIDEBAR_MODE,
        value: JSON.stringify(body.sidebarMode),
      });
    }
    if (body.sidebarSectionOrder !== undefined) {
      upserts.push({
        key: SETTING_KEYS.SIDEBAR_SECTION_ORDER,
        value: JSON.stringify(body.sidebarSectionOrder),
      });
    }
    if (body.mobileNavTabs !== undefined) {
      upserts.push({
        key: SETTING_KEYS.MOBILE_NAV_CONFIG,
        value: JSON.stringify(body.mobileNavTabs),
      });
    }
    if (body.defaultLandingPage !== undefined) {
      upserts.push({
        key: SETTING_KEYS.DEFAULT_LANDING_PAGE,
        value: JSON.stringify(body.defaultLandingPage),
      });
    }
    if (body.posHiddenComponents !== undefined) {
      upserts.push({
        key: SETTING_KEYS.POS_HIDDEN_COMPONENTS,
        value: JSON.stringify(body.posHiddenComponents),
      });
    }

    await Promise.all(
      upserts.map(async (u) => {
        const existing = await prisma.setting.findFirst({
          where: { organizationId: id, key: u.key, userId: null },
        });
        if (existing) {
          await prisma.setting.update({
            where: { id: existing.id },
            data: { value: u.value },
          });
        } else {
          await prisma.setting.create({
            data: { organizationId: id, key: u.key, value: u.value },
          });
        }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update form config:", error);
    return NextResponse.json(
      { error: "Failed to update form config" },
      { status: 500 }
    );
  }
}
