import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { recalculateFromDate, getRecalculationStartDate } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

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
    const openingStock = await prisma.openingStock.findUnique({
      where: { id, organizationId },
      include: {
        product: {
          include: {
            unit: true,
          },
        },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const { id } = await params;
    const body = await request.json();
    const { quantity, unitCost, stockDate, notes } = body;

    const existingOpeningStock = await prisma.openingStock.findUnique({
      where: { id, organizationId },
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
        where: { id, organizationId },
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

      // Auto-update product.cost to the new opening stock cost (fallback cost)
      await tx.product.update({
        where: { id: existingOpeningStock.productId },
        data: { cost: newUnitCost },
      });

      // Recalculate if date changed or quantity/cost changed
      const recalcDate = getRecalculationStartDate(oldDate, newDate);
      await recalculateFromDate(existingOpeningStock.productId, recalcDate, tx, "recalculation", undefined, organizationId);

      // Sync Journal Entry
      await tx.journalEntry.deleteMany({
        where: {
          sourceType: "OPENING_BALANCE",
          sourceId: id,
          organizationId,
        },
      });

      const totalValue = newQuantity * newUnitCost;
      if (totalValue > 0) {
        const product = await tx.product.findUnique({ where: { id: existingOpeningStock.productId } });
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        const ownerCapitalAccount = await getSystemAccount(tx, organizationId, "3100");
        if (inventoryAccount && ownerCapitalAccount && product) {
          await createAutoJournalEntry(tx, organizationId, {
            date: newDate,
            description: `Opening Stock - ${product.name}`,
            sourceType: "OPENING_BALANCE",
            sourceId: id,
            lines: [
              { accountId: inventoryAccount.id, description: "Inventory", debit: totalValue, credit: 0 },
              { accountId: ownerCapitalAccount.id, description: "Opening Balance Equity", debit: 0, credit: totalValue },
            ],
          });
        }
      }
    });

    const updatedOpeningStock = await prisma.openingStock.findUnique({
      where: { id, organizationId },
      include: {
        product: {
          include: {
            unit: true,
          },
        },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const { id } = await params;

    const openingStock = await prisma.openingStock.findUnique({
      where: { id, organizationId },
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
        where: { id, organizationId },
      });

      // If there were consumptions, recalculate FIFO
      if (hasConsumptions) {
        await recalculateFromDate(productId, stockDate, tx, "recalculation", undefined, organizationId);
      }

      // Delete associated journal entry
      await tx.journalEntry.deleteMany({
        where: {
          sourceType: "OPENING_BALANCE",
          sourceId: id,
          organizationId,
        },
      });
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
