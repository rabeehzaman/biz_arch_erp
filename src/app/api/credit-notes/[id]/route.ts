import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { calculateLineVAT, calculateDocumentVAT, LineVATResult } from "@/lib/saudi-vat/calculator";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import {
  createStockLotFromCreditNote,
  deleteStockLotFromCreditNote,
  getOriginalCOGSForInvoiceItem,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";
import { Decimal } from "@prisma/client/runtime/client";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { toMidnightUTC } from "@/lib/date-utils";

export async function GET(
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

    const creditNote = await prisma.creditNote.findUnique({
      where: { id, organizationId },
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
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    if (!creditNote) {
      return NextResponse.json(
        { error: "Credit note not found" },
        { status: 404 }
      );
    }

    // Check access control (user can only access credit notes for assigned customers)
    if (session.user.role !== "admin") {
      const customerAssignment = await prisma.customerAssignment.findFirst({
        where: {
          customerId: creditNote.customerId,
          userId: session.user.id,
        },
      });

      if (!customerAssignment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(creditNote);
  } catch (error) {
    console.error("Failed to fetch credit note:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit note" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const {
      customerId,
      invoiceId,
      issueDate,
      items,
      reason,
      notes,
      appliedToBalance = true,
    } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    const creditNoteDate = toMidnightUTC(issueDate);
    const taxInclusive = isTaxInclusivePriceSession(session);
    const saudiEnabled = isSaudiEInvoiceEnabled(session);

    // Calculate new totals
    const totalReturnedCOGS = items.reduce(
      (sum: number, item: { quantity: number; unitCOGS?: number; originalCOGS?: number }) =>
        sum + item.quantity * (item.unitCOGS || item.originalCOGS || 0),
      0
    );

    // Build per-line gross amounts and taxable amounts
    const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; vatRate?: number }) => {
      const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

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
      const orgGST = await getOrgGSTInfo(prisma, organizationId);
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { gstin: true, gstStateCode: true },
      });
      const lineItemsForGST = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
        taxableAmount: lineAmounts[idx].taxableAmount,
        gstRate: item.gstRate || 0,
        hsnCode: item.hsnCode || null,
      }));
      gstResult = computeDocumentGST(orgGST, lineItemsForGST, customer?.gstin, customer?.gstStateCode);
      totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
    }
    const total = subtotal + totalTax;

    const result = await prisma.$transaction(async (tx) => {
      // Get the old credit note
      const oldCreditNote = await tx.creditNote.findUnique({
        where: { id, organizationId },
        include: {
          items: true,
        },
      });

      if (!oldCreditNote) {
        throw new Error("Credit note not found");
      }

      // Delete old stock lots created by this credit note
      const productsToRecalculate = new Set<string>();
      for (const oldItem of oldCreditNote.items) {
        if (oldItem.productId) {
          await deleteStockLotFromCreditNote(oldItem.id, tx);
          productsToRecalculate.add(oldItem.productId);
        }
      }

      // Reverse old customer balance change
      if (oldCreditNote.appliedToBalance) {
        await tx.customer.update({
          where: { id: oldCreditNote.customerId, organizationId },
          data: {
            balance: { increment: oldCreditNote.total },
          },
        });

        // Delete old customer transaction
        await tx.customerTransaction.deleteMany({
          where: { creditNoteId: id },
        });
      }

      // Reverse old invoice balance change
      if (oldCreditNote.invoiceId) {
        await tx.invoice.update({
          where: { id: oldCreditNote.invoiceId, organizationId },
          data: {
            balanceDue: { increment: oldCreditNote.total },
          },
        });
      }

      // Delete old journal entries so new ones can be created fresh
      await tx.journalEntry.deleteMany({
        where: { sourceType: "CREDIT_NOTE", sourceId: id, organizationId },
      });

      // Delete old items
      await tx.creditNoteItem.deleteMany({
        where: { creditNoteId: id },
      });

      // Update the credit note and create new items
      const updatedCreditNote = await tx.creditNote.update({
        where: { id, organizationId },
        data: {
          customerId,
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
                originalCOGS: item.originalCOGS || 0,
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
          items: true,
        },
      });

      // Create new stock lots
      for (const creditNoteItem of updatedCreditNote.items) {
        if (creditNoteItem.productId) {
          let unitCost = new Decimal(0);

          if (new Decimal(creditNoteItem.originalCOGS).greaterThan(0)) {
            unitCost = new Decimal(creditNoteItem.originalCOGS);
          } else if (creditNoteItem.invoiceItemId) {
            const originalCOGS = await getOriginalCOGSForInvoiceItem(
              creditNoteItem.invoiceItemId,
              tx
            );
            if (originalCOGS) {
              unitCost = originalCOGS;
            }
          }

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
            organizationId
          );

          productsToRecalculate.add(creditNoteItem.productId);
        }
      }

      // Apply new customer balance change
      if (appliedToBalance) {
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: {
            balance: { decrement: total },
          },
        });

        // Create new customer transaction
        await tx.customerTransaction.create({
          data: {
            organizationId,
            customerId,
            transactionType: "CREDIT_NOTE",
            transactionDate: creditNoteDate,
            amount: -total,
            description: `Credit Note ${updatedCreditNote.creditNoteNumber}${invoiceId ? ` - Return for Invoice` : ""}`,
            creditNoteId: id,
            runningBalance: 0,
          },
        });
      }

      // Apply new invoice balance change
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

      // Recalculate FIFO for affected products
      for (const productId of productsToRecalculate) {
        const backdated = await isBackdated(productId, creditNoteDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, creditNoteDate, tx, "recalculation", undefined, organizationId);
        }
      }

      // Recreate journal entries (were deleted above)
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
            description: `Credit Note ${updatedCreditNote.creditNoteNumber}`,
            sourceType: "CREDIT_NOTE",
            sourceId: id,
            lines: returnLines,
          });
        }
      }
      if (totalReturnedCOGS > 0) {
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        const cogsAccount = await getSystemAccount(tx, organizationId, "5100");
        if (inventoryAccount && cogsAccount) {
          await createAutoJournalEntry(tx, organizationId, {
            date: creditNoteDate,
            description: `COGS Reversal - ${updatedCreditNote.creditNoteNumber}`,
            sourceType: "CREDIT_NOTE",
            sourceId: id,
            lines: [
              { accountId: inventoryAccount.id, description: "Inventory (Return)", debit: totalReturnedCOGS, credit: 0 },
              { accountId: cogsAccount.id, description: "Cost of Goods Sold (Return)", debit: 0, credit: totalReturnedCOGS },
            ],
          });
        }
      }

      // Fetch complete updated credit note
      return tx.creditNote.findUnique({
        where: { id },
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
    }, { timeout: 60000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update credit note:", error);
    return NextResponse.json(
      { error: "Failed to update credit note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const result = await prisma.$transaction(async (tx) => {
      // Get the credit note with items
      const creditNote = await tx.creditNote.findUnique({
        where: { id, organizationId },
        include: {
          items: true,
        },
      });

      if (!creditNote) {
        throw new Error("Credit note not found");
      }

      // Delete stock lots and track products for recalculation
      const productsToRecalculate = new Set<string>();
      for (const item of creditNote.items) {
        if (item.productId) {
          await deleteStockLotFromCreditNote(item.id, tx);
          productsToRecalculate.add(item.productId);
        }
      }

      // Restore customer balance
      if (creditNote.appliedToBalance) {
        await tx.customer.update({
          where: { id: creditNote.customerId, organizationId },
          data: {
            balance: { increment: creditNote.total },
          },
        });

        // Delete customer transaction
        await tx.customerTransaction.deleteMany({
          where: { creditNoteId: id },
        });
      }

      // Restore invoice balance
      if (creditNote.invoiceId) {
        await tx.invoice.update({
          where: { id: creditNote.invoiceId, organizationId },
          data: {
            balanceDue: { increment: creditNote.total },
          },
        });
      }

      // Delete auto journal entries created for this credit note
      await tx.journalEntry.deleteMany({
        where: { sourceType: "CREDIT_NOTE", sourceId: id, organizationId },
      });

      // Delete the credit note (cascade will delete items)
      await tx.creditNote.delete({
        where: { id, organizationId },
      });

      // Recalculate FIFO for affected products
      for (const productId of productsToRecalculate) {
        // Check if there are any sales after the credit note date
        const backdated = await isBackdated(
          productId,
          creditNote.issueDate,
          tx
        );
        if (backdated) {
          await recalculateFromDate(productId, creditNote.issueDate, tx, "recalculation", undefined, organizationId);
        }
      }

      return { success: true };
    }, { timeout: 60000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to delete credit note:", error);
    return NextResponse.json(
      { error: "Failed to delete credit note" },
      { status: 500 }
    );
  }
}
