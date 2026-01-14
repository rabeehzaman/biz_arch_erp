import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the purchase invoice with all items and related debit notes
    const purchaseInvoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        debitNotes: {
          include: {
            items: {
              where: {
                purchaseInvoiceItemId: {
                  not: null,
                },
              },
            },
          },
        },
      },
    });

    if (!purchaseInvoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    // Calculate returnable quantities for each item
    const returnableItemsPromises = purchaseInvoice.items.map(async (item) => {
      // Calculate total already returned for this item
      let totalReturned = new Decimal(0);

      for (const debitNote of purchaseInvoice.debitNotes) {
        for (const debitItem of debitNote.items) {
          if (debitItem.purchaseInvoiceItemId === item.id) {
            totalReturned = totalReturned.add(debitItem.quantity);
          }
        }
      }

      const originalQuantity = item.quantity;
      const notYetReturned = originalQuantity.sub(totalReturned);

      // Get current available stock for this product
      const stockLots = await prisma.stockLot.findMany({
        where: {
          productId: item.productId,
          remainingQuantity: { gt: 0 },
        },
        select: {
          remainingQuantity: true,
        },
      });

      const availableStock = stockLots.reduce(
        (sum, lot) => sum.add(lot.remainingQuantity),
        new Decimal(0)
      );

      // Returnable quantity is the minimum of:
      // 1. How much hasn't been returned yet
      // 2. How much stock is available
      const returnableQuantity = Decimal.min(notYetReturned, availableStock);

      return {
        id: item.id,
        purchaseInvoiceItemId: item.id,
        productId: item.productId,
        product: item.product,
        description: item.description,
        originalQuantity: originalQuantity.toNumber(),
        returnedQuantity: totalReturned.toNumber(),
        availableStock: availableStock.toNumber(),
        returnableQuantity: returnableQuantity.toNumber(),
        unitCost: item.unitCost.toNumber(),
        discount: item.discount.toNumber(),
        canReturn: returnableQuantity.gt(0),
        stockConstraint: availableStock.lt(notYetReturned), // True if stock is the limiting factor
      };
    });

    const returnableItems = await Promise.all(returnableItemsPromises);

    return NextResponse.json({
      purchaseInvoice: {
        id: purchaseInvoice.id,
        purchaseInvoiceNumber: purchaseInvoice.purchaseInvoiceNumber,
        invoiceDate: purchaseInvoice.invoiceDate,
        total: purchaseInvoice.total.toNumber(),
      },
      items: returnableItems,
    });
  } catch (error) {
    console.error("Failed to fetch returnable items:", error);
    return NextResponse.json(
      { error: "Failed to fetch returnable items" },
      { status: 500 }
    );
  }
}
