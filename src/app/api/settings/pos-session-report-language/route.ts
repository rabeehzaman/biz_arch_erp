import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { POS_SESSION_REPORT_LANGUAGE_KEY } from "@/lib/validations/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const [setting, organization] = await Promise.all([
      prisma.setting.findFirst({
        where: { organizationId, key: POS_SESSION_REPORT_LANGUAGE_KEY, userId: null },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { language: true },
      }),
    ]);

    const value = setting?.value === "ar" ? "ar" : organization?.language === "ar" ? "ar" : "en";

    return NextResponse.json({ value });
  } catch (error) {
    console.error("Failed to fetch POS session report language setting:", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
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
    const value = body?.value;

    if (value !== "en" && value !== "ar") {
      return NextResponse.json(
        { error: "Value must be 'en' or 'ar'" },
        { status: 400 }
      );
    }

    const existing = await prisma.setting.findFirst({
      where: { organizationId, key: POS_SESSION_REPORT_LANGUAGE_KEY, userId: null },
    });
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.setting.create({ data: { organizationId, key: POS_SESSION_REPORT_LANGUAGE_KEY, value } });
    }

    return NextResponse.json({ success: true, value });
  } catch (error) {
    console.error("Failed to update POS session report language setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
