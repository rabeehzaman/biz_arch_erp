import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { calculateNetWeight, calculateFineWeight } from "@/lib/jewellery/purity-rates";

const PURITY_KARAT: Record<string, number> = {
  K24: 24,
  K22: 22,
  K21: 21,
  K18: 18,
  K14: 14,
  K9: 9,
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const metalType = searchParams.get("metalType");
    const purity = searchParams.get("purity");
    const status = searchParams.get("status");
    const consignment = searchParams.get("consignment");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId };

    if (category) where.categoryId = category;
    if (metalType) where.metalType = metalType;
    if (purity) where.purity = purity;
    if (status) where.status = status;
    if (consignment === "true") where.isConsignment = true;
    if (consignment === "false") where.isConsignment = false;
    if (search) {
      where.tagNumber = { contains: search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.jewelleryItem.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.jewelleryItem.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch jewellery items:", error);
    return NextResponse.json({ error: "Failed to fetch jewellery items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);

    const body = await request.json();
    const {
      tagNumber,
      categoryId,
      metalType = "GOLD",
      purity = "K22",
      grossWeight,
      stoneWeight = 0,
      makingChargeType = "PER_GRAM",
      makingChargeValue = 0,
      wastagePercent = 0,
      huidNumber,
      hallmarkNumber,
      sasoMark,
      sasoAssayerCode,
      sasoYear,
      isConsignment = false,
      consignmentSupplierId,
      costPrice = 0,
      goldRateAtPurchase = 0,
      stoneValue = 0,
      supplierId,
      karigarId,
      branchId,
      warehouseId,
      photoUrls,
      notes,
    } = body;

    if (!tagNumber || grossWeight === undefined) {
      return NextResponse.json(
        { error: "tagNumber and grossWeight are required" },
        { status: 400 }
      );
    }

    const numGrossWeight = Number(grossWeight);
    const numStoneWeight = Number(stoneWeight);
    const numWastagePercent = Number(wastagePercent);

    // Auto-calculate derived weights
    const netWeight = calculateNetWeight(numGrossWeight, numStoneWeight);
    const fineWeight = calculateFineWeight(netWeight, purity);
    const wastageWeight = Math.round(netWeight * (numWastagePercent / 100) * 1000) / 1000;

    const result = await prisma.$transaction(async (tx) => {
      // Create linked Product record
      const product = await tx.product.create({
        data: {
          name: `Jewellery #${tagNumber}`,
          price: 0,
          cost: costPrice,
          hsnCode: "7113",
          organizationId,
          isActive: true,
        },
      });

      // Create the jewellery item
      const item = await tx.jewelleryItem.create({
        data: {
          organizationId,
          tagNumber,
          categoryId: categoryId || null,
          metalType,
          purity,
          grossWeight: numGrossWeight,
          stoneWeight: numStoneWeight,
          netWeight,
          fineWeight,
          makingChargeType,
          makingChargeValue: Number(makingChargeValue),
          wastagePercent: numWastagePercent,
          wastageWeight,
          huidNumber: huidNumber || null,
          hallmarkNumber: hallmarkNumber || null,
          sasoMark: sasoMark || null,
          sasoAssayerCode: sasoAssayerCode || null,
          sasoYear: sasoYear || null,
          isConsignment,
          consignmentSupplierId: isConsignment ? (consignmentSupplierId || null) : null,
          costPrice: Number(costPrice),
          goldRateAtPurchase: Number(goldRateAtPurchase),
          stoneValue: Number(stoneValue),
          productId: product.id,
          supplierId: supplierId || null,
          karigarId: karigarId || null,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          photoUrls: photoUrls || [],
          notes: notes || null,
        },
        include: { category: true },
      });

      return item;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create jewellery item:", error);

    // Handle unique constraint violation (duplicate tag number)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An item with this tag number already exists in this organization" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Failed to create jewellery item" }, { status: 500 });
  }
}
