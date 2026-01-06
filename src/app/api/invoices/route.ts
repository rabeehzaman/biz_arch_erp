import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { consumeStockFIFO, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";

// Generate invoice number: INV-YYYYMMDD-XXX
async function generateInvoiceNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, issueDate, dueDate, items, taxRate, notes, terms } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    const invoiceNumber = await generateInvoiceNumber();
    const invoiceDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate totals with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
        sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;
    const balanceDue = total;

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          issueDate: invoiceDate,
          dueDate: new Date(dueDate),
          subtotal,
          taxRate: taxRate || 0,
          taxAmount,
          total,
          balanceDue,
          notes: notes || null,
          terms: terms || null,
          items: {
            create: items.map((item: {
              productId?: string;
              description: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
            }) => ({
              productId: item.productId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
              costOfGoodsSold: 0, // Will be updated below
            })),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Consume stock for each item with a productId
      for (const invoiceItem of invoice.items) {
        if (invoiceItem.productId) {
          const fifoResult = await consumeStockFIFO(
            invoiceItem.productId,
            invoiceItem.quantity,
            invoiceItem.id,
            invoiceDate,
            tx
          );

          // Update the invoice item with COGS
          await tx.invoiceItem.update({
            where: { id: invoiceItem.id },
            data: { costOfGoodsSold: fifoResult.totalCOGS },
          });
        }
      }

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          balance: { increment: total },
        },
      });

      // Check for backdated invoices and recalculate if needed
      const productIds = items
        .filter((item: { productId?: string }) => item.productId)
        .map((item: { productId: string }) => item.productId);

      for (const productId of productIds) {
        const backdated = await isBackdated(productId, invoiceDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, invoiceDate, tx);
        }
      }

      // Fetch the updated invoice with COGS
      return tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          items: true,
        },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
