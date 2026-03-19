import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { sellRate, buyRate } = body;

    if (sellRate === undefined && buyRate === undefined) {
      return NextResponse.json(
        { error: "At least one of sellRate or buyRate is required" },
        { status: 400 }
      );
    }

    // Verify the rate belongs to this org
    const existing = await prisma.goldRate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gold rate not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (sellRate !== undefined) updateData.sellRate = Number(sellRate);
    if (buyRate !== undefined) updateData.buyRate = Number(buyRate);

    const rate = await prisma.goldRate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(rate);
  } catch (error) {
    console.error("Failed to update gold rate:", error);
    return NextResponse.json(
      { error: "Failed to update gold rate" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    // Verify the rate belongs to this org
    const existing = await prisma.goldRate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gold rate not found" }, { status: 404 });
    }

    await prisma.goldRate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete gold rate:", error);
    return NextResponse.json(
      { error: "Failed to delete gold rate" },
      { status: 500 }
    );
  }
}
