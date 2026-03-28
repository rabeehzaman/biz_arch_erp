import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createStockLotFromOpeningStock, recalculateFromDate, isBackdated, hasZeroCOGSItems } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";
import { toMidnightUTC } from "@/lib/date-utils";

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

async function createSingleOpeningStock(
  body: { productId: string; quantity: number; unitCost: number; stockDate: string; notes?: string; warehouseId?: string; deviceDetails?: any },
  organizationId: string
) {
  const { productId, quantity, unitCost, stockDate, notes, warehouseId, deviceDetails } = body;

  if (!productId || !quantity || quantity <= 0 || !stockDate) {
    return NextResponse.json(
      { error: "Product, quantity, and stock date are required" },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { multiBranchEnabled: true },
  });

  if (org?.multiBranchEnabled && !warehouseId) {
    return NextResponse.json(
      { error: "Warehouse is required when multi-branch is enabled" },
      { status: 400 }
    );
  }

  const parsedStockDate = toMidnightUTC(stockDate);
  const parsedQuantity = parseFloat(String(quantity));
  const parsedUnitCost = parseFloat(String(unitCost)) || 0;

  const existingOpeningStock = await prisma.openingStock.findFirst({
    where: { productId, organizationId, warehouseId: warehouseId || null },
  });

  if (existingOpeningStock) {
    return NextResponse.json(
      { error: "Opening stock already exists for this product. Edit or delete the existing entry." },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
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
      include: { product: true },
    });

    await createStockLotFromOpeningStock(
      openingStock.id, productId, parsedQuantity, parsedUnitCost,
      parsedStockDate, tx, organizationId, warehouseId || null
    );

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
            mrp: imeiEntry.mrp ? Number(imeiEntry.mrp) : 0,
            landedCost: 0,
            sellingPrice: 0,
            photoUrls: [],
            currentStatus: "IN_STOCK",
          },
        });
      }
    }

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

    const backdated = await isBackdated(productId, parsedStockDate, tx);
    const zeroCOGSDate = await hasZeroCOGSItems(productId, tx);

    let recalcDate = null;
    if (backdated) recalcDate = parsedStockDate;
    if (zeroCOGSDate) {
      recalcDate = recalcDate ? (recalcDate < zeroCOGSDate ? recalcDate : zeroCOGSDate) : zeroCOGSDate;
    }

    if (recalcDate) {
      await recalculateFromDate(productId, recalcDate, tx, "opening_stock_added", undefined, organizationId);
    }

    return openingStock;
  }, { timeout: 60000 });

  return NextResponse.json(result, { status: 201 });
}

async function createBatchOpeningStock(
  body: { stockDate: string; warehouseId?: string; items: any[] },
  organizationId: string
) {
  const { stockDate, warehouseId, items } = body;

  if (!stockDate) {
    return NextResponse.json({ error: "Stock date is required" }, { status: 400 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { multiBranchEnabled: true },
  });

  if (org?.multiBranchEnabled && !warehouseId) {
    return NextResponse.json(
      { error: "Warehouse is required when multi-branch is enabled" },
      { status: 400 }
    );
  }

  // Validate each item
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return NextResponse.json(
        { error: "Each item must have a product and quantity > 0" },
        { status: 400 }
      );
    }
  }

  // Check for within-batch duplicates
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.productId}|${warehouseId || ""}`;
    if (seen.has(key)) {
      return NextResponse.json(
        { error: "Duplicate product found in batch. Each product can only appear once." },
        { status: 400 }
      );
    }
    seen.add(key);
  }

  // Check for existing opening stocks
  const productIds = items.map((item: any) => item.productId);
  const existingStocks = await prisma.openingStock.findMany({
    where: {
      organizationId,
      productId: { in: productIds },
      warehouseId: warehouseId || null,
    },
    include: { product: { select: { name: true } } },
  });

  if (existingStocks.length > 0) {
    const names = existingStocks.map((s) => s.product.name).join(", ");
    return NextResponse.json(
      { error: `Opening stock already exists for: ${names}. Edit or delete existing entries.` },
      { status: 400 }
    );
  }

  const parsedStockDate = toMidnightUTC(stockDate);

  const results = await prisma.$transaction(async (tx) => {
    const created = [];
    const recalcNeeds = new Map<string, Date>();

    for (const item of items) {
      const parsedQuantity = parseFloat(String(item.quantity));
      const parsedUnitCost = parseFloat(String(item.unitCost)) || 0;

      const openingStock = await tx.openingStock.create({
        data: {
          productId: item.productId,
          quantity: parsedQuantity,
          unitCost: parsedUnitCost,
          stockDate: parsedStockDate,
          notes: item.notes || null,
          organizationId,
          warehouseId: warehouseId || null,
        },
        include: { product: true },
      });

      await createStockLotFromOpeningStock(
        openingStock.id, item.productId, parsedQuantity, parsedUnitCost,
        parsedStockDate, tx, organizationId, warehouseId || null
      );

      // Create MobileDevice records if provided
      if (item.deviceDetails && item.deviceDetails.imeiNumbers?.length > 0) {
        for (const imeiEntry of item.deviceDetails.imeiNumbers) {
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
              productId: item.productId,
              supplierId: item.deviceDetails.supplierId,
              inwardDate: parsedStockDate,
              costPrice: parsedUnitCost,
              mrp: imeiEntry.mrp ? Number(imeiEntry.mrp) : 0,
              landedCost: 0,
              sellingPrice: 0,
              photoUrls: [],
              currentStatus: "IN_STOCK",
            },
          });
        }
      }

      // Journal entry per item
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

      // Collect FIFO recalculation needs
      const backdated = await isBackdated(item.productId, parsedStockDate, tx);
      const zeroCOGSDate = await hasZeroCOGSItems(item.productId, tx);

      let recalcDate: Date | null = null;
      if (backdated) recalcDate = parsedStockDate;
      if (zeroCOGSDate) {
        recalcDate = recalcDate ? (recalcDate < zeroCOGSDate ? recalcDate : zeroCOGSDate) : zeroCOGSDate;
      }

      if (recalcDate) {
        const existing = recalcNeeds.get(item.productId);
        if (!existing || recalcDate < existing) {
          recalcNeeds.set(item.productId, recalcDate);
        }
      }

      created.push(openingStock);
    }

    // Run FIFO recalculations (deduplicated by product)
    for (const [productId, recalcDate] of recalcNeeds) {
      await recalculateFromDate(productId, recalcDate, tx, "opening_stock_added", undefined, organizationId);
    }

    return created;
  }, { timeout: 120000 });

  return NextResponse.json(results, { status: 201 });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);
    const body = await request.json();

    // Batch mode: { stockDate, warehouseId?, items: [...] }
    if (body.items && Array.isArray(body.items)) {
      return createBatchOpeningStock(body, organizationId);
    }

    // Single mode (legacy): { productId, quantity, unitCost, stockDate, ... }
    return createSingleOpeningStock(body, organizationId);
  } catch (error) {
    console.error("Failed to create opening stock:", error);
    return NextResponse.json(
      { error: "Failed to create opening stock" },
      { status: 500 }
    );
  }
}
