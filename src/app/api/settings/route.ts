import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  companySettingsSchema,
  SETTINGS_KEY_MAP,
  DEFAULT_SETTINGS,
  type CompanySettingsFormData,
} from "@/lib/validations/settings";

export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      where: {
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
          where: { key: dbKey },
          update: { value },
          create: { key: dbKey, value },
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
