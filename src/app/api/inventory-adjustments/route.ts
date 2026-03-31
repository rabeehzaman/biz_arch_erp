import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getProductStock } from "@/lib/inventory/fifo";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { toMidnightUTC } from "@/lib/date-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const adjustments = await prisma.inventoryAdjustment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: { select: { name: true, code: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(adjustments);
  } catch (error) {
    console.error("Failed to fetch stock takes:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock takes" },
      { status: 500 }
    );
  }
}

// POST creates a DRAFT stock take — no stock effects yet
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const body = await request.json();
    const { adjustmentDate, warehouseId, notes, items } = body;

    if (!adjustmentDate) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { multiBranchEnabled: true },
    });

    if (!warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required for stock take" },
        { status: 400 }
      );
    }

    // Validate items
    for (const item of items) {
      if (!item.productId) {
        return NextResponse.json({ error: "Each item must have a product" }, { status: 400 });
      }
      if (item.physicalQuantity === undefined || item.physicalQuantity < 0) {
        return NextResponse.json({ error: "Physical quantity must be >= 0" }, { status: 400 });
      }
    }

    const parsedDate = toMidnightUTC(adjustmentDate);

    const result = await prisma.$transaction(
      async (tx) => {
        const adjustmentNumber = await generateAutoNumber(
          tx.inventoryAdjustment,
          "adjustmentNumber",
          "ST",
          organizationId,
          tx
        );

        const adjustment = await tx.inventoryAdjustment.create({
          data: {
            adjustmentNumber,
            organizationId,
            adjustmentDate: parsedDate,
            notes: notes || null,
            warehouseId: warehouseId || null,
            status: "DRAFT",
          },
        });

        for (const item of items) {
          const physicalQty = parseFloat(String(item.physicalQuantity));

          // Get system quantity for this product
          const stockInfo = await getProductStock(item.productId, tx, warehouseId || null);
          const systemQty = stockInfo ? Number(stockInfo.totalQuantity) : 0;
          const avgCost = stockInfo && stockInfo.totalQuantity.gt(0)
            ? Number(stockInfo.totalValue.div(stockInfo.totalQuantity))
            : 0;

          // Calculate difference
          const diff = physicalQty - systemQty;
          const adjustmentType = diff >= 0 ? "INCREASE" : "DECREASE";
          const absQuantity = Math.abs(diff);

          // For increases, use product cost or user-provided cost
          const unitCost = item.unitCost !== undefined ? parseFloat(String(item.unitCost)) : avgCost;

          await tx.inventoryAdjustmentItem.create({
            data: {
              inventoryAdjustmentId: adjustment.id,
              organizationId,
              productId: item.productId,
              systemQuantity: systemQty,
              physicalQuantity: physicalQty,
              adjustmentType,
              quantity: absQuantity,
              unitCost: unitCost || 0,
              reason: item.reason || null,
            },
          });
        }

        return adjustment;
      },
      { timeout: 60000 }
    );

    const fullAdjustment = await prisma.inventoryAdjustment.findUnique({
      where: { id: result.id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: { select: { name: true, code: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(fullAdjustment, { status: 201 });
  } catch (error) {
    console.error("Failed to create stock take:", error);
    return NextResponse.json(
      { error: "Failed to create stock take" },
      { status: 500 }
    );
  }
}
