import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  consumeStockForDebitNote,
  restoreStockFromDebitNote,
  checkReturnableStock,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";
import { Decimal } from "@prisma/client/runtime/client";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";

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

    const debitNoteDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate new totals
    const subtotal = items.reduce(
      (
        sum: number,
        item: { quantity: number; unitCost: number; discount?: number }
      ) =>
        sum + item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
      0
    );

    // Compute GST
    const orgGST = await getOrgGSTInfo(prisma, organizationId);
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { gstin: true, gstStateCode: true },
    });
    const lineItemsForGST = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; hsnCode?: string }) => ({
      taxableAmount: item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
      gstRate: item.gstRate || 0,
      hsnCode: item.hsnCode || null,
    }));
    const gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplier?.gstin, supplier?.gstStateCode);
    const total = subtotal + gstResult.totalTax;

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
        const stockCheck = await checkReturnableStock(
          item.productId,
          item.quantity,
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
          totalCgst: gstResult.totalCgst,
          totalSgst: gstResult.totalSgst,
          totalIgst: gstResult.totalIgst,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
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
              }, idx: number) => ({
                organizationId,
                purchaseInvoiceItemId: item.purchaseInvoiceItemId || null,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitCost: item.unitCost,
                discount: item.discount || 0,
                total:
                  item.quantity *
                  item.unitCost *
                  (1 - (item.discount || 0) / 100),
                hsnCode: gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null,
                gstRate: gstResult.lineGST[idx]?.gstRate || 0,
                cgstRate: gstResult.lineGST[idx]?.cgstRate || 0,
                sgstRate: gstResult.lineGST[idx]?.sgstRate || 0,
                igstRate: gstResult.lineGST[idx]?.igstRate || 0,
                cgstAmount: gstResult.lineGST[idx]?.cgstAmount || 0,
                sgstAmount: gstResult.lineGST[idx]?.sgstAmount || 0,
                igstAmount: gstResult.lineGST[idx]?.igstAmount || 0,
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
        await consumeStockForDebitNote(
          debitNoteItem.productId,
          debitNoteItem.quantity,
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
