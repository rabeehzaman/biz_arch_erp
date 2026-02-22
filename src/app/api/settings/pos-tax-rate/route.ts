import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

const SETTING_KEY = "pos_default_tax_rate";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const setting = await prisma.setting.findUnique({
      where: { organizationId_key: { organizationId, key: SETTING_KEY } },
    });

    return NextResponse.json({ value: setting?.value ?? "0" });
  } catch (error) {
    console.error("Failed to fetch POS tax rate:", error);
    return NextResponse.json({ error: "Failed to fetch POS tax rate" }, { status: 500 });
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

    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "Tax rate must be between 0 and 100" }, { status: 400 });
    }

    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId, key: SETTING_KEY } },
      update: { value: rate.toString() },
      create: { organizationId, key: SETTING_KEY, value: rate.toString() },
    });

    return NextResponse.json({ success: true, value: rate.toString() });
  } catch (error) {
    console.error("Failed to update POS tax rate:", error);
    return NextResponse.json({ error: "Failed to update POS tax rate" }, { status: 500 });
  }
}
