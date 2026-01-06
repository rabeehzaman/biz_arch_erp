import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recalculateFromDate, getRecalculationStartDate } from "@/lib/inventory/fifo";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            stockLot: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase invoice" },
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
    const { status, invoiceDate, items } = body;

    const existingInvoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    // If only status is being updated
    if (status && !invoiceDate && !items) {
      const invoice = await prisma.purchaseInvoice.update({
        where: { id },
        data: { status },
      });
      return NextResponse.json(invoice);
    }

    // If date or items are being updated, we need to recalculate
    const oldDate = existingInvoice.invoiceDate;
    const newDate = invoiceDate ? new Date(invoiceDate) : oldDate;

    await prisma.$transaction(async (tx) => {
      // If items are being updated
      if (items) {
        // Delete old stock lots for this purchase
        await tx.stockLot.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        // Delete old items
        await tx.purchaseInvoiceItem.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        // Calculate new totals with item-level discounts
        const subtotal = items.reduce(
          (sum: number, item: { quantity: number; unitCost: number; discount?: number }) =>
            sum + item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
          0
        );
        const taxAmount = (subtotal * Number(existingInvoice.taxRate)) / 100;
        const total = subtotal + taxAmount;

        // Update invoice with new items
        await tx.purchaseInvoice.update({
          where: { id },
          data: {
            invoiceDate: newDate,
            subtotal,
            taxAmount,
            total,
            balanceDue: total - Number(existingInvoice.amountPaid),
            items: {
              create: items.map((item: {
                productId: string;
                description: string;
                quantity: number;
                unitCost: number;
                discount?: number;
              }) => ({
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitCost: item.unitCost,
                discount: item.discount || 0,
                total: item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
              })),
            },
          },
        });

        // Recreate stock lots
        const updatedInvoice = await tx.purchaseInvoice.findUnique({
          where: { id },
          include: { items: true },
        });

        if (updatedInvoice) {
          for (const item of updatedInvoice.items) {
            await tx.stockLot.create({
              data: {
                productId: item.productId,
                sourceType: "PURCHASE",
                purchaseInvoiceItemId: item.id,
                purchaseInvoiceId: id,
                lotDate: newDate,
                unitCost: item.unitCost,
                initialQuantity: item.quantity,
                remainingQuantity: item.quantity,
              },
            });
          }
        }

        // Recalculate FIFO for affected products
        const productIds = [...new Set(items.map((item: { productId: string }) => item.productId))];
        const recalcDate = getRecalculationStartDate(oldDate, newDate);

        for (const productId of productIds) {
          await recalculateFromDate(productId as string, recalcDate, tx);
        }
      } else if (invoiceDate) {
        // Only date is being updated
        await tx.purchaseInvoice.update({
          where: { id },
          data: { invoiceDate: newDate },
        });

        // Update lot dates
        await tx.stockLot.updateMany({
          where: { purchaseInvoiceId: id },
          data: { lotDate: newDate },
        });

        // Recalculate FIFO for affected products
        const productIds = existingInvoice.items.map((item) => item.productId);
        const recalcDate = getRecalculationStartDate(oldDate, newDate);

        for (const productId of productIds) {
          await recalculateFromDate(productId, recalcDate, tx);
        }
      }
    });

    const updatedInvoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error("Failed to update purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to update purchase invoice" },
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

    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        stockLots: {
          include: {
            consumptions: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    // Check if any stock from this purchase has been consumed
    const hasConsumptions = invoice.stockLots.some(
      (lot) => lot.consumptions.length > 0
    );

    await prisma.$transaction(async (tx) => {
      const productIds = invoice.items.map((item) => item.productId);
      const invoiceDate = invoice.invoiceDate;

      // Delete stock lots (will cascade delete consumptions)
      await tx.stockLot.deleteMany({
        where: { purchaseInvoiceId: id },
      });

      // Update supplier balance
      const unpaidAmount = Number(invoice.total) - Number(invoice.amountPaid);
      if (unpaidAmount > 0) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: {
            balance: { decrement: unpaidAmount },
          },
        });
      }

      // Delete the invoice (items will cascade)
      await tx.purchaseInvoice.delete({
        where: { id },
      });

      // If there were consumptions, recalculate FIFO for affected products
      if (hasConsumptions) {
        for (const productId of productIds) {
          await recalculateFromDate(productId, invoiceDate, tx);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase invoice" },
      { status: 500 }
    );
  }
}
