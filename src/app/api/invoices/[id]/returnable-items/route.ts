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

    // Get the invoice with all items and related credit notes
    const invoice = await prisma.invoice.findUnique({
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
        creditNotes: {
          include: {
            items: {
              where: {
                invoiceItemId: {
                  not: null,
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Check access control
    if (session.user.role !== "admin") {
      const customerAssignment = await prisma.customerAssignment.findFirst({
        where: {
          customerId: invoice.customerId,
          userId: session.user.id,
        },
      });

      if (!customerAssignment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Calculate returnable quantities for each item
    const returnableItems = invoice.items.map((item) => {
      // Calculate total already returned for this item
      let totalReturned = new Decimal(0);

      for (const creditNote of invoice.creditNotes) {
        for (const creditItem of creditNote.items) {
          if (creditItem.invoiceItemId === item.id) {
            totalReturned = totalReturned.add(creditItem.quantity);
          }
        }
      }

      const originalQuantity = item.quantity;
      const returnableQuantity = originalQuantity.sub(totalReturned);

      // Calculate per-unit COGS
      const unitCOGS =
        item.quantity.gt(0)
          ? item.costOfGoodsSold.div(item.quantity)
          : new Decimal(0);

      return {
        id: item.id,
        invoiceItemId: item.id,
        productId: item.productId,
        product: item.product,
        description: item.description,
        originalQuantity: originalQuantity.toNumber(),
        returnedQuantity: totalReturned.toNumber(),
        returnableQuantity: returnableQuantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discount: item.discount.toNumber(),
        unitCOGS: unitCOGS.toNumber(),
        originalCOGS: unitCOGS.toNumber(), // For backward compatibility
        canReturn: returnableQuantity.gt(0),
      };
    });

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        total: invoice.total.toNumber(),
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
