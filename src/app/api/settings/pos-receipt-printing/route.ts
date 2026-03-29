import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { POS_RECEIPT_PRINTING_KEY } from "@/lib/validations/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const setting = await prisma.setting.findFirst({
      where: { organizationId, key: POS_RECEIPT_PRINTING_KEY, userId: null },
    });

    return NextResponse.json({ value: setting?.value ?? "false" });
  } catch (error) {
    console.error("Failed to fetch POS receipt printing setting:", error);
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
    const { value } = body;

    if (value !== "true" && value !== "false") {
      return NextResponse.json({ error: "Value must be 'true' or 'false'" }, { status: 400 });
    }

    const existing = await prisma.setting.findFirst({
      where: { organizationId, key: POS_RECEIPT_PRINTING_KEY, userId: null },
    });
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.setting.create({ data: { organizationId, key: POS_RECEIPT_PRINTING_KEY, value } });
    }

    return NextResponse.json({ success: true, value });
  } catch (error) {
    console.error("Failed to update POS receipt printing setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
