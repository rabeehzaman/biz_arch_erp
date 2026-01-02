import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recalculateFromDate, getRecalculationStartDate } from "@/lib/inventory/fifo";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const openingStock = await prisma.openingStock.findUnique({
      where: { id },
      include: {
        product: true,
        stockLot: true,
      },
    });

    if (!openingStock) {
      return NextResponse.json(
        { error: "Opening stock not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(openingStock);
  } catch (error) {
    console.error("Failed to fetch opening stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening stock" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { quantity, unitCost, stockDate, notes } = body;

    const existingOpeningStock = await prisma.openingStock.findUnique({
      where: { id },
      include: { stockLot: true },
    });

    if (!existingOpeningStock) {
      return NextResponse.json(
        { error: "Opening stock not found" },
        { status: 404 }
      );
    }

    const oldDate = existingOpeningStock.stockDate;
    const newDate = stockDate ? new Date(stockDate) : oldDate;
    const newQuantity = parseFloat(quantity) || Number(existingOpeningStock.quantity);
    const newUnitCost = parseFloat(unitCost) ?? Number(existingOpeningStock.unitCost);

    await prisma.$transaction(async (tx) => {
      // Update opening stock entry
      await tx.openingStock.update({
        where: { id },
        data: {
          quantity: newQuantity,
          unitCost: newUnitCost,
          stockDate: newDate,
          notes: notes ?? existingOpeningStock.notes,
        },
      });

      // Update the associated stock lot
      if (existingOpeningStock.stockLot) {
        await tx.stockLot.update({
          where: { id: existingOpeningStock.stockLot.id },
          data: {
            lotDate: newDate,
            unitCost: newUnitCost,
            initialQuantity: newQuantity,
            // Adjust remaining quantity proportionally
            remainingQuantity: {
              increment: newQuantity - Number(existingOpeningStock.quantity),
            },
          },
        });
      }

      // Recalculate if date changed or quantity/cost changed
      const recalcDate = getRecalculationStartDate(oldDate, newDate);
      await recalculateFromDate(existingOpeningStock.productId, recalcDate, tx);
    });

    const updatedOpeningStock = await prisma.openingStock.findUnique({
      where: { id },
      include: {
        product: true,
        stockLot: true,
      },
    });

    return NextResponse.json(updatedOpeningStock);
  } catch (error) {
    console.error("Failed to update opening stock:", error);
    return NextResponse.json(
      { error: "Failed to update opening stock" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const openingStock = await prisma.openingStock.findUnique({
      where: { id },
      include: {
        stockLot: {
          include: {
            consumptions: true,
          },
        },
      },
    });

    if (!openingStock) {
      return NextResponse.json(
        { error: "Opening stock not found" },
        { status: 404 }
      );
    }

    const hasConsumptions = (openingStock.stockLot?.consumptions?.length ?? 0) > 0;
    const productId = openingStock.productId;
    const stockDate = openingStock.stockDate;

    await prisma.$transaction(async (tx) => {
      // Delete the stock lot first (will cascade delete consumptions)
      if (openingStock.stockLot) {
        await tx.stockLot.delete({
          where: { id: openingStock.stockLot.id },
        });
      }

      // Delete the opening stock entry
      await tx.openingStock.delete({
        where: { id },
      });

      // If there were consumptions, recalculate FIFO
      if (hasConsumptions) {
        await recalculateFromDate(productId, stockDate, tx);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete opening stock:", error);
    return NextResponse.json(
      { error: "Failed to delete opening stock" },
      { status: 500 }
    );
  }
}
