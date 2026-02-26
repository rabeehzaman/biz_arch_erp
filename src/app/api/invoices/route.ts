import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { consumeStockFIFO, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";
import { syncInvoiceRevenueJournal, syncInvoiceCOGSJournal } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";

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

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    const isAdmin = session.user.role === "admin";

    const invoices = await prisma.invoice.findMany({
      where: isAdmin ? { organizationId } : {
        organizationId,
        customer: {
          assignments: {
            some: { userId }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, issueDate, dueDate, items, notes, terms } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    if (!issueDate || !dueDate) {
      return NextResponse.json(
        { error: "Issue date and due date are required" },
        { status: 400 }
      );
    }

    const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
    for (const item of items) {
      if (item.gstRate !== undefined && item.gstRate !== null && !VALID_GST_RATES.includes(Number(item.gstRate))) {
        return NextResponse.json(
          { error: `Invalid GST rate: ${item.gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const invoiceNumber = await generateInvoiceNumber(organizationId);
    const invoiceDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate subtotal with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
        sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      0
    );

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Fetch org GST info and customer GST info
      const orgGST = await getOrgGSTInfo(tx, organizationId);
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { gstin: true, gstStateCode: true },
      });

      // Compute GST per line item
      // NOTE: We do not multiply discount amount by conversionFactor here because unitPrice should conceptually be for the selected unit.
      const lineItems = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }) => ({
        taxableAmount: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        gstRate: item.gstRate || 0,
        hsnCode: item.hsnCode || null,
      }));
      const gstResult = computeDocumentGST(orgGST, lineItems, customer?.gstin, customer?.gstStateCode);
      const totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      const total = subtotal + totalTax;
      const balanceDue = total;

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          customerId,
          createdById: userId,
          issueDate: invoiceDate,
          dueDate: new Date(dueDate),
          subtotal,
          total,
          balanceDue,
          totalCgst: gstResult.totalCgst,
          totalSgst: gstResult.totalSgst,
          totalIgst: gstResult.totalIgst,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
          notes: notes || null,
          terms: terms || null,
          items: {
            create: items.map((item: {
              productId?: string;
              description: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
              gstRate?: number;
              hsnCode?: string;
              unitId?: string;
              conversionFactor?: number;
            }, idx: number) => ({
              organizationId,
              productId: item.productId || null,
              description: item.description,
              quantity: item.quantity,
              unitId: item.unitId || null,
              conversionFactor: item.conversionFactor || 1,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
              hsnCode: gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null,
              gstRate: gstResult.lineGST[idx]?.gstRate || 0,
              cgstRate: gstResult.lineGST[idx]?.cgstRate || 0,
              sgstRate: gstResult.lineGST[idx]?.sgstRate || 0,
              igstRate: gstResult.lineGST[idx]?.igstRate || 0,
              cgstAmount: gstResult.lineGST[idx]?.cgstAmount || 0,
              sgstAmount: gstResult.lineGST[idx]?.sgstAmount || 0,
              igstAmount: gstResult.lineGST[idx]?.igstAmount || 0,
              costOfGoodsSold: 0, // Will be updated below
            })),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Collect warnings from FIFO consumption
      const warnings: string[] = [];

      // Get unique product IDs to check for backdating
      const productIds = items
        .filter((item: { productId?: string }) => item.productId)
        .map((item: { productId: string }) => item.productId);
      const uniqueProductIds: string[] = [...new Set<string>(productIds)];

      // OPTIMIZATION: Check if any products are backdated before consuming
      const backdatedProducts = new Set<string>();
      for (const productId of uniqueProductIds) {
        const backdated = await isBackdated(productId, invoiceDate, tx);
        if (backdated) {
          backdatedProducts.add(productId);
        }
      }

      // Consume stock for each item with a productId
      // If product is backdated, skip individual consumption (will be handled by recalculation)
      for (const invoiceItem of invoice.items) {
        if (invoiceItem.productId) {
          if (!backdatedProducts.has(invoiceItem.productId)) {
            // Calculate base quantity to consume based on conversionFactor
            const baseQuantity = Number(invoiceItem.quantity) * Number(invoiceItem.conversionFactor);

            // Normal flow: consume stock and update COGS
            const fifoResult = await consumeStockFIFO(
              invoiceItem.productId,
              baseQuantity,
              invoiceItem.id,
              invoiceDate,
              tx,
              organizationId
            );

            // Update the invoice item with COGS
            await tx.invoiceItem.update({
              where: { id: invoiceItem.id },
              data: { costOfGoodsSold: fifoResult.totalCOGS },
            });

            // Collect any warnings
            if (fifoResult.warnings.length > 0) {
              warnings.push(...fifoResult.warnings);
            }
          }
          // If backdated, COGS remains 0 and will be set by recalculation
        }
      }

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId, organizationId },
        data: {
          balance: { increment: total },
        },
      });

      // Create CustomerTransaction record for invoice
      await tx.customerTransaction.create({
        data: {
          organizationId,
          customerId,
          transactionType: "INVOICE",
          transactionDate: invoiceDate,
          amount: total, // Positive = debit (customer owes)
          description: `Invoice ${invoiceNumber}`,
          invoiceId: invoice.id,
          runningBalance: 0, // Will be recalculated if needed
        },
      });

      // Recalculate FIFO for backdated products
      for (const productId of backdatedProducts) {
        await recalculateFromDate(
          productId,
          invoiceDate,
          tx,
          "backdated_invoice",
          `Invoice created with date ${invoiceDate.toISOString().split("T")[0]}`,
          organizationId
        );
      }

      // Create journal entries using shared helpers
      await syncInvoiceRevenueJournal(tx, organizationId, invoice.id);
      await syncInvoiceCOGSJournal(tx, organizationId, invoice.id);

      // Fetch the updated invoice with COGS
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          items: true,
        },
      });

      return { invoice: updatedInvoice, warnings };
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    console.error("Failed to create invoice:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
