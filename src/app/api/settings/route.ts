import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  companySettingsSchema,
  SETTINGS_KEY_MAP,
  DEFAULT_SETTINGS,
  type CompanySettingsFormData,
} from "@/lib/validations/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const settings = await prisma.setting.findMany({
      where: {
        organizationId,
        key: {
          startsWith: "company_",
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    const result: CompanySettingsFormData = { ...DEFAULT_SETTINGS };

    for (const [formKey, dbKey] of Object.entries(SETTINGS_KEY_MAP)) {
      const value = settingsMap.get(dbKey);
      if (value !== undefined) {
        result[formKey as keyof CompanySettingsFormData] = value;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();

    const parsed = companySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const upsertPromises = Object.entries(SETTINGS_KEY_MAP).map(
      ([formKey, dbKey]) => {
        const value = data[formKey as keyof CompanySettingsFormData] ?? "";
        return prisma.setting.upsert({
          where: { organizationId_key: { organizationId, key: dbKey } },
          update: { value },
          create: { organizationId, key: dbKey, value },
        });
      }
    );

    await Promise.all(upsertPromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
