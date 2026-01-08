import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restoreStockFromConsumptions, recalculateFromDate, consumeStockFIFO, isBackdated } from "@/lib/inventory/fifo";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            lotConsumptions: true,
          },
        },
        payments: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
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
    const { customerId, issueDate, dueDate, taxRate, notes, terms, items } = body;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            lotConsumptions: true,
          },
        },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if any items have stock consumptions
    const hasConsumptions = existingInvoice.items.some(
      (item) => item.lotConsumptions.length > 0
    );

    await prisma.$transaction(async (tx) => {
      // Get products that had consumptions for FIFO recalculation
      const productsWithConsumptions = existingInvoice.items
        .filter((item) => item.lotConsumptions.length > 0)
        .map((item) => item.productId!)
        .filter(Boolean);

      // Restore stock from old consumptions
      for (const item of existingInvoice.items) {
        if (item.lotConsumptions.length > 0) {
          await restoreStockFromConsumptions(item.id, tx);
        }
      }

      // Delete old items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Calculate new totals with item-level discounts
      const subtotal = items.reduce(
        (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
          sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        0
      );
      const taxRateNum = taxRate || 0;
      const taxAmount = (subtotal * taxRateNum) / 100;
      const total = subtotal + taxAmount;

      // Calculate balance change for customer
      const oldTotal = Number(existingInvoice.total);
      const oldAmountPaid = Number(existingInvoice.amountPaid);
      const oldBalanceDue = oldTotal - oldAmountPaid;
      const newBalanceDue = total - oldAmountPaid;
      const balanceChange = newBalanceDue - oldBalanceDue;

      // Update invoice
      await tx.invoice.update({
        where: { id },
        data: {
          customerId,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          taxRate: taxRateNum,
          notes,
          terms,
          subtotal,
          taxAmount,
          total,
          balanceDue: newBalanceDue,
          items: {
            create: items.map((item: {
              productId: string;
              description: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
            }) => ({
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
            })),
          },
        },
      });

      // Update customer balance if changed
      if (balanceChange !== 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: { increment: balanceChange },
          },
        });

        // If customer changed, also update old customer's balance
        if (customerId !== existingInvoice.customerId) {
          await tx.customer.update({
            where: { id: existingInvoice.customerId },
            data: {
              balance: { decrement: oldBalanceDue },
            },
          });
        }
      } else if (customerId !== existingInvoice.customerId) {
        // Customer changed but total didn't - transfer balance
        await tx.customer.update({
          where: { id: existingInvoice.customerId },
          data: {
            balance: { decrement: oldBalanceDue },
          },
        });
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: { increment: newBalanceDue },
          },
        });
      }

      // Get the updated invoice with items
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      // Consume stock for each new item with a productId
      if (updatedInvoice) {
        const newInvoiceDate = new Date(issueDate);
        for (const invoiceItem of updatedInvoice.items) {
          if (invoiceItem.productId) {
            const fifoResult = await consumeStockFIFO(
              invoiceItem.productId,
              invoiceItem.quantity,
              invoiceItem.id,
              newInvoiceDate,
              tx
            );

            // Update the invoice item with COGS
            await tx.invoiceItem.update({
              where: { id: invoiceItem.id },
              data: { costOfGoodsSold: fifoResult.totalCOGS },
            });
          }
        }
      }

      // Recalculate FIFO for products that had consumptions or are backdated
      const allProductIds = new Set([
        ...productsWithConsumptions,
        ...items.map((item: { productId: string }) => item.productId),
      ]);

      for (const productId of allProductIds) {
        const backdated = await isBackdated(productId, new Date(issueDate), tx);
        if (hasConsumptions || backdated) {
          await recalculateFromDate(productId, existingInvoice.issueDate, tx);
        }
      }
    });

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
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

    // Get invoice with items and consumptions
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            lotConsumptions: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check which products had stock consumed
    const productsWithConsumptions = invoice.items
      .filter((item) => item.lotConsumptions.length > 0)
      .map((item) => ({
        productId: item.productId!,
        hasConsumptions: true,
      }));

    await prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of invoice.items) {
        if (item.lotConsumptions.length > 0) {
          await restoreStockFromConsumptions(item.id, tx);
        }
      }

      // Delete invoice (cascade will delete items and their consumptions)
      await tx.invoice.delete({
        where: { id },
      });

      // Update customer balance (subtract the unpaid amount)
      const unpaidAmount = Number(invoice.total) - Number(invoice.amountPaid);
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: {
          balance: { decrement: unpaidAmount },
        },
      });

      // Recalculate FIFO for affected products
      for (const { productId } of productsWithConsumptions) {
        await recalculateFromDate(productId, invoice.issueDate, tx);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
