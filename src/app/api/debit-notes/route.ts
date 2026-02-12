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
      taxRate,
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

    // Calculate totals with item-level discounts
    const subtotal = items.reduce(
      (
        sum: number,
        item: { quantity: number; unitCost: number; discount?: number }
      ) =>
        sum + item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;

    // Check stock availability for all items before proceeding
    for (const item of items) {
      const stockCheck = await checkReturnableStock(
        item.productId,
        item.quantity,
        prisma
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
      // Create the debit note
      const debitNote = await tx.debitNote.create({
        data: {
          organizationId,
          debitNoteNumber,
          supplierId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          issueDate: debitNoteDate,
          subtotal,
          taxRate: taxRate || 0,
          taxAmount,
          total,
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
              }) => ({
                organizationId,
                purchaseInvoiceItemId: item.purchaseInvoiceItemId || null,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitCost: item.unitCost,
                discount: item.discount || 0,
                total:
                  item.quantity * item.unitCost * (1 - (item.discount || 0) / 100),
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
            runningBalance: 0, // Will be calculated when statement is generated
          },
        });
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
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create debit note:", error);
    return NextResponse.json(
      { error: "Failed to create debit note" },
      { status: 500 }
    );
  }
}
