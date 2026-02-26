import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createStockLotFromPurchase, recalculateFromDate, isBackdated, hasZeroCOGSItems } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { syncPurchaseJournal } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";

// Generate purchase invoice number: PI-YYYYMMDD-XXX
async function generatePurchaseInvoiceNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PI-${dateStr}`;

  const lastInvoice = await prisma.purchaseInvoice.findFirst({
    where: { purchaseInvoiceNumber: { startsWith: prefix }, organizationId },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status && status !== "all"
      ? { status: status as never, organizationId }
      : { organizationId };

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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { supplierId, invoiceDate, dueDate, supplierInvoiceRef, items, notes } = body;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and items are required" },
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

    // Validate all items have productId (required for purchase invoices)
    const invalidItems = items.filter((item: { productId?: string }) => !item.productId);
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "All items must have a product selected" },
        { status: 400 }
      );
    }

    const purchaseInvoiceNumber = await generatePurchaseInvoiceNumber(organizationId);
    const purchaseDate = invoiceDate ? new Date(invoiceDate) : new Date();

    // Calculate subtotal with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitCost: number; discount?: number }) =>
        sum + item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
      0
    );

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Fetch org GST info and supplier GST details
      const orgGST = await getOrgGSTInfo(tx, organizationId);
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
        select: { gstin: true, gstStateCode: true },
      });

      // Build line items for GST computation
      // NOTE: We do not multiply discount amount by conversionFactor here because unitCost should conceptually be for the selected unit.
      const lineItemsForGST = items.map(
        (item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }) => ({
          taxableAmount: item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        })
      );

      // Compute GST
      const gstResult = computeDocumentGST(
        orgGST,
        lineItemsForGST,
        supplier?.gstin,
        supplier?.gstStateCode
      );

      const total = subtotal + gstResult.totalTax;
      const balanceDue = total;

      // Create the purchase invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          organizationId,
          purchaseInvoiceNumber,
          supplierId,
          invoiceDate: purchaseDate,
          dueDate: new Date(dueDate),
          supplierInvoiceRef: supplierInvoiceRef || null,
          status: "RECEIVED",
          subtotal,
          totalCgst: gstResult.totalCgst,
          totalSgst: gstResult.totalSgst,
          totalIgst: gstResult.totalIgst,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
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
              gstRate?: number;
              hsnCode?: string;
              unitId?: string;
              conversionFactor?: number;
            }, index: number) => ({
              organizationId,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitId: item.unitId || null,
              conversionFactor: item.conversionFactor || 1,
              unitCost: item.unitCost,
              discount: item.discount || 0,
              total: item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
              hsnCode: gstResult.lineGST[index].hsnCode,
              gstRate: gstResult.lineGST[index].gstRate,
              cgstRate: gstResult.lineGST[index].cgstRate,
              sgstRate: gstResult.lineGST[index].sgstRate,
              igstRate: gstResult.lineGST[index].igstRate,
              cgstAmount: gstResult.lineGST[index].cgstAmount,
              sgstAmount: gstResult.lineGST[index].sgstAmount,
              igstAmount: gstResult.lineGST[index].igstAmount,
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
        // Calculate net unit cost after discount (per unit purchased)
        const discountFactor = new Decimal(1).minus(new Decimal(item.discount || 0).div(100));
        const netUnitCost = new Decimal(item.unitCost).mul(discountFactor);

        // Calculate base unit cost (purchase price / conversion factor)
        const baseUnitCost = netUnitCost.div(new Decimal(item.conversionFactor));

        // Create stock lot with base quantity
        const baseQuantity = Number(item.quantity) * Number(item.conversionFactor);

        await createStockLotFromPurchase(
          item.id,
          invoice.id,
          item.productId,
          baseQuantity,
          baseUnitCost, // Store base unit cost for accurate COGS
          purchaseDate,
          tx,
          Number(baseUnitCost), // Original gross base unit cost equivalent (less important but passing down)
          organizationId
        );
      }

      // Update supplier balance (Accounts Payable)
      await tx.supplier.update({
        where: { id: supplierId, organizationId },
        data: {
          balance: { increment: total },
        },
      });

      // Create SupplierTransaction record for purchase invoice
      await tx.supplierTransaction.create({
        data: {
          organizationId,
          supplierId,
          transactionType: "PURCHASE_INVOICE",
          transactionDate: purchaseDate,
          amount: total, // Positive = we owe supplier more
          description: `Purchase Invoice ${purchaseInvoiceNumber}`,
          purchaseInvoiceId: invoice.id,
          runningBalance: 0, // Will be recalculated if needed
        },
      });

      // Create purchase journal entry using shared helper
      await syncPurchaseJournal(tx, organizationId, invoice.id);

      // Check if this is a backdated purchase OR if there are zero-COGS items that need fixing
      const productIds = [...new Set(items.map((item: { productId: string }) => item.productId))];
      for (const productId of productIds) {
        // Check if backdated (purchase before existing sales)
        const backdated = await isBackdated(productId as string, purchaseDate, tx);

        // Check if there are earlier zero-COGS items (sales before this purchase)
        const zeroCOGSDate = await hasZeroCOGSItems(productId as string, tx);

        if (backdated) {
          // Recalculate from purchase date if backdated
          await recalculateFromDate(
            productId as string,
            purchaseDate,
            tx,
            "backdated_purchase",
            `Purchase invoice dated ${purchaseDate.toISOString().split("T")[0]}`,
            organizationId
          );
        } else if (zeroCOGSDate) {
          // Recalculate from earliest zero-COGS date to fix those items
          await recalculateFromDate(
            productId as string,
            zeroCOGSDate,
            tx,
            "zero_cogs_fix",
            `Fixing zero-COGS items with new purchase`,
            organizationId
          );
        }
      }

      return invoice;
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to create purchase invoice" },
      { status: 500 }
    );
  }
}
