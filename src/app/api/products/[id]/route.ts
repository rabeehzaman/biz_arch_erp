import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id, organizationId },
      include: {
        unit: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { name, description, price, unitId, sku, barcode, isActive, isService, isImeiTracked, gstRate, hsnCode } = body;

    const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
    if (gstRate !== undefined && gstRate !== null && !VALID_GST_RATES.includes(Number(gstRate))) {
      return NextResponse.json(
        { error: `Invalid GST rate: ${gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id, organizationId },
      data: {
        name,
        description,
        price,
        unitId,
        sku,
        barcode,
        isActive,
        ...(isService !== undefined && { isService }),
        ...(isImeiTracked !== undefined && { isImeiTracked }),
        ...(hsnCode !== undefined && { hsnCode: hsnCode || null }),
        ...(gstRate !== undefined && { gstRate }),
      },
      include: {
        unit: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
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

    const organizationId = getOrgId(session);
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      // Delete mobile devices linked to this product
      await tx.mobileDevice.deleteMany({ where: { productId: id, organizationId } });

      // Find opening stocks to clean up their journal entries
      const openingStocks = await tx.openingStock.findMany({
        where: { productId: id, organizationId },
        select: { id: true },
      });
      const openingStockIds = openingStocks.map((o) => o.id);

      // Delete journal entries that were created from these opening stocks
      if (openingStockIds.length > 0) {
        const journalEntries = await tx.journalEntry.findMany({
          where: { sourceType: "OPENING_BALANCE", sourceId: { in: openingStockIds }, organizationId },
          select: { id: true },
        });
        const journalIds = journalEntries.map((j) => j.id);
        if (journalIds.length > 0) {
          await tx.journalEntryLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
          await tx.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
        }
      }

      // Delete stock lots and opening stocks
      await tx.stockLot.deleteMany({ where: { productId: id, organizationId } });
      await tx.openingStock.deleteMany({ where: { productId: id, organizationId } });

      await tx.product.delete({ where: { id, organizationId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
