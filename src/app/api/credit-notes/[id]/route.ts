import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  createStockLotFromCreditNote,
  deleteStockLotFromCreditNote,
  getOriginalCOGSForInvoiceItem,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";

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
      taxRate,
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

    const creditNoteDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate new totals
    const subtotal = items.reduce(
      (
        sum: number,
        item: { quantity: number; unitPrice: number; discount?: number }
      ) =>
        sum +
        item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;

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
          where: { id: oldCreditNote.customerId },
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
          where: { id: oldCreditNote.invoiceId },
          data: {
            balanceDue: { increment: oldCreditNote.total },
          },
        });
      }

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
          taxRate: taxRate || 0,
          taxAmount,
          total,
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
              }) => ({
                organizationId,
                invoiceItemId: item.invoiceItemId || null,
                productId: item.productId || null,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                total:
                  item.quantity *
                  item.unitPrice *
                  (1 - (item.discount || 0) / 100),
                originalCOGS: item.originalCOGS || 0,
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

          await createStockLotFromCreditNote(
            creditNoteItem.id,
            creditNoteItem.productId,
            creditNoteItem.quantity,
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
          where: { id: customerId },
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
    });

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
          where: { id: creditNote.customerId },
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
          where: { id: creditNote.invoiceId },
          data: {
            balanceDue: { increment: creditNote.total },
          },
        });
      }

      // Delete the credit note (cascade will delete items)
      await tx.creditNote.delete({
        where: { id },
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
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to delete credit note:", error);
    return NextResponse.json(
      { error: "Failed to delete credit note" },
      { status: 500 }
    );
  }
}
