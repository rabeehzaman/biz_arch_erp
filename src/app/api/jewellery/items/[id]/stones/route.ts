import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { calculateNetWeight, calculateFineWeight } from "@/lib/jewellery/purity-rates";

// 1 carat = 0.2 grams
const CARAT_TO_GRAMS = 0.2;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);
    const { id } = await params;

    // Verify item belongs to this org
    const item = await prisma.jewelleryItem.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const stones = await prisma.stoneDetail.findMany({
      where: { jewelleryItemId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(stones);
  } catch (error) {
    console.error("Failed to fetch stone details:", error);
    return NextResponse.json({ error: "Failed to fetch stone details" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);
    const { id } = await params;

    // Verify item belongs to this org
    const item = await prisma.jewelleryItem.findFirst({
      where: { id, organizationId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      stoneType = "DIAMOND",
      carat = 0,
      cut,
      color,
      clarity,
      weight = 0,
      value = 0,
      certificationNumber,
      certBody,
      serialNumber,
      isLot = false,
      lotCount,
    } = body;

    if (Number(weight) <= 0) {
      return NextResponse.json(
        { error: "Stone weight (in carats) is required and must be > 0" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the stone detail
      const stone = await tx.stoneDetail.create({
        data: {
          organizationId,
          jewelleryItemId: id,
          stoneType,
          carat: Number(carat),
          cut: cut || null,
          color: color || null,
          clarity: clarity || null,
          weight: Number(weight),
          value: Number(value),
          certificationNumber: certificationNumber || null,
          certBody: certBody || null,
          serialNumber: serialNumber || null,
          isLot,
          lotCount: isLot ? (lotCount || null) : null,
        },
      });

      // Recalculate parent item's stoneWeight from all stones
      const allStones = await tx.stoneDetail.findMany({
        where: { jewelleryItemId: id },
        select: { weight: true },
      });

      // Sum all stone weights (in carats) and convert to grams
      const totalStoneWeightGrams = allStones.reduce(
        (sum, s) => sum + Number(s.weight) * CARAT_TO_GRAMS,
        0
      );
      const roundedStoneWeight = Math.round(totalStoneWeightGrams * 1000) / 1000;

      // Recalculate netWeight and fineWeight
      const grossWeight = Number(item.grossWeight);
      const netWeight = calculateNetWeight(grossWeight, roundedStoneWeight);
      const fineWeight = calculateFineWeight(netWeight, item.purity);
      const wastageWeight = Math.round(netWeight * (Number(item.wastagePercent) / 100) * 1000) / 1000;

      // Also sum stone values for the stoneValue field
      const allStonesForValue = await tx.stoneDetail.findMany({
        where: { jewelleryItemId: id },
        select: { value: true },
      });
      const totalStoneValue = allStonesForValue.reduce(
        (sum, s) => sum + Number(s.value),
        0
      );

      await tx.jewelleryItem.update({
        where: { id },
        data: {
          stoneWeight: roundedStoneWeight,
          netWeight,
          fineWeight,
          wastageWeight,
          stoneValue: Math.round(totalStoneValue * 100) / 100,
        },
      });

      return stone;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to add stone detail:", error);
    return NextResponse.json({ error: "Failed to add stone detail" }, { status: 500 });
  }
}
