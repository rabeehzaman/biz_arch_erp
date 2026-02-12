import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createStockLotFromOpeningStock, recalculateFromDate, isBackdated, hasZeroCOGSItems } from "@/lib/inventory/fifo";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const openingStocks = await prisma.openingStock.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        stockLot: {
          select: { id: true, remainingQuantity: true },
        },
      },
    });
    return NextResponse.json(openingStocks);
  } catch (error) {
    console.error("Failed to fetch opening stocks:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening stocks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const body = await request.json();
    const { productId, quantity, unitCost, stockDate, notes } = body;

    if (!productId || !quantity || quantity <= 0 || !stockDate) {
      return NextResponse.json(
        { error: "Product, quantity, and stock date are required" },
        { status: 400 }
      );
    }

    const parsedStockDate = new Date(stockDate);
    const parsedQuantity = parseFloat(quantity);
    const parsedUnitCost = parseFloat(unitCost) || 0;

    // Check if opening stock already exists for this product
    const existingOpeningStock = await prisma.openingStock.findFirst({
      where: { productId, organizationId },
    });

    if (existingOpeningStock) {
      return NextResponse.json(
        { error: "Opening stock already exists for this product. Edit or delete the existing entry." },
        { status: 400 }
      );
    }

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the opening stock entry
      const openingStock = await tx.openingStock.create({
        data: {
          productId,
          quantity: parsedQuantity,
          unitCost: parsedUnitCost,
          stockDate: parsedStockDate,
          notes: notes || null,
          organizationId,
        },
        include: {
          product: true,
        },
      });

      // Create the stock lot
      await createStockLotFromOpeningStock(
        openingStock.id,
        productId,
        parsedQuantity,
        parsedUnitCost,
        parsedStockDate,
        tx,
        organizationId
      );

      // Check if this is backdated OR if there are zero-COGS items that need fixing
      const backdated = await isBackdated(productId, parsedStockDate, tx);
      const zeroCOGSDate = await hasZeroCOGSItems(productId, tx);

      if (backdated) {
        // Recalculate from opening stock date if backdated
        await recalculateFromDate(productId, parsedStockDate, tx);
      } else if (zeroCOGSDate) {
        // Recalculate from earliest zero-COGS date to fix those items
        await recalculateFromDate(productId, zeroCOGSDate, tx);
      }

      return openingStock;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create opening stock:", error);
    return NextResponse.json(
      { error: "Failed to create opening stock" },
      { status: 500 }
    );
  }
}
