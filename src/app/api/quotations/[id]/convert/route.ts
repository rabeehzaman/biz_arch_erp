import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { consumeStockFIFO, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";

// Generate invoice number: INV-YYYYMMDD-XXX
async function generateInvoiceNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix }, organizationId },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function POST(
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

    // Fetch quotation with items
    const quotation = await prisma.quotation.findUnique({
      where: { id, organizationId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Validate quotation status
    if (quotation.status === "CONVERTED") {
      return NextResponse.json(
        { error: "Quotation has already been converted to an invoice" },
        { status: 400 }
      );
    }

    if (quotation.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot convert a cancelled quotation" },
        { status: 400 }
      );
    }

    // Check if quotation is expired
    const now = new Date();
    if (now > quotation.validUntil) {
      return NextResponse.json(
        { error: "Cannot convert an expired quotation" },
        { status: 400 }
      );
    }

    // Use transaction for atomic operation
    const invoice = await prisma.$transaction(async (tx) => {
      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber(organizationId);
      const invoiceDate = new Date(); // Use current date for invoice
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Create invoice from quotation
      const newInvoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          customerId: quotation.customerId,
          issueDate: invoiceDate,
          dueDate: dueDate,
          subtotal: quotation.subtotal,
          taxRate: quotation.taxRate,
          taxAmount: quotation.taxAmount,
          total: quotation.total,
          balanceDue: quotation.total, // Initially, full amount is due
          notes: quotation.notes,
          terms: quotation.terms,
          items: {
            create: quotation.items.map((item) => ({
              organizationId,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Consume stock via FIFO for each item with a product
      for (const invoiceItem of newInvoice.items) {
        if (invoiceItem.productId) {
          const fifoResult = await consumeStockFIFO(
            invoiceItem.productId,
            Number(invoiceItem.quantity),
            invoiceItem.id,
            invoiceDate,
            tx,
            organizationId
          );

          // Update invoice item with COGS
          await tx.invoiceItem.update({
            where: { id: invoiceItem.id },
            data: { costOfGoodsSold: fifoResult.totalCOGS },
          });

          // Note: consumeStockFIFO already creates the stock lot consumptions
          // so we don't need to create them again here
        }
      }

      // Update customer balance
      await tx.customer.update({
        where: { id: quotation.customerId },
        data: {
          balance: {
            increment: quotation.total,
          },
        },
      });

      // Update quotation status
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          status: "CONVERTED",
          convertedInvoiceId: newInvoice.id,
          convertedAt: new Date(),
        },
      });

      // Check for backdated invoices and recalculate FIFO if needed
      const productIds = newInvoice.items
        .filter((item) => item.productId)
        .map((item) => item.productId as string);

      for (const productId of productIds) {
        const backdated = await isBackdated(productId, invoiceDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, invoiceDate, tx, "recalculation", undefined, organizationId);
        }
      }

      return newInvoice;
    });

    // Fetch complete invoice with relations
    const completeInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(completeInvoice, { status: 201 });
  } catch (error) {
    console.error("Failed to convert quotation:", error);
    return NextResponse.json(
      { error: "Failed to convert quotation to invoice" },
      { status: 500 }
    );
  }
}
