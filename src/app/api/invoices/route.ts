import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isSaudiEInvoiceEnabled, isTaxInclusivePrice as isTaxInclusivePriceSession } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { consumeStockFIFO, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";
import { syncInvoiceRevenueJournal, syncInvoiceCOGSJournal, syncJewellerySaleJournal } from "@/lib/accounting/journal";
import { createMetalLedgerEntry } from "@/lib/jewellery/metal-ledger";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { calculateLineVAT, calculateDocumentVAT, determineSaudiInvoiceType, LineVATResult } from "@/lib/saudi-vat/calculator";
import { generateTLVQRCode } from "@/lib/saudi-vat/qr-code";
import { generateInvoiceUUID, computeInvoiceHash, getNextICV, getLastInvoiceHash } from "@/lib/saudi-vat/invoice-hash";
import { SAUDI_VAT_RATE, VATCategory } from "@/lib/saudi-vat/constants";
import { toMidnightUTC } from "@/lib/date-utils";
import { calculateRoundOff, getOrganizationRoundOffMode } from "@/lib/round-off";
import { consumeBOMIngredientsForSale } from "@/lib/manufacturing/auto-consume";
import { isAdminRole } from "@/lib/access-control";
import { parsePagination, parseAdvancedSearch, paginatedResponse } from "@/lib/pagination";
import { getUserAllowedBranchIds, buildBranchWhereClause } from "@/lib/user-access";

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
    const isAdmin = isAdminRole(session.user.role);

    const { limit, offset, search } = parsePagination(request);
    const adv = parseAdvancedSearch(request);

    const allowedBranchIds = await getUserAllowedBranchIds(prisma, organizationId, userId!, session.user.role);
    if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
      return paginatedResponse([], 0, false);
    }
    const branchFilter = buildBranchWhereClause(allowedBranchIds, { includeNullBranch: true });

    const baseWhere: Record<string, unknown> = isAdmin ? { organizationId, ...branchFilter } : {
      organizationId,
      customer: {
        assignments: {
          some: { userId }
        }
      },
      ...branchFilter,
    };

    // Advanced search filters
    if (adv.invoiceNumber) baseWhere.invoiceNumber = { contains: adv.invoiceNumber, mode: "insensitive" };
    if (adv.customerId) baseWhere.customerId = adv.customerId;
    if (adv.paymentType) baseWhere.paymentType = adv.paymentType;
    if (adv.createdById) baseWhere.createdById = adv.createdById;
    if (adv.branchId) baseWhere.branchId = adv.branchId;
    if (adv.warehouseId) baseWhere.warehouseId = adv.warehouseId;
    if (adv.notes) baseWhere.notes = { contains: adv.notes, mode: "insensitive" };
    if (adv.issueDateFrom || adv.issueDateTo) {
      const issueDate: Record<string, Date> = {};
      if (adv.issueDateFrom) issueDate.gte = new Date(adv.issueDateFrom);
      if (adv.issueDateTo) issueDate.lte = new Date(adv.issueDateTo + "T23:59:59.999Z");
      baseWhere.issueDate = issueDate;
    }
    if (adv.dueDateFrom || adv.dueDateTo) {
      const dueDate: Record<string, Date> = {};
      if (adv.dueDateFrom) dueDate.gte = new Date(adv.dueDateFrom);
      if (adv.dueDateTo) dueDate.lte = new Date(adv.dueDateTo + "T23:59:59.999Z");
      baseWhere.dueDate = dueDate;
    }
    if (adv.totalMin || adv.totalMax) {
      const total: Record<string, number> = {};
      if (adv.totalMin) total.gte = parseFloat(adv.totalMin);
      if (adv.totalMax) total.lte = parseFloat(adv.totalMax);
      baseWhere.total = total;
    }
    // Status filter (computed from balanceDue/dueDate)
    if (adv.status === "paid") baseWhere.balanceDue = { lte: 0 };
    if (adv.status === "unpaid") baseWhere.balanceDue = { gt: 0 };
    if (adv.status === "overdue") {
      baseWhere.balanceDue = { gt: 0 };
      baseWhere.dueDate = { ...(baseWhere.dueDate as Record<string, Date> || {}), lt: new Date() };
    }

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { customer: { phone: { contains: search } } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : baseWhere;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          branch: {
            select: { id: true, name: true },
          },
          warehouse: {
            select: { id: true, name: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return paginatedResponse(invoices, total, offset + invoices.length < total);
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
    const { customerId, issueDate, dueDate, items, notes, terms, branchId, warehouseId, paymentType, isTaxInclusive, applyRoundOff, oldGoldAdjustmentId } = body;

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
    const [org, roundOffMode] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { multiBranchEnabled: true, saudiEInvoiceEnabled: true, vatNumber: true, arabicName: true, name: true, isTaxInclusivePrice: true },
      }),
      getOrganizationRoundOffMode(prisma, organizationId),
    ]);
    if (org?.multiBranchEnabled && !warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required when multi-branch is enabled" },
        { status: 400 }
      );
    }

    const saudiEnabled = isSaudiEInvoiceEnabled(session) || org?.saudiEInvoiceEnabled;
    const taxInclusive = isTaxInclusive ?? (isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice);

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
    const invoiceDate = toMidnightUTC(issueDate);

    // Build per-line gross amounts and taxable amounts (for tax-inclusive pricing)
    const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; vatRate?: number; gstRate?: number }) => {
      const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    // Calculate subtotal (sum of tax-exclusive base amounts)
    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

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

        // Compute VAT per line (using tax-exclusive base from lineAmounts)
        lineVATResults = items.map((item: { quantity: number; unitPrice: number; discount?: number; vatRate?: number; vatCategory?: string }, idx: number) => {
          const taxableAmount = lineAmounts[idx].taxableAmount;
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
        const totalInclVat = subtotal + (totalVat ?? 0);
        const totalInclVatStr = totalInclVat.toFixed(2);
        // ZATCA spec: timestamp = actual creation time (not just date), ISO 8601 with Z, no milliseconds
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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
            totalWithVat: totalInclVatStr,
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
        const lineItems = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string }, idx: number) => ({
          taxableAmount: lineAmounts[idx].taxableAmount,
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItems, customer?.gstin, customer?.gstStateCode);
        totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      }

      const shouldApplyRoundOff = applyRoundOff === true && roundOffMode !== "NONE";
      const { roundOffAmount, roundedTotal } = calculateRoundOff(
        subtotal + totalTax,
        roundOffMode,
        shouldApplyRoundOff
      );

      // Handle old gold adjustment
      let oldGoldDeductionAmount = 0;
      if (oldGoldAdjustmentId) {
        const oldGold = await tx.oldGoldPurchase.findFirst({
          where: { id: oldGoldAdjustmentId, organizationId, adjustedAgainstInvoiceId: null },
        });
        if (oldGold) {
          oldGoldDeductionAmount = Number(oldGold.totalValue);
        }
      }

      const total = Math.max(0, roundedTotal - oldGoldDeductionAmount);
      const balanceDue = total;

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          paymentType: paymentType || "CASH",
          customerId,
          createdById: userId,
          issueDate: invoiceDate,
          dueDate: toMidnightUTC(dueDate),
          subtotal,
          total,
          balanceDue,
          totalCgst: gstResult.totalCgst,
          totalSgst: gstResult.totalSgst,
          totalIgst: gstResult.totalIgst,
          roundOffAmount,
          applyRoundOff: shouldApplyRoundOff,
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
          isTaxInclusive: isTaxInclusive ?? null,
          oldGoldDeduction: oldGoldDeductionAmount,
          // Flag if any items are jewellery
          isJewellerySale: items.some((item: { jewellery?: unknown }) => !!item.jewellery),
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
              jewellery?: {
                jewelleryItemId: string;
                goldRate: number;
                purity: string;
                metalType: string;
                grossWeight: number;
                stoneWeight: number;
                wastagePercent: number;
                makingChargeType: string;
                makingChargeValue: number;
                stoneValue: number;
                tagNumber: string;
                huidNumber: string;
              };
            }, idx: number) => {
              const jw = item.jewellery;
              const netWeight = jw ? Math.max(0, jw.grossWeight - (jw.stoneWeight || 0)) : undefined;
              const PURITY_MULT: Record<string, number> = { K24: 1, K22: 22/24, K21: 21/24, K18: 18/24, K14: 14/24, K9: 9/24 };
              const fineWeight = jw && netWeight ? netWeight * (PURITY_MULT[jw.purity] ?? 1) : undefined;

              return {
                organizationId,
                productId: item.productId || null,
                description: item.description,
                quantity: item.quantity,
                unitId: item.unitId || null,
                conversionFactor: item.conversionFactor || 1,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                total: lineAmounts[idx].taxableAmount,
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
                // Jewellery fields (null when not jewellery)
                jewelleryItemId: jw?.jewelleryItemId ?? null,
                goldRate: jw?.goldRate ?? null,
                purity: jw?.purity ?? null,
                metalType: jw?.metalType ?? null,
                grossWeight: jw?.grossWeight ?? null,
                netWeight: netWeight ?? null,
                fineWeight: fineWeight ?? null,
                wastagePercent: jw?.wastagePercent ?? null,
                makingChargeType: jw?.makingChargeType ?? null,
                makingChargeValue: jw?.makingChargeValue ?? null,
                stoneValue: jw?.stoneValue ?? null,
                tagNumber: jw?.tagNumber ?? null,
                huidNumber: jw?.huidNumber ?? null,
              };
            }),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Mark jewellery items as SOLD
      const jewelleryItemIds = items
        .filter((item: { jewellery?: { jewelleryItemId: string } }) => item.jewellery?.jewelleryItemId)
        .map((item: { jewellery: { jewelleryItemId: string } }) => item.jewellery.jewelleryItemId);
      if (jewelleryItemIds.length > 0) {
        await tx.jewelleryItem.updateMany({
          where: { id: { in: jewelleryItemIds }, organizationId },
          data: { status: "SOLD" },
        });
      }

      // Link old gold adjustment to this invoice
      if (oldGoldAdjustmentId && oldGoldDeductionAmount > 0) {
        await tx.oldGoldPurchase.update({
          where: { id: oldGoldAdjustmentId },
          data: { adjustedAgainstInvoiceId: invoice.id },
        });
      }

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
          // Skip FIFO for jewellery items — they use status-based tracking, not lot-based
          if (invoiceItem.jewelleryItemId) {
            const jewelleryItem = await tx.jewelleryItem.findUnique({
              where: { id: invoiceItem.jewelleryItemId },
              select: { costPrice: true, fineWeight: true, grossWeight: true, purity: true, metalType: true, tagNumber: true },
            });
            if (jewelleryItem) {
              await tx.invoiceItem.update({
                where: { id: invoiceItem.id },
                data: { costOfGoodsSold: Number(jewelleryItem.costPrice) },
              });
              // Metal ledger OUTFLOW
              await createMetalLedgerEntry(tx, organizationId, {
                date: invoiceDate,
                metalType: jewelleryItem.metalType,
                purity: jewelleryItem.purity,
                grossWeight: Number(jewelleryItem.grossWeight),
                fineWeight: Number(jewelleryItem.fineWeight),
                direction: "OUTFLOW",
                description: `Sale - Tag #${jewelleryItem.tagNumber} (${invoice.invoiceNumber})`,
                sourceType: "SALE",
                sourceId: invoice.id,
                jewelleryItemId: invoiceItem.jewelleryItemId,
                customerId,
                invoiceId: invoice.id,
              });
            }
            continue;
          }
          if (!backdatedProducts.has(invoiceItem.productId)) {
            // Check if this is a bundle product
            const product = await tx.product.findUnique({
              where: { id: invoiceItem.productId },
              select: {
                isBundle: true,
                bundleItems: {
                  select: {
                    componentProductId: true,
                    quantity: true,
                  },
                },
              },
            });

            // Calculate base quantity to consume based on conversionFactor
            const baseQuantity = Number(invoiceItem.quantity) * Number(invoiceItem.conversionFactor);

            if (product?.isBundle && product.bundleItems.length > 0) {
              // Bundle: consume stock from each component product
              let bundleTotalCOGS = 0;
              for (const bi of product.bundleItems) {
                const componentQty = baseQuantity * Number(bi.quantity);
                const fifoResult = await consumeStockFIFO(
                  bi.componentProductId,
                  componentQty,
                  invoiceItem.id,
                  invoiceDate,
                  tx,
                  organizationId,
                  warehouseId || null
                );
                bundleTotalCOGS += Number(fifoResult.totalCOGS);
                if (fifoResult.warnings.length > 0) {
                  warnings.push(...fifoResult.warnings);
                }
              }
              await tx.invoiceItem.update({
                where: { id: invoiceItem.id },
                data: { costOfGoodsSold: bundleTotalCOGS },
              });
            } else {
              // BOM auto-consume: if manufacturing module enabled and product has active recipe BOM
              const org = await tx.organization.findUnique({
                where: { id: organizationId },
                select: { isManufacturingModuleEnabled: true },
              });
              if (org?.isManufacturingModuleEnabled) {
                try {
                  const bomResult = await consumeBOMIngredientsForSale(
                    invoiceItem.productId, baseQuantity, invoiceItem.id,
                    invoiceDate, tx, organizationId, warehouseId || null
                  );
                  if (bomResult) {
                    await tx.invoiceItem.update({
                      where: { id: invoiceItem.id },
                      data: { costOfGoodsSold: bomResult.totalCOGS },
                    });
                    if (bomResult.warnings.length > 0) {
                      warnings.push(...bomResult.warnings);
                    }
                    continue;
                  }
                } catch (bomError) {
                  warnings.push((bomError as Error).message);
                }
              }

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

      // Create journal entries — use split journals for jewellery sales
      const isJewellerySale = items.some((item: { jewellery?: unknown }) => !!item.jewellery);
      if (isJewellerySale) {
        await syncJewellerySaleJournal(tx, organizationId, invoice.id);
      } else {
        await syncInvoiceRevenueJournal(tx, organizationId, invoice.id);
        await syncInvoiceCOGSJournal(tx, organizationId, invoice.id);
      }

      // Fetch the updated invoice with COGS
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          items: true,
        },
      });

      return { invoice: updatedInvoice, warnings };
    }, { timeout: 60000 });

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
