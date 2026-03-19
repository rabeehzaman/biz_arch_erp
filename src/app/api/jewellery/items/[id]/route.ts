import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { calculateNetWeight, calculateFineWeight } from "@/lib/jewellery/purity-rates";
import { calculatePricing, type PricingBreakdown } from "@/lib/jewellery/pricing-engine";

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

    const item = await prisma.jewelleryItem.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        stoneDetails: true,
        supplier: true,
        karigar: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Calculate live price from today's gold rate if available
    let livePrice: PricingBreakdown | null = null;

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const todayRate = await prisma.goldRate.findFirst({
      where: {
        organizationId,
        purity: item.purity,
        metalType: item.metalType,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { date: "desc" },
    });

    if (todayRate) {
      const netWeight = Number(item.netWeight);
      const sellRate = Number(todayRate.sellRate);

      livePrice = calculatePricing({
        netWeight,
        purity: item.purity,
        goldRate: sellRate,
        wastagePercent: Number(item.wastagePercent),
        makingChargeType: item.makingChargeType as "PER_GRAM" | "PERCENTAGE" | "FIXED",
        makingChargeValue: Number(item.makingChargeValue),
        stoneValue: Number(item.stoneValue),
      });
    }

    return NextResponse.json({ ...item, livePrice });
  } catch (error) {
    console.error("Failed to fetch jewellery item:", error);
    return NextResponse.json({ error: "Failed to fetch jewellery item" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);
    const { id } = await params;

    const existing = await prisma.jewelleryItem.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Passthrough fields
    const directFields = [
      "tagNumber", "categoryId", "metalType", "purity",
      "makingChargeType", "makingChargeValue", "huidNumber", "hallmarkNumber",
      "sasoMark", "sasoAssayerCode", "sasoYear", "isConsignment",
      "consignmentSupplierId", "costPrice", "goldRateAtPurchase", "stoneValue",
      "supplierId", "karigarId", "branchId", "warehouseId", "photoUrls", "notes",
    ];

    for (const field of directFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Recalculate derived weights if weight/purity fields change
    const grossWeight = body.grossWeight !== undefined ? Number(body.grossWeight) : Number(existing.grossWeight);
    const stoneWeight = body.stoneWeight !== undefined ? Number(body.stoneWeight) : Number(existing.stoneWeight);
    const wastagePercent = body.wastagePercent !== undefined ? Number(body.wastagePercent) : Number(existing.wastagePercent);
    const purity = body.purity !== undefined ? body.purity : existing.purity;

    const weightFieldsChanged =
      body.grossWeight !== undefined ||
      body.stoneWeight !== undefined ||
      body.wastagePercent !== undefined ||
      body.purity !== undefined;

    if (weightFieldsChanged) {
      const netWeight = calculateNetWeight(grossWeight, stoneWeight);
      const fineWeight = calculateFineWeight(netWeight, purity);
      const wastageWeight = Math.round(netWeight * (wastagePercent / 100) * 1000) / 1000;

      updateData.grossWeight = grossWeight;
      updateData.stoneWeight = stoneWeight;
      updateData.netWeight = netWeight;
      updateData.fineWeight = fineWeight;
      updateData.wastagePercent = wastagePercent;
      updateData.wastageWeight = wastageWeight;
    }

    const updated = await prisma.jewelleryItem.update({
      where: { id },
      data: updateData,
      include: { category: true, stoneDetails: true },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Failed to update jewellery item:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An item with this tag number or HUID already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Failed to update jewellery item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);
    const { id } = await params;

    const item = await prisma.jewelleryItem.findFirst({
      where: { id, organizationId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.status !== "IN_STOCK") {
      return NextResponse.json(
        { error: `Cannot delete item with status ${item.status}. Only IN_STOCK items can be deleted.` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Delete stone details first (cascade would handle it, but being explicit)
      await tx.stoneDetail.deleteMany({
        where: { jewelleryItemId: id },
      });

      // Delete the jewellery item
      await tx.jewelleryItem.delete({
        where: { id },
      });

      // Delete the linked product if it exists
      if (item.productId) {
        await tx.product.delete({
          where: { id: item.productId },
        }).catch(() => {
          // Product may have other references; ignore if deletion fails
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete jewellery item:", error);
    return NextResponse.json({ error: "Failed to delete jewellery item" }, { status: 500 });
  }
}
