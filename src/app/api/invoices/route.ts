import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { consumeStockFIFO, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";
import { syncInvoiceRevenueJournal, syncInvoiceCOGSJournal } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { calculateLineVAT, calculateDocumentVAT, determineSaudiInvoiceType, LineVATResult } from "@/lib/saudi-vat/calculator";
import { generateTLVQRCode } from "@/lib/saudi-vat/qr-code";
import { generateInvoiceUUID, computeInvoiceHash, getNextICV, getLastInvoiceHash } from "@/lib/saudi-vat/invoice-hash";
import { SAUDI_VAT_RATE, VATCategory } from "@/lib/saudi-vat/constants";

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
    const { customerId, issueDate, dueDate, items, notes, terms, branchId, warehouseId } = body;

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

    // Validate warehouse is provided when multi-branch is enabled
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { multiBranchEnabled: true, saudiEInvoiceEnabled: true, vatNumber: true, arabicName: true, name: true },
    });
    if (org?.multiBranchEnabled && !warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required when multi-branch is enabled" },
        { status: 400 }
      );
    }

    const saudiEnabled = isSaudiEInvoiceEnabled(session) || org?.saudiEInvoiceEnabled;

    if (!saudiEnabled) {
      const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
      for (const item of items) {
        if (item.gstRate !== undefined && item.gstRate !== null && !VALID_GST_RATES.includes(Number(item.gstRate))) {
          return NextResponse.json(
            { error: `Invalid GST rate: ${item.gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
            { status: 400 }
          );
        }
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
      // ── Saudi VAT path ────────────────────────────────────────────────────
      let totalTax = 0;
      let totalVat: number | null = null;
      let saudiInvoiceType: string | null = null;
      let qrCodeData: string | null = null;
      let invoiceUuid: string | null = null;
      let invoiceCounterValue: number | null = null;
      let previousInvoiceHash: string | null = null;
      let invoiceHash: string | null = null;
      let lineVATResults: LineVATResult[] = [];

      // GST path vars
      let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };

      if (saudiEnabled) {
        // Fetch customer VAT number for invoice type determination
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { vatNumber: true },
        });
        saudiInvoiceType = determineSaudiInvoiceType(customer?.vatNumber);

        // Compute VAT per line
        lineVATResults = items.map((item: { quantity: number; unitPrice: number; discount?: number; vatRate?: number; vatCategory?: string }) => {
          const taxableAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
          const vatRate = item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE;
          return calculateLineVAT({ taxableAmount, vatRate, vatCategory: item.vatCategory as VATCategory | undefined });
        });

        const docVAT = calculateDocumentVAT(lineVATResults);
        totalVat = docVAT.totalVat;
        totalTax = totalVat;

        // Generate Saudi invoice metadata
        invoiceUuid = generateInvoiceUUID();
        invoiceCounterValue = await getNextICV(tx as unknown as Parameters<typeof getNextICV>[0], organizationId);
        previousInvoiceHash = await getLastInvoiceHash(tx as unknown as Parameters<typeof getLastInvoiceHash>[0], organizationId);

        const sellerName = org?.arabicName || org?.name || "";
        const sellerVat = org?.vatNumber || "";
        const timestamp = invoiceDate.toISOString();
        const totalInclVat = (subtotal + totalVat).toFixed(2);
        const vatStr = totalVat.toFixed(2);

        invoiceHash = computeInvoiceHash({
          invoiceNumber,
          issueDate: timestamp,
          sellerVatNumber: sellerVat,
          totalInclVat,
          totalVat: vatStr,
        });

        // Generate QR code (mandatory for simplified, include for standard too)
        if (sellerVat) {
          const tlv = generateTLVQRCode({
            sellerName,
            vatNumber: sellerVat,
            timestamp,
            totalWithVat: totalInclVat,
            totalVat: vatStr,
          });
          qrCodeData = tlv;
        }
      } else {
        // ── GST path ────────────────────────────────────────────────────────
        const orgGST = await getOrgGSTInfo(tx, organizationId);
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { gstin: true, gstStateCode: true },
        });
        const lineItems = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string }) => ({
          taxableAmount: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItems, customer?.gstin, customer?.gstStateCode);
        totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      }

      const total = subtotal + totalTax;
      const balanceDue = total;

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
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
          // Saudi fields
          saudiInvoiceType,
          totalVat,
          qrCodeData,
          invoiceUuid,
          invoiceCounterValue,
          previousInvoiceHash,
          invoiceHash,
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
              vatRate?: number;
              vatCategory?: string;
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
              // Saudi VAT per line
              vatRate: lineVATResults[idx]?.vatRate ?? null,
              vatAmount: lineVATResults[idx]?.vatAmount ?? null,
              vatCategory: lineVATResults[idx]?.vatCategory ?? null,
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
              organizationId,
              warehouseId || null
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

      // Mark MobileDevices as SOLD for IMEI-tracked items
      for (let i = 0; i < invoice.items.length; i++) {
        const invoiceItem = invoice.items[i];
        const originalItem = items[i];
        if (invoiceItem.productId && originalItem.selectedImeis?.length > 0) {
          for (const imei of originalItem.selectedImeis) {
            await tx.mobileDevice.updateMany({
              where: {
                organizationId,
                imei1: imei,
                currentStatus: "IN_STOCK",
              },
              data: {
                currentStatus: "SOLD",
                customerId,
                salesInvoiceId: invoice.id,
                outwardDate: invoiceDate,
                soldPrice: invoiceItem.unitPrice,
                salespersonId: userId,
              },
            });
          }
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
