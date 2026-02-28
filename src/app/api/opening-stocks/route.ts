import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createStockLotFromOpeningStock, recalculateFromDate, isBackdated, hasZeroCOGSItems } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

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
        warehouse: {
          select: { id: true, name: true, code: true },
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
    const { productId, quantity, unitCost, stockDate, notes, warehouseId, deviceDetails } = body;

    if (!productId || !quantity || quantity <= 0 || !stockDate) {
      return NextResponse.json(
        { error: "Product, quantity, and stock date are required" },
        { status: 400 }
      );
    }

    const parsedStockDate = new Date(stockDate);
    const parsedQuantity = parseFloat(quantity);
    const parsedUnitCost = parseFloat(unitCost) || 0;

    // Check if opening stock already exists for this product+warehouse combo
    const existingOpeningStock = await prisma.openingStock.findFirst({
      where: { productId, organizationId, warehouseId: warehouseId || null },
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
          warehouseId: warehouseId || null,
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
        organizationId,
        warehouseId || null
      );

      // Create MobileDevice records if device details are provided
      if (deviceDetails && deviceDetails.imeiNumbers?.length > 0) {
        for (const imeiEntry of deviceDetails.imeiNumbers) {
          await tx.mobileDevice.create({
            data: {
              organizationId,
              imei1: imeiEntry.imei1,
              imei2: imeiEntry.imei2 || null,
              brand: imeiEntry.brand,
              model: imeiEntry.model,
              color: imeiEntry.color || null,
              storageCapacity: imeiEntry.storageCapacity || null,
              ram: imeiEntry.ram || null,
              networkStatus: "UNLOCKED",
              conditionGrade: imeiEntry.conditionGrade || "NEW",
              productId,
              supplierId: deviceDetails.supplierId,
              inwardDate: parsedStockDate,
              costPrice: parsedUnitCost,
              currentStatus: "IN_STOCK",
            },
          });
        }
      }

      // Create auto journal entry: DR Inventory, CR Owner's Capital (Opening Balance Equity)
      const totalValue = parsedQuantity * parsedUnitCost;
      if (totalValue > 0) {
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        const ownerCapitalAccount = await getSystemAccount(tx, organizationId, "3100");
        if (inventoryAccount && ownerCapitalAccount) {
          await createAutoJournalEntry(tx, organizationId, {
            date: parsedStockDate,
            description: `Opening Stock - ${openingStock.product.name}`,
            sourceType: "OPENING_BALANCE",
            sourceId: openingStock.id,
            lines: [
              { accountId: inventoryAccount.id, description: "Inventory", debit: totalValue, credit: 0 },
              { accountId: ownerCapitalAccount.id, description: "Opening Balance Equity", debit: 0, credit: totalValue },
            ],
          });
        }
      }

      // Check if this is backdated OR if there are zero-COGS items that need fixing
      const backdated = await isBackdated(productId, parsedStockDate, tx);
      const zeroCOGSDate = await hasZeroCOGSItems(productId, tx);

      if (backdated) {
        // Recalculate from opening stock date if backdated
        await recalculateFromDate(productId, parsedStockDate, tx, "backdated_opening_stock", undefined, organizationId);
      } else if (zeroCOGSDate) {
        // Recalculate from earliest zero-COGS date to fix those items
        await recalculateFromDate(productId, zeroCOGSDate, tx, "zero_cogs_fix", undefined, organizationId);
      }

      return openingStock;
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create opening stock:", error);
    return NextResponse.json(
      { error: "Failed to create opening stock" },
      { status: 500 }
    );
  }
}
