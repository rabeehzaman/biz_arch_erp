import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  consumeStockForDebitNote,
  checkReturnableStock,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";

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

    const debitNotes = await prisma.debitNote.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
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
    });

    return NextResponse.json(debitNotes);
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

    const debitNoteNumber = await generateDebitNoteNumber(organizationId);
    const debitNoteDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate subtotal with item-level discounts
    const subtotal = items.reduce(
      (
        sum: number,
        item: { quantity: number; unitCost: number; discount?: number }
      ) =>
        sum + item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
      0
    );

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
      // Compute GST
      const orgGST = await getOrgGSTInfo(tx, organizationId);
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
        select: { gstin: true, gstStateCode: true },
      });
      // NOTE: We do not multiply discount amount by conversionFactor here because unitCost should conceptually be for the selected unit.
      const lineItemsForGST = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }) => ({
        taxableAmount: item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
        gstRate: item.gstRate || 0,
        hsnCode: item.hsnCode || null,
      }));
      const gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplier?.gstin, supplier?.gstStateCode);
      const total = subtotal + gstResult.totalTax;

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
                unitId?: string;
                conversionFactor?: number;
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
                total:
                  item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
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
          where: { id: supplierId },
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

      // Create auto journal entry: DR Accounts Payable, CR Inventory [+ CR GST Input]
      if (appliedToBalance) {
        const apAccount = await getSystemAccount(tx, organizationId, "2100");
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        if (apAccount && inventoryAccount) {
          const journalLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
            { accountId: apAccount.id, description: "Accounts Payable", debit: total, credit: 0 },
            { accountId: inventoryAccount.id, description: "Inventory (Return)", debit: 0, credit: subtotal },
          ];
          // Reverse GST Input
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
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create debit note:", error);
    return NextResponse.json(
      { error: "Failed to create debit note" },
      { status: 500 }
    );
  }
}
