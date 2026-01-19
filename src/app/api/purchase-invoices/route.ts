import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createStockLotFromPurchase, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";

// Generate purchase invoice number: PI-YYYYMMDD-XXX
async function generatePurchaseInvoiceNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PI-${dateStr}`;

  const lastInvoice = await prisma.purchaseInvoice.findFirst({
    where: { purchaseInvoiceNumber: { startsWith: prefix } },
    orderBy: { purchaseInvoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.purchaseInvoiceNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status && status !== "all" ? { status: status as never } : {};

    const invoices = await prisma.purchaseInvoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch purchase invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, invoiceDate, dueDate, supplierInvoiceRef, items, taxRate, notes } = body;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and items are required" },
        { status: 400 }
      );
    }

    // Validate all items have productId (required for purchase invoices)
    const invalidItems = items.filter((item: { productId?: string }) => !item.productId);
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "All items must have a product selected" },
        { status: 400 }
      );
    }

    const purchaseInvoiceNumber = await generatePurchaseInvoiceNumber();
    const purchaseDate = invoiceDate ? new Date(invoiceDate) : new Date();

    // Calculate totals with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitCost: number; discount?: number }) =>
        sum + item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;
    const balanceDue = total;

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the purchase invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          purchaseInvoiceNumber,
          supplierId,
          invoiceDate: purchaseDate,
          dueDate: new Date(dueDate),
          supplierInvoiceRef: supplierInvoiceRef || null,
          status: "RECEIVED",
          subtotal,
          taxRate: taxRate || 0,
          taxAmount,
          total,
          balanceDue,
          notes: notes || null,
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
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Create stock lots for each item
      for (const item of invoice.items) {
        // Calculate net unit cost after discount
        const discountFactor = new Decimal(1).minus(new Decimal(item.discount || 0).div(100));
        const netUnitCost = new Decimal(item.unitCost).mul(discountFactor);

        await createStockLotFromPurchase(
          item.id,
          invoice.id,
          item.productId,
          item.quantity,
          netUnitCost,
          purchaseDate,
          tx
        );
      }

      // Update supplier balance (Accounts Payable)
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          balance: { increment: total },
        },
      });

      // Check if this is a backdated purchase and recalculate if needed
      const productIds = [...new Set(items.map((item: { productId: string }) => item.productId))];
      for (const productId of productIds) {
        const backdated = await isBackdated(productId as string, purchaseDate, tx);
        if (backdated) {
          await recalculateFromDate(
            productId as string,
            purchaseDate,
            tx,
            "backdated_purchase",
            `Purchase invoice dated ${purchaseDate.toISOString().split("T")[0]}`
          );
        }
      }

      return invoice;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to create purchase invoice" },
      { status: 500 }
    );
  }
}
