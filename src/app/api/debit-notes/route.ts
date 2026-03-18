import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { calculateLineVAT, calculateDocumentVAT, LineVATResult } from "@/lib/saudi-vat/calculator";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import {
  consumeStockForDebitNote,
  checkReturnableStock,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { createAutoJournalEntry, ensureRoundOffAccount, getSystemAccount } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { toMidnightUTC } from "@/lib/date-utils";
import { calculateRoundOff, getOrganizationRoundOffMode } from "@/lib/round-off";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

// Generate debit note number: DN-YYYYMMDD-XXX
async function generateDebitNoteNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `DN-${dateStr}`;

  const lastDN = await prisma.debitNote.findFirst({
    where: { debitNoteNumber: { startsWith: prefix }, organizationId },
    orderBy: { debitNoteNumber: "desc" },
  });

  let sequence = 1;
  if (lastDN) {
    const lastSequence = parseInt(lastDN.debitNoteNumber.split("-").pop() || "0");
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
    const { limit, offset, search } = parsePagination(request);

    const baseWhere = { organizationId };
    const where = search
      ? {
          ...baseWhere,
          OR: [
            { debitNoteNumber: { contains: search, mode: "insensitive" as const } },
            { supplier: { name: { contains: search, mode: "insensitive" as const } } },
            { purchaseInvoice: { purchaseInvoiceNumber: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : baseWhere;

    const [debitNotes, total] = await Promise.all([
      prisma.debitNote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          supplier: {
            select: { id: true, name: true, email: true },
          },
          purchaseInvoice: {
            select: { id: true, purchaseInvoiceNumber: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.debitNote.count({ where }),
    ]);

    return paginatedResponse(debitNotes, total, offset + debitNotes.length < total);
  } catch (error) {
    console.error("Failed to fetch debit notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch debit notes" },
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
    const {
      supplierId,
      purchaseInvoiceId,
      issueDate,
      items,
      reason,
      notes,
      appliedToBalance = true,
      branchId,
      warehouseId,
      applyRoundOff,
    } = body;

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

    // Validate all items have productId (required for stock tracking)
    const invalidItems = items.filter(
      (item: { productId?: string }) => !item.productId
    );
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "All debit note items must have a productId for stock tracking" },
        { status: 400 }
      );
    }

    // Validate warehouse is provided when multi-branch is enabled
    const [org, roundOffMode] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { multiBranchEnabled: true, isTaxInclusivePrice: true, saudiEInvoiceEnabled: true },
      }),
      getOrganizationRoundOffMode(prisma, organizationId),
    ]);
    if (org?.multiBranchEnabled && !warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required when multi-branch is enabled" },
        { status: 400 }
      );
    }
    const debitNoteNumber = await generateDebitNoteNumber(organizationId);
    const debitNoteDate = toMidnightUTC(issueDate);
    const taxInclusive = isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice;
    const saudiEnabled = isSaudiEInvoiceEnabled(session) || org?.saudiEInvoiceEnabled;

    // Build per-line gross amounts and taxable amounts (for tax-inclusive pricing)
    const lineAmounts = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; vatRate?: number }) => {
      const grossAmount = item.quantity * item.unitCost * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    // Calculate subtotal (sum of tax-exclusive base amounts)
    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

    // Check stock availability for all items before proceeding
    for (const item of items) {
      // Calculate base quantity to return based on conversionFactor
      const baseQuantity = Number(item.quantity) * Number(item.conversionFactor || 1);

      const stockCheck = await checkReturnableStock(
        item.productId,
        baseQuantity,
        prisma,
        warehouseId || null
      );

      if (!stockCheck.canReturn) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });

        return NextResponse.json(
          {
            error: `Insufficient stock for ${product?.name || "product"}. ` +
              `Requested: ${item.quantity}, Available: ${stockCheck.available.toNumber()}, ` +
              `Shortfall: ${stockCheck.shortfall.toNumber()}`,
          },
          { status: 400 }
        );
      }
    }

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // ── Tax computation ────────────────────────────────────────────────
      let totalTax = 0;
      let totalVat: number | null = null;
      let lineVATResults: LineVATResult[] = [];
      let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };

      if (saudiEnabled) {
        // Saudi VAT path
        lineVATResults = items.map((item: { quantity: number; unitCost: number; discount?: number; vatRate?: number; vatCategory?: string }, idx: number) => {
          const taxableAmount = lineAmounts[idx].taxableAmount;
          const vatRate = item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE;
          return calculateLineVAT({ taxableAmount, vatRate, vatCategory: item.vatCategory as import("@/lib/saudi-vat/constants").VATCategory | undefined });
        });
        const docVAT = calculateDocumentVAT(lineVATResults);
        totalVat = docVAT.totalVat;
        totalTax = totalVat;
      } else {
        // GST path
        const orgGST = await getOrgGSTInfo(tx, organizationId);
        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
          select: { gstin: true, gstStateCode: true },
        });
        const lineItemsForGST = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
          taxableAmount: lineAmounts[idx].taxableAmount,
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplier?.gstin, supplier?.gstStateCode);
        totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      }
      const shouldApplyRoundOff = applyRoundOff === true && roundOffMode !== "NONE";
      const { roundOffAmount, roundedTotal } = calculateRoundOff(
        subtotal + totalTax,
        roundOffMode,
        shouldApplyRoundOff
      );
      const total = roundedTotal;

      // Create the debit note
      const debitNote = await tx.debitNote.create({
        data: {
          organizationId,
          debitNoteNumber,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          supplierId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          issueDate: debitNoteDate,
          subtotal,
          total,
          totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
          totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
          totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
          roundOffAmount,
          applyRoundOff: shouldApplyRoundOff,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
          totalVat,
          appliedToBalance,
          reason: reason || null,
          notes: notes || null,
          items: {
            create: items.map(
              (item: {
                purchaseInvoiceItemId?: string;
                productId: string;
                description: string;
                quantity: number;
                unitCost: number;
                discount?: number;
                gstRate?: number;
                hsnCode?: string;
                unitId?: string;
                conversionFactor?: number;
                vatRate?: number;
                vatCategory?: string;
              }, idx: number) => ({
                organizationId,
                purchaseInvoiceItemId: item.purchaseInvoiceItemId || null,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitId: item.unitId || null,
                conversionFactor: item.conversionFactor || 1,
                unitCost: item.unitCost,
                discount: item.discount || 0,
                total: lineAmounts[idx].taxableAmount,
                hsnCode: saudiEnabled ? null : (gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null),
                gstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.gstRate || 0),
                cgstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstRate || 0),
                sgstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstRate || 0),
                igstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstRate || 0),
                cgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstAmount || 0),
                sgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstAmount || 0),
                igstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstAmount || 0),
                vatRate: lineVATResults[idx]?.vatRate ?? null,
                vatAmount: lineVATResults[idx]?.vatAmount ?? null,
                vatCategory: lineVATResults[idx]?.vatCategory ?? null,
              })
            ),
          },
        },
        include: {
          supplier: true,
          items: true,
        },
      });

      // Consume stock for each item (reduces inventory)
      const productsToRecalculate = new Set<string>();

      for (const debitNoteItem of debitNote.items) {
        // Calculate base quantity to return based on conversionFactor
        const baseQuantity = Number(debitNoteItem.quantity) * Number(debitNoteItem.conversionFactor);

        await consumeStockForDebitNote(
          debitNoteItem.productId,
          baseQuantity,
          debitNoteItem.id,
          debitNoteDate,
          tx,
          organizationId,
          warehouseId || null
        );

        productsToRecalculate.add(debitNoteItem.productId);
      }

      // Update supplier balance (decrement - reduces payable)
      if (appliedToBalance) {
        await tx.supplier.update({
          where: { id: supplierId, organizationId },
          data: {
            balance: { decrement: total },
          },
        });

        // Create supplier transaction record
        await tx.supplierTransaction.create({
          data: {
            organizationId,
            supplierId,
            transactionType: "DEBIT_NOTE",
            transactionDate: debitNoteDate,
            amount: -total, // Negative for debit (reduces payable)
            description: `Debit Note ${debitNoteNumber}${purchaseInvoiceId ? ` - Return for Purchase Invoice` : ""}`,
            debitNoteId: debitNote.id,
            runningBalance: 0, // Will be calculated when statement is generated
          },
        });
      }

      // Create auto journal entry: DR Accounts Payable, CR Inventory [+ CR VAT/GST Input]
      if (appliedToBalance) {
        const apAccount = await getSystemAccount(tx, organizationId, "2100");
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        if (apAccount && inventoryAccount) {
          const journalLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
            { accountId: apAccount.id, description: "Accounts Payable", debit: total, credit: 0 },
            { accountId: inventoryAccount.id, description: "Inventory (Return)", debit: 0, credit: subtotal },
          ];
          // Reverse tax input
          if (totalVat && totalVat > 0) {
            // Saudi VAT: single VAT Input account
            const vatInput = await getSystemAccount(tx, organizationId, "1380");
            if (vatInput) journalLines.push({ accountId: vatInput.id, description: "VAT Input (Return)", debit: 0, credit: totalVat });
          } else {
            // GST: CGST/SGST/IGST input accounts
            if (gstResult.totalCgst > 0) {
              const cgstInput = await getSystemAccount(tx, organizationId, "1350");
              if (cgstInput) journalLines.push({ accountId: cgstInput.id, description: "CGST Input (Return)", debit: 0, credit: gstResult.totalCgst });
            }
            if (gstResult.totalSgst > 0) {
              const sgstInput = await getSystemAccount(tx, organizationId, "1360");
              if (sgstInput) journalLines.push({ accountId: sgstInput.id, description: "SGST Input (Return)", debit: 0, credit: gstResult.totalSgst });
            }
            if (gstResult.totalIgst > 0) {
              const igstInput = await getSystemAccount(tx, organizationId, "1370");
              if (igstInput) journalLines.push({ accountId: igstInput.id, description: "IGST Input (Return)", debit: 0, credit: gstResult.totalIgst });
            }
          }
          if (Math.abs(roundOffAmount) > 0.0001) {
            const roundOffAccount = await ensureRoundOffAccount(tx, organizationId);
            if (roundOffAccount) {
              journalLines.push({
                accountId: roundOffAccount.id,
                description: "Round Off Adjustment",
                debit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
                credit: roundOffAmount > 0 ? roundOffAmount : 0,
              });
            }
          }
          await createAutoJournalEntry(tx, organizationId, {
            date: debitNoteDate,
            description: `Debit Note ${debitNoteNumber}`,
            sourceType: "DEBIT_NOTE",
            sourceId: debitNote.id,
            branchId: branchId || null,
            lines: journalLines,
          });
        }
      }

      // If linked to purchase invoice, update invoice balanceDue
      if (purchaseInvoiceId) {
        const purchaseInvoice = await tx.purchaseInvoice.findUnique({
          where: { id: purchaseInvoiceId },
          select: { balanceDue: true, total: true },
        });

        if (purchaseInvoice) {
          const newBalanceDue = Decimal.max(0, new Decimal(purchaseInvoice.balanceDue).minus(total));
          await tx.purchaseInvoice.update({
            where: { id: purchaseInvoiceId },
            data: { balanceDue: newBalanceDue },
          });
        }
      }

      // Check for backdated returns and recalculate FIFO if needed
      for (const productId of productsToRecalculate) {
        const backdated = await isBackdated(productId, debitNoteDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, debitNoteDate, tx, "recalculation", undefined, organizationId);
        }
      }

      // Fetch the complete debit note with all relations
      return tx.debitNote.findUnique({
        where: { id: debitNote.id },
        include: {
          supplier: true,
          purchaseInvoice: true,
          items: {
            include: {
              product: true,
              lotConsumptions: {
                include: {
                  stockLot: true,
                },
              },
            },
          },
        },
      });
    }, { timeout: 60000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create debit note:", error);
    return NextResponse.json(
      { error: "Failed to create debit note" },
      { status: 500 }
    );
  }
}
