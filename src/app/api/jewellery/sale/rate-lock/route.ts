import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);

    const body = await request.json();
    const { purity, metalType = "GOLD" } = body;

    if (!purity) {
      return NextResponse.json({ error: "purity is required" }, { status: 400 });
    }

    // Find today's rate for the given purity and metal type (UTC midnight)
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const rate = await prisma.goldRate.findFirst({
      where: {
        organizationId,
        purity,
        metalType,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { date: "desc" },
    });

    if (!rate) {
      return NextResponse.json(
        { error: "No rate set for today" },
        { status: 404 }
      );
    }

    // Lock the rate
    const locked = await prisma.goldRate.update({
      where: { id: rate.id },
      data: { rateLocked: true },
    });

    return NextResponse.json(locked);
  } catch (error) {
    console.error("Failed to lock gold rate:", error);
    return NextResponse.json({ error: "Failed to lock gold rate" }, { status: 500 });
  }
}
