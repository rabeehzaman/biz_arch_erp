import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { calculateLineVAT, calculateDocumentVAT, LineVATResult } from "@/lib/saudi-vat/calculator";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import {
  consumeStockForDebitNote,
  restoreStockFromDebitNote,
  checkReturnableStock,
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

    const debitNote = await prisma.debitNote.findUnique({
      where: { id, organizationId },
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
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    if (!debitNote) {
      return NextResponse.json(
        { error: "Debit note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(debitNote);
  } catch (error) {
    console.error("Failed to fetch debit note:", error);
    return NextResponse.json(
      { error: "Failed to fetch debit note" },
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
      supplierId,
      purchaseInvoiceId,
      issueDate,
      items,
      reason,
      notes,
      appliedToBalance = true,
    } = body;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and items are required" },
        { status: 400 }
      );
    }

    // Validate all items have productId
    const invalidItems = items.filter(
      (item: { productId?: string }) => !item.productId
    );
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "All debit note items must have a productId" },
        { status: 400 }
      );
    }

    const debitNoteDate = toMidnightUTC(issueDate);
    const taxInclusive = isTaxInclusivePriceSession(session);
    const saudiEnabled = isSaudiEInvoiceEnabled(session);

    // Build per-line gross amounts and taxable amounts
    const lineAmounts = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; vatRate?: number }) => {
      const grossAmount = item.quantity * item.unitCost * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    // Calculate subtotal (sum of tax-exclusive base amounts)
    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

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
      const orgGST = await getOrgGSTInfo(prisma, organizationId);
      const supplier = await prisma.supplier.findUnique({
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
    const total = subtotal + totalTax;

    const result = await prisma.$transaction(async (tx) => {
      // Get the old debit note
      const oldDebitNote = await tx.debitNote.findUnique({
        where: { id, organizationId },
        include: {
          items: true,
        },
      });

      if (!oldDebitNote) {
        throw new Error("Debit note not found");
      }

      // Restore old stock consumptions
      const productsToRecalculate = new Set<string>();
      for (const oldItem of oldDebitNote.items) {
        await restoreStockFromDebitNote(oldItem.id, tx);
        productsToRecalculate.add(oldItem.productId);
      }

      // Reverse old supplier balance change
      if (oldDebitNote.appliedToBalance) {
        await tx.supplier.update({
          where: { id: oldDebitNote.supplierId, organizationId },
          data: {
            balance: { increment: oldDebitNote.total },
          },
        });

        // Delete old supplier transaction
        await tx.supplierTransaction.deleteMany({
          where: { debitNoteId: id },
        });
      }

      // Reverse old purchase invoice balance change
      if (oldDebitNote.purchaseInvoiceId) {
        await tx.purchaseInvoice.update({
          where: { id: oldDebitNote.purchaseInvoiceId, organizationId },
          data: {
            balanceDue: { increment: oldDebitNote.total },
          },
        });
      }

      // Delete old journal entries so new ones can be created fresh
      await tx.journalEntry.deleteMany({
        where: { sourceType: "DEBIT_NOTE", sourceId: id, organizationId },
      });

      // Delete old items (cascade will delete lot consumptions)
      await tx.debitNoteItem.deleteMany({
        where: { debitNoteId: id },
      });

      // Check stock availability for new items
      for (const item of items) {
        // Calculate base quantity to return based on conversionFactor
        const baseQuantity = Number(item.quantity) * Number(item.conversionFactor || 1);

        const stockCheck = await checkReturnableStock(
          item.productId,
          baseQuantity,
          tx
        );

        if (!stockCheck.canReturn) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { name: true },
          });

          throw new Error(
            `Insufficient stock for ${product?.name || "product"}. ` +
            `Requested: ${item.quantity}, Available: ${stockCheck.available.toNumber()}`
          );
        }
      }

      // Update the debit note and create new items
      const updatedDebitNote = await tx.debitNote.update({
        where: { id, organizationId },
        data: {
          supplierId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          issueDate: debitNoteDate,
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
          items: true,
        },
      });

      // Consume new stock
      for (const debitNoteItem of updatedDebitNote.items) {
        // Calculate base quantity to return based on conversionFactor
        const baseQuantity = Number(debitNoteItem.quantity) * Number(debitNoteItem.conversionFactor);

        await consumeStockForDebitNote(
          debitNoteItem.productId,
          baseQuantity,
          debitNoteItem.id,
          debitNoteDate,
          tx,
          organizationId
        );

        productsToRecalculate.add(debitNoteItem.productId);
      }

      // Apply new supplier balance change
      if (appliedToBalance) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: {
            balance: { decrement: total },
          },
        });

        // Create new supplier transaction
        await tx.supplierTransaction.create({
          data: {
            organizationId,
            supplierId,
            transactionType: "DEBIT_NOTE",
            transactionDate: debitNoteDate,
            amount: -total,
            description: `Debit Note ${updatedDebitNote.debitNoteNumber}${purchaseInvoiceId ? ` - Return for Purchase Invoice` : ""}`,
            debitNoteId: id,
            runningBalance: 0,
          },
        });
      }

      // Apply new purchase invoice balance change
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

      // Recalculate FIFO for affected products
      for (const productId of productsToRecalculate) {
        const backdated = await isBackdated(productId, debitNoteDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, debitNoteDate, tx, "recalculation", undefined, organizationId);
        }
      }

      // Recreate journal entries (were deleted above)
      if (appliedToBalance) {
        const apAccount = await getSystemAccount(tx, organizationId, "2100");
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        if (apAccount && inventoryAccount) {
          const dnLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
            { accountId: apAccount.id, description: "Accounts Payable", debit: total, credit: 0 },
            { accountId: inventoryAccount.id, description: "Inventory (Return)", debit: 0, credit: subtotal },
          ];
          // Reverse tax input
          if (totalVat && totalVat > 0) {
            // Saudi VAT: single VAT Input account
            const vatInput = await getSystemAccount(tx, organizationId, "1380");
            if (vatInput) dnLines.push({ accountId: vatInput.id, description: "VAT Input (Return)", debit: 0, credit: totalVat });
          } else {
            // GST: CGST/SGST/IGST input accounts
            if (gstResult.totalCgst > 0) {
              const cgstAccount = await getSystemAccount(tx, organizationId, "1350");
              if (cgstAccount) dnLines.push({ accountId: cgstAccount.id, description: "CGST Input (Return)", debit: 0, credit: gstResult.totalCgst });
            }
            if (gstResult.totalSgst > 0) {
              const sgstAccount = await getSystemAccount(tx, organizationId, "1360");
              if (sgstAccount) dnLines.push({ accountId: sgstAccount.id, description: "SGST Input (Return)", debit: 0, credit: gstResult.totalSgst });
            }
            if (gstResult.totalIgst > 0) {
              const igstAccount = await getSystemAccount(tx, organizationId, "1370");
              if (igstAccount) dnLines.push({ accountId: igstAccount.id, description: "IGST Input (Return)", debit: 0, credit: gstResult.totalIgst });
            }
          }
          await createAutoJournalEntry(tx, organizationId, {
            date: debitNoteDate,
            description: `Debit Note ${updatedDebitNote.debitNoteNumber}`,
            sourceType: "DEBIT_NOTE",
            sourceId: id,
            lines: dnLines,
          });
        }
      }

      // Fetch complete updated debit note
      return tx.debitNote.findUnique({
        where: { id },
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
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update debit note:", error);
    return NextResponse.json(
      { error: "Failed to update debit note" },
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
      // Get the debit note with items
      const debitNote = await tx.debitNote.findUnique({
        where: { id, organizationId },
        include: {
          items: true,
        },
      });

      if (!debitNote) {
        throw new Error("Debit note not found");
      }

      // Restore stock and track products for recalculation
      const productsToRecalculate = new Set<string>();
      for (const item of debitNote.items) {
        await restoreStockFromDebitNote(item.id, tx);
        productsToRecalculate.add(item.productId);
      }

      // Restore supplier balance
      if (debitNote.appliedToBalance) {
        await tx.supplier.update({
          where: { id: debitNote.supplierId, organizationId },
          data: {
            balance: { increment: debitNote.total },
          },
        });

        // Delete supplier transaction
        await tx.supplierTransaction.deleteMany({
          where: { debitNoteId: id },
        });
      }

      // Restore purchase invoice balance
      if (debitNote.purchaseInvoiceId) {
        await tx.purchaseInvoice.update({
          where: { id: debitNote.purchaseInvoiceId, organizationId },
          data: {
            balanceDue: { increment: debitNote.total },
          },
        });
      }

      // Delete auto journal entries created for this debit note
      await tx.journalEntry.deleteMany({
        where: { sourceType: "DEBIT_NOTE", sourceId: id, organizationId },
      });

      // Delete the debit note (cascade will delete items and lot consumptions)
      await tx.debitNote.delete({
        where: { id, organizationId },
      });

      // Recalculate FIFO for affected products
      for (const productId of productsToRecalculate) {
        const backdated = await isBackdated(productId, debitNote.issueDate, tx);
        if (backdated) {
          await recalculateFromDate(productId, debitNote.issueDate, tx, "recalculation", undefined, organizationId);
        }
      }

      return { success: true };
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to delete debit note:", error);
    return NextResponse.json(
      { error: "Failed to delete debit note" },
      { status: 500 }
    );
  }
}
