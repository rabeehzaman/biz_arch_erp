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

    // Verify product belongs to this org
    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [stockLots, openingStocks] = await Promise.all([
      // 1. Stock lots ordered by date asc
      prisma.stockLot.findMany({
        where: { productId: id, organizationId },
        orderBy: { lotDate: "asc" },
        include: {
          warehouse: { select: { name: true } },
          purchaseInvoice: { select: { purchaseInvoiceNumber: true } },
          openingStock: { select: { id: true } },
        },
      }),
      // 2. Opening stocks ordered by date desc
      prisma.openingStock.findMany({
        where: { productId: id, organizationId },
        orderBy: { stockDate: "desc" },
        include: {
          warehouse: { select: { name: true } },
        },
      }),
    ]);

    // Derive sourceReference for each lot
    const mappedLots = stockLots.map((lot) => {
      let sourceReference: string;
      switch (lot.sourceType) {
        case "PURCHASE":
          sourceReference =
            lot.purchaseInvoice?.purchaseInvoiceNumber || "Purchase";
          break;
        case "OPENING_STOCK":
          sourceReference = "Opening Stock";
          break;
        case "ADJUSTMENT":
          sourceReference = "Adjustment";
          break;
        case "CREDIT_NOTE":
          sourceReference = "Credit Note";
          break;
        case "STOCK_TRANSFER":
          sourceReference = "Stock Transfer";
          break;
        default:
          sourceReference = lot.sourceType;
      }

      return {
        id: lot.id,
        sourceType: lot.sourceType,
        lotDate: lot.lotDate,
        unitCost: Number(lot.unitCost),
        initialQuantity: Number(lot.initialQuantity),
        remainingQuantity: Number(lot.remainingQuantity),
        warehouseName: lot.warehouse?.name ?? null,
        sourceReference,
      };
    });

    // Compute summary
    let totalOnHand = 0;
    let totalValue = 0;
    let depletedLotCount = 0;

    for (const lot of mappedLots) {
      totalOnHand += lot.remainingQuantity;
      totalValue += lot.remainingQuantity * lot.unitCost;
      if (lot.remainingQuantity <= 0) {
        depletedLotCount++;
      }
    }

    return NextResponse.json({
      stockLots: mappedLots,
      openingStocks: openingStocks.map((os) => ({
        id: os.id,
        quantity: Number(os.quantity),
        unitCost: Number(os.unitCost),
        stockDate: os.stockDate,
        notes: os.notes,
        warehouseName: os.warehouse?.name ?? null,
      })),
      summary: {
        totalOnHand,
        totalValue,
        lotCount: mappedLots.length,
        depletedLotCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch product stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch product stock" },
      { status: 500 }
    );
  }
}
