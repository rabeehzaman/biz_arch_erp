import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { calculateLineVAT, calculateDocumentVAT, LineVATResult } from "@/lib/saudi-vat/calculator";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import {
  createStockLotFromCreditNote,
  getOriginalCOGSForInvoiceItem,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { toMidnightUTC } from "@/lib/date-utils";

// Generate credit note number: CN-YYYYMMDD-XXX
async function generateCreditNoteNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `CN-${dateStr}`;

  const lastCN = await prisma.creditNote.findFirst({
    where: { creditNoteNumber: { startsWith: prefix }, organizationId },
    orderBy: { creditNoteNumber: "desc" },
  });

  let sequence = 1;
  if (lastCN) {
    const lastSequence = parseInt(
      lastCN.creditNoteNumber.split("-").pop() || "0"
    );
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    const isAdmin = session.user.role === "admin";

    // Apply same access control as invoices - user can only see credit notes for assigned customers
    const creditNotes = await prisma.creditNote.findMany({
      where: isAdmin
        ? { organizationId }
        : {
          organizationId,
          customer: {
            assignments: {
              some: { userId },
            },
          },
        },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(creditNotes);
  } catch (error) {
    console.error("Failed to fetch credit notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit notes" },
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
      customerId,
      invoiceId,
      issueDate,
      items,
      reason,
      notes,
      appliedToBalance = true,
      branchId,
      warehouseId,
      posSessionId,
    } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
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

    const creditNoteNumber = await generateCreditNoteNumber(organizationId);
    const creditNoteDate = toMidnightUTC(issueDate);
    const taxInclusive = isTaxInclusivePriceSession(session);
    const saudiEnabled = isSaudiEInvoiceEnabled(session);

    // Build per-line gross amounts and taxable amounts (for tax-inclusive pricing)
    const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; vatRate?: number }) => {
      const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    // Calculate subtotal (sum of tax-exclusive base amounts)
    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // ── Tax computation ────────────────────────────────────────────────
      let totalTax = 0;
      let totalVat: number | null = null;
      let lineVATResults: LineVATResult[] = [];
      let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };

      if (saudiEnabled) {
        // Saudi VAT path
        lineVATResults = items.map((item: { quantity: number; unitPrice: number; discount?: number; vatRate?: number; vatCategory?: string }, idx: number) => {
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
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { gstin: true, gstStateCode: true },
        });
        const lineItems = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
          taxableAmount: lineAmounts[idx].taxableAmount,
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItems, customer?.gstin, customer?.gstStateCode);
        totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      }
      const total = subtotal + totalTax;

      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          organizationId,
          creditNoteNumber,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          posSessionId: posSessionId || null,
          customerId,
          createdById: session.user.id,
          invoiceId: invoiceId || null,
          issueDate: creditNoteDate,
          subtotal,
          total,
          totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
          totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
          totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
          totalVat,
          appliedToBalance,
          reason: reason || null,
          notes: notes || null,
          items: {
            create: items.map(
              (item: {
                invoiceItemId?: string;
                productId?: string;
                description: string;
                quantity: number;
                unitPrice: number;
                discount?: number;
                originalCOGS?: number;
                gstRate?: number;
                hsnCode?: string;
                unitId?: string;
                conversionFactor?: number;
                vatRate?: number;
                vatCategory?: string;
              }, idx: number) => ({
                organizationId,
                invoiceItemId: item.invoiceItemId || null,
                productId: item.productId || null,
                description: item.description,
                quantity: item.quantity,
                unitId: item.unitId || null,
                conversionFactor: item.conversionFactor || 1,
                unitPrice: item.unitPrice,
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
                originalCOGS: item.originalCOGS || 0,
              })
            ),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Increment POS session return counters
      if (posSessionId) {
        await tx.pOSSession.update({
          where: { id: posSessionId },
          data: {
            totalReturns: { increment: total },
            totalReturnTransactions: { increment: 1 },
          },
        });
      }

      // Create stock lots for each item with a productId
      const productsToRecalculate = new Set<string>();
      let totalReturnedCOGS = 0;

      for (const creditNoteItem of creditNote.items) {
        if (creditNoteItem.productId) {
          // Determine unit cost for the stock lot
          let unitCost = new Decimal(0);

          if (new Decimal(creditNoteItem.originalCOGS).greaterThan(0)) {
            // Use the provided original COGS (per unit)
            unitCost = new Decimal(creditNoteItem.originalCOGS);
          } else if (creditNoteItem.invoiceItemId) {
            // Try to get COGS from the original invoice item
            const originalCOGS = await getOriginalCOGSForInvoiceItem(
              creditNoteItem.invoiceItemId,
              tx
            );
            if (originalCOGS) {
              unitCost = originalCOGS;
            }
          }

          // If we still don't have a unit cost, use the product's default cost
          if (unitCost.lte(0)) {
            const product = await tx.product.findUnique({
              where: { id: creditNoteItem.productId },
              select: { cost: true },
            });
            if (product) {
              unitCost = product.cost;
            }
          }

          // Create stock lot with base quantity
          const baseQuantity = Number(creditNoteItem.quantity) * Number(creditNoteItem.conversionFactor);

          await createStockLotFromCreditNote(
            creditNoteItem.id,
            creditNoteItem.productId,
            baseQuantity,
            unitCost,
            creditNoteDate,
            tx,
            organizationId,
            warehouseId || null
          );

          // Accumulate COGS for the GL reversal entry (using base quantity)
          totalReturnedCOGS += Number(unitCost) * baseQuantity;

          productsToRecalculate.add(creditNoteItem.productId);
        }
      }

      // Update customer balance (decrement - reduces receivable)
      if (appliedToBalance) {
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: {
            balance: { decrement: total },
          },
        });

        // Create customer transaction record
        await tx.customerTransaction.create({
          data: {
            organizationId,
            customerId,
            transactionType: "CREDIT_NOTE",
            transactionDate: creditNoteDate,
            amount: -total, // Negative for credit
            description: `Credit Note ${creditNoteNumber}${invoiceId ? ` - Return for Invoice` : ""}`,
            creditNoteId: creditNote.id,
            runningBalance: 0, // Will be calculated when statement is generated
          },
        });
      }

      // Create auto journal entry: DR Sales Revenue [+ DR VAT/GST Output], CR Accounts Receivable
      if (appliedToBalance) {
        const revenueAccount = await getSystemAccount(tx, organizationId, "4100");
        const arAccount = await getSystemAccount(tx, organizationId, "1300");
        if (revenueAccount && arAccount) {
          const returnLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
            { accountId: revenueAccount.id, description: "Sales Revenue (Return)", debit: subtotal, credit: 0 },
            { accountId: arAccount.id, description: "Accounts Receivable", debit: 0, credit: total },
          ];
          // Reverse tax output
          if (totalVat && totalVat > 0) {
            // Saudi VAT: single VAT Output account
            const vatAccount = await getSystemAccount(tx, organizationId, "2240");
            if (vatAccount) returnLines.push({ accountId: vatAccount.id, description: "VAT Output (Return)", debit: totalVat, credit: 0 });
          } else {
            // GST: CGST/SGST/IGST accounts
            if (gstResult.totalCgst > 0) {
              const cgstAccount = await getSystemAccount(tx, organizationId, "2210");
              if (cgstAccount) returnLines.push({ accountId: cgstAccount.id, description: "CGST Output (Return)", debit: gstResult.totalCgst, credit: 0 });
            }
            if (gstResult.totalSgst > 0) {
              const sgstAccount = await getSystemAccount(tx, organizationId, "2220");
              if (sgstAccount) returnLines.push({ accountId: sgstAccount.id, description: "SGST Output (Return)", debit: gstResult.totalSgst, credit: 0 });
            }
            if (gstResult.totalIgst > 0) {
              const igstAccount = await getSystemAccount(tx, organizationId, "2230");
              if (igstAccount) returnLines.push({ accountId: igstAccount.id, description: "IGST Output (Return)", debit: gstResult.totalIgst, credit: 0 });
            }
          }
          await createAutoJournalEntry(tx, organizationId, {
            date: creditNoteDate,
            description: `Credit Note ${creditNoteNumber}`,
            sourceType: "CREDIT_NOTE",
            sourceId: creditNote.id,
            branchId: branchId || null,
            lines: returnLines,
          });
        }
      }

      // Create COGS reversal journal entry for returned inventory items
      // DR Inventory (1400), CR Cost of Goods Sold (5100)
      if (totalReturnedCOGS > 0) {
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        const cogsAccount = await getSystemAccount(tx, organizationId, "5100");
        if (inventoryAccount && cogsAccount) {
          await createAutoJournalEntry(tx, organizationId, {
            date: creditNoteDate,
            description: `COGS Reversal - ${creditNoteNumber}`,
            sourceType: "CREDIT_NOTE",
            sourceId: creditNote.id,
            branchId: branchId || null,
            lines: [
              { accountId: inventoryAccount.id, description: "Inventory (Return)", debit: totalReturnedCOGS, credit: 0 },
              { accountId: cogsAccount.id, description: "Cost of Goods Sold (Return)", debit: 0, credit: totalReturnedCOGS },
            ],
          });
        }
      }

      // If linked to invoice, update invoice balanceDue
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          select: { balanceDue: true, total: true },
        });

        if (invoice) {
          const newBalanceDue = Decimal.max(0, new Decimal(invoice.balanceDue).minus(total));
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { balanceDue: newBalanceDue },
          });
        }
      }

      // Check for backdated returns and recalculate FIFO if needed
      for (const productId of productsToRecalculate) {
        const backdated = await isBackdated(productId, creditNoteDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, creditNoteDate, tx, "recalculation", undefined, organizationId);
        }
      }

      // Fetch the complete credit note with all relations
      return tx.creditNote.findUnique({
        where: { id: creditNote.id },
        include: {
          customer: true,
          invoice: true,
          items: {
            include: {
              product: true,
              stockLot: true,
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create credit note:", error);
    return NextResponse.json(
      { error: "Failed to create credit note" },
      { status: 500 }
    );
  }
}
