import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createStockLotFromOpeningStock, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";

export async function GET() {
  try {
    const openingStocks = await prisma.openingStock.findMany({
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
      where: { productId },
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
        tx
      );

      // Check if this is backdated and recalculate if needed
      const backdated = await isBackdated(productId, parsedStockDate, tx);
      if (backdated) {
        await recalculateFromDate(productId, parsedStockDate, tx);
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
