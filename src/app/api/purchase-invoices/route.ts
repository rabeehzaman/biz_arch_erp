import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { createStockLotFromPurchase, recalculateFromDate, isBackdated, hasZeroCOGSItems } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { syncPurchaseJournal } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { SAUDI_VAT_RATE, VATCategory } from "@/lib/saudi-vat/constants";
import { calculateLineVAT, LineVATResult } from "@/lib/saudi-vat/calculator";
import { toMidnightUTC } from "@/lib/date-utils";
import { calculateRoundOff, getOrganizationRoundOffMode } from "@/lib/round-off";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

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
    const { limit, offset, search } = parsePagination(request);

    const baseWhere = status && status !== "all"
      ? { status: status as never, organizationId }
      : { organizationId };

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { purchaseInvoiceNumber: { contains: search, mode: "insensitive" as const } },
            { supplier: { name: { contains: search, mode: "insensitive" as const } } },
            { supplierInvoiceRef: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : baseWhere;

    const [invoices, total] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          supplier: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.purchaseInvoice.count({ where }),
    ]);

    return paginatedResponse(invoices, total, offset + invoices.length < total);
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
    const { supplierId, invoiceDate, dueDate, supplierInvoiceRef, items, notes, branchId, warehouseId, isTaxInclusive, applyRoundOff } = body;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and items are required" },
        { status: 400 }
      );
    }

    const saudiEnabled = isSaudiEInvoiceEnabled(session);

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

    // Validate all items have productId (required for purchase invoices)
    const invalidItems = items.filter((item: { productId?: string }) => !item.productId);
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "All items must have a product selected" },
        { status: 400 }
      );
    }

    // Validate warehouse is provided when multi-branch is enabled
    const [org, roundOffMode] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { multiBranchEnabled: true, isTaxInclusivePrice: true },
      }),
      getOrganizationRoundOffMode(prisma, organizationId),
    ]);
    if (org?.multiBranchEnabled && !warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required when multi-branch is enabled" },
        { status: 400 }
      );
    }

    const purchaseInvoiceNumber = await generatePurchaseInvoiceNumber(organizationId);
    const purchaseDate = toMidnightUTC(invoiceDate);
    const taxInclusive = isTaxInclusive ?? (isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice);

    // Build per-line gross amounts and taxable amounts (for tax-inclusive pricing)
    const lineAmounts = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; vatRate?: number }) => {
      const grossAmount = item.quantity * item.unitCost * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    // Calculate subtotal (sum of tax-exclusive base amounts)
    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };
      let totalVat: number | null = null;
      let lineVATResults: LineVATResult[] = [];

      if (saudiEnabled) {
        // Saudi VAT: compute VAT per line using calculateLineVAT
        lineVATResults = items.map((item: { vatRate?: number; vatCategory?: string }, idx: number) => {
          const taxableAmount = lineAmounts[idx].taxableAmount;
          const vatRate = item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE;
          return calculateLineVAT({ taxableAmount, vatRate, vatCategory: item.vatCategory as VATCategory | undefined });
        });
        totalVat = lineVATResults.reduce((sum, r) => sum + r.vatAmount, 0);
        totalVat = Math.round(totalVat * 100) / 100;
      } else {
        // GST path
        const [orgGST, supplier] = await Promise.all([
          getOrgGSTInfo(tx, organizationId),
          tx.supplier.findUnique({
            where: { id: supplierId },
            select: { gstin: true, gstStateCode: true },
          }),
        ]);
        const lineItemsForGST = items.map(
          (item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
            taxableAmount: lineAmounts[idx].taxableAmount,
            gstRate: item.gstRate || 0,
            hsnCode: item.hsnCode || null,
          })
        );
        gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplier?.gstin, supplier?.gstStateCode);
      }

      const totalTax = totalVat !== null ? totalVat : gstResult.totalTax;
      const shouldApplyRoundOff = applyRoundOff === true && roundOffMode !== "NONE";
      const { roundOffAmount, roundedTotal } = calculateRoundOff(
        subtotal + totalTax,
        roundOffMode,
        shouldApplyRoundOff
      );
      const total = roundedTotal;
      const balanceDue = total;

      // Create the purchase invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          organizationId,
          purchaseInvoiceNumber,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          supplierId,
          invoiceDate: purchaseDate,
          dueDate: toMidnightUTC(dueDate),
          supplierInvoiceRef: supplierInvoiceRef || null,
          status: "RECEIVED",
          subtotal,
          totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
          totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
          totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
          placeOfSupply: saudiEnabled ? null : gstResult.placeOfSupply,
          isInterState: saudiEnabled ? false : gstResult.isInterState,
          totalVat: saudiEnabled ? totalVat : null,
          roundOffAmount,
          applyRoundOff: shouldApplyRoundOff,
          total,
          balanceDue,
          notes: notes || null,
          isTaxInclusive: isTaxInclusive ?? null,
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
              total: lineAmounts[index].taxableAmount,
              hsnCode: saudiEnabled ? null : (gstResult.lineGST[index]?.hsnCode || null),
              gstRate: saudiEnabled ? 0 : (gstResult.lineGST[index]?.gstRate || 0),
              cgstRate: saudiEnabled ? 0 : (gstResult.lineGST[index]?.cgstRate || 0),
              sgstRate: saudiEnabled ? 0 : (gstResult.lineGST[index]?.sgstRate || 0),
              igstRate: saudiEnabled ? 0 : (gstResult.lineGST[index]?.igstRate || 0),
              cgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[index]?.cgstAmount || 0),
              sgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[index]?.sgstAmount || 0),
              igstAmount: saudiEnabled ? 0 : (gstResult.lineGST[index]?.igstAmount || 0),
              vatRate: lineVATResults[index]?.vatRate ?? null,
              vatAmount: lineVATResults[index]?.vatAmount ?? null,
              vatCategory: lineVATResults[index]?.vatCategory ?? null,
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: { select: { id: true, name: true, isImeiTracked: true } },
            },
          },
        },
      });

      // Create stock lots for each item
      for (let index = 0; index < invoice.items.length; index++) {
        const item = invoice.items[index];
        // Inventory valuation must use the tax-exclusive amount when purchase prices include tax.
        const lineTaxableAmount = new Decimal(lineAmounts[index].taxableAmount);
        const netUnitCost = new Decimal(item.quantity).gt(0)
          ? lineTaxableAmount.div(new Decimal(item.quantity))
          : new Decimal(0);

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
          organizationId,
          warehouseId || null
        );
      }

      // Create MobileDevice records for IMEI-tracked items
      for (let i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];
        const originalItem = items[i];
        if (item.product?.isImeiTracked && originalItem.imeiNumbers?.length > 0) {
          for (const imeiEntry of originalItem.imeiNumbers) {
            await tx.mobileDevice.create({
              data: {
                organizationId,
                imei1: imeiEntry.imei1,
                imei2: imeiEntry.imei2 || null,
                serialNumber: imeiEntry.serialNumber || null,
                brand: imeiEntry.brand || item.product.name.split(" ")[0] || item.product.name,
                model: imeiEntry.model || item.product.name.split(" ").slice(1).join(" ") || item.product.name,
                color: imeiEntry.color || null,
                storageCapacity: imeiEntry.storageCapacity || null,
                ram: imeiEntry.ram || null,
                networkStatus: imeiEntry.networkStatus || "UNLOCKED",
                conditionGrade: imeiEntry.conditionGrade || "NEW",
                batteryHealthPercentage: imeiEntry.batteryHealthPercentage ?? null,
                productId: item.productId,
                supplierId,
                purchaseInvoiceId: invoice.id,
                inwardDate: purchaseDate,
                costPrice: Number(item.unitCost),
                mrp: imeiEntry.mrp ? Number(imeiEntry.mrp) : 0,
                landedCost: 0,
                sellingPrice: 0,
                photoUrls: [],
                currentStatus: "IN_STOCK",
              },
            });
          }
        }
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
