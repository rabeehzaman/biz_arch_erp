import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { restoreStockFromConsumptions, recalculateFromDate, consumeStockFIFO, isBackdated, getRecalculationStartDate } from "@/lib/inventory/fifo";
import { syncInvoiceRevenueJournal, syncInvoiceCOGSJournal } from "@/lib/accounting/journal";

// Helper to check if user can access an invoice (based on customer assignment)
async function canAccessInvoice(invoiceId: string, userId: string, isAdmin: boolean, organizationId: string) {
  if (isAdmin) return true;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, organizationId },
    select: {
      customer: {
        select: {
          assignments: {
            where: { userId },
            select: { id: true }
          }
        }
      }
    },
  });

  if (!invoice) return false;

  return invoice.customer.assignments.length > 0;
}

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
    const isAdmin = session.user.role === "admin";

    if (!await canAccessInvoice(id, session.user.id, isAdmin, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
            lotConsumptions: true,
          },
        },
        payments: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
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
    const isAdmin = session.user.role === "admin";

    if (!await canAccessInvoice(id, session.user.id, isAdmin, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, issueDate, dueDate, taxRate, notes, terms, items } = body;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            lotConsumptions: true,
          },
        },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if any items have stock consumptions
    const hasConsumptions = existingInvoice.items.some(
      (item) => item.lotConsumptions.length > 0
    );

    const result = await prisma.$transaction(async (tx) => {
      // Collect warnings from FIFO consumption
      const warnings: string[] = [];

      // Get products that had consumptions for FIFO recalculation
      const productsWithConsumptions = existingInvoice.items
        .filter((item) => item.lotConsumptions.length > 0)
        .map((item) => item.productId!)
        .filter(Boolean);

      // Restore stock from old consumptions
      for (const item of existingInvoice.items) {
        if (item.lotConsumptions.length > 0) {
          await restoreStockFromConsumptions(item.id, tx);
        }
      }

      // Delete old auto journal entries so they get recreated with updated amounts
      await tx.journalEntry.deleteMany({
        where: { sourceType: "INVOICE", sourceId: id, organizationId },
      });

      // Delete old items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Calculate new totals with item-level discounts
      const subtotal = items.reduce(
        (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
          sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        0
      );
      const taxRateNum = taxRate || 0;
      const taxAmount = (subtotal * taxRateNum) / 100;
      const total = subtotal + taxAmount;

      // Calculate balance change for customer
      const oldTotal = Number(existingInvoice.total);
      const oldAmountPaid = Number(existingInvoice.amountPaid);
      const oldBalanceDue = oldTotal - oldAmountPaid;
      const newBalanceDue = total - oldAmountPaid;
      const balanceChange = newBalanceDue - oldBalanceDue;

      // Update invoice
      await tx.invoice.update({
        where: { id, organizationId },
        data: {
          customerId,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          taxRate: taxRateNum,
          notes,
          terms,
          subtotal,
          taxAmount,
          total,
          balanceDue: newBalanceDue,
          items: {
            create: items.map((item: {
              productId: string;
              description: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
            }) => ({
              organizationId,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
              costOfGoodsSold: 0,
            })),
          },
        },
      });

      // Update customer balance
      const customerChanged = customerId !== existingInvoice.customerId;

      if (customerChanged) {
        // Remove old invoice impact from old customer
        await tx.customer.update({
          where: { id: existingInvoice.customerId, organizationId },
          data: { balance: { decrement: oldBalanceDue } },
        });
        // Add new invoice impact to new customer
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: { balance: { increment: newBalanceDue } },
        });
        // Update and move CustomerTransaction to new customer
        await tx.customerTransaction.updateMany({
          where: { invoiceId: id },
          data: { customerId, amount: total },
        });
      } else if (balanceChange !== 0) {
        // Same customer, total changed — apply delta
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: { balance: { increment: balanceChange } },
        });
        await tx.customerTransaction.updateMany({
          where: { invoiceId: id },
          data: { amount: total },
        });
      }

      // Get the updated invoice with items
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      // Get unique product IDs to check for backdating
      const productIds = items
        .filter((item: { productId?: string }) => item.productId)
        .map((item: { productId: string }) => item.productId);
      const uniqueProductIds: string[] = [...new Set<string>(productIds)];

      // Check if any products are backdated before consuming
      const backdatedProducts = new Set<string>();
      for (const productId of uniqueProductIds) {
        const backdated = await isBackdated(productId, new Date(issueDate), tx);
        if (backdated) {
          backdatedProducts.add(productId);
        }
      }

      // Consume stock for each new item with a productId
      if (updatedInvoice) {
        const newInvoiceDate = new Date(issueDate);
        for (const invoiceItem of updatedInvoice.items) {
          if (invoiceItem.productId) {
            if (!backdatedProducts.has(invoiceItem.productId)) {
              // Normal flow: consume stock and update COGS
              const fifoResult = await consumeStockFIFO(
                invoiceItem.productId,
                invoiceItem.quantity,
                invoiceItem.id,
                newInvoiceDate,
                tx,
                organizationId
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
            // If backdated, COGS remains 0 and will be set by recalculation
          }
        }
      }

      // Recalculate FIFO for products that had consumptions or are backdated
      const allProductIds = new Set([
        ...productsWithConsumptions,
        ...items
          .filter((item: { productId?: string }) => item.productId)
          .map((item: { productId: string }) => item.productId),
      ]);

      const recalcDate = getRecalculationStartDate(existingInvoice.issueDate, new Date(issueDate));

      for (const productId of allProductIds) {
        const backdated = await isBackdated(productId, new Date(issueDate), tx);
        if (hasConsumptions || backdated) {
          await recalculateFromDate(productId, recalcDate, tx, "recalculation", undefined, organizationId);
        }
      }

      // Recreate journal entries that were deleted at the start
      await syncInvoiceRevenueJournal(tx, organizationId, id);
      await syncInvoiceCOGSJournal(tx, organizationId, id);

      // Fetch the final updated invoice
      const finalInvoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
        },
      });

      return { invoice: finalInvoice, warnings };
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { action } = body;

    if (action === "markSent") {
      const invoice = await prisma.invoice.update({
        where: { id, organizationId },
        data: { sentAt: new Date() },
      });
      return NextResponse.json(invoice);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to patch invoice:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
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
    const isAdmin = session.user.role === "admin";

    if (!await canAccessInvoice(id, session.user.id, isAdmin, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get invoice with items and consumptions
    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            lotConsumptions: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check which products had stock consumed
    const productsWithConsumptions = invoice.items
      .filter((item) => item.lotConsumptions.length > 0)
      .map((item) => ({
        productId: item.productId!,
        hasConsumptions: true,
      }));

    await prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of invoice.items) {
        if (item.lotConsumptions.length > 0) {
          await restoreStockFromConsumptions(item.id, tx);
        }
      }

      // Find payments linked to this invoice
      const linkedPayments = await tx.payment.findMany({
        where: { invoiceId: id },
        select: { id: true },
      });
      const paymentIds = linkedPayments.map((p) => p.id);

      // Revert cashbook entries for these payments
      if (paymentIds.length > 0) {
        const cashTransactions = await tx.cashBankTransaction.findMany({
          where: { referenceType: "PAYMENT", referenceId: { in: paymentIds } },
        });

        // Revert cash/bank account balances (deposits increased balance, so we decrement)
        for (const cbTx of cashTransactions) {
          await tx.cashBankAccount.update({
            where: { id: cbTx.cashBankAccountId },
            data: { balance: { decrement: cbTx.amount } },
          });
        }

        // Delete the cash/bank transactions
        await tx.cashBankTransaction.deleteMany({
          where: { referenceType: "PAYMENT", referenceId: { in: paymentIds } },
        });
      }

      // Delete CustomerTransaction records for invoice and its payments
      await tx.customerTransaction.deleteMany({
        where: {
          OR: [
            { invoiceId: id },
            ...(paymentIds.length > 0
              ? [{ paymentId: { in: paymentIds } }]
              : []),
          ],
        },
      });

      // Delete payment allocations for this invoice
      await tx.paymentAllocation.deleteMany({
        where: { invoiceId: id },
      });

      // Delete payments linked to this invoice
      if (paymentIds.length > 0) {
        await tx.payment.deleteMany({
          where: { id: { in: paymentIds } },
        });
      }

      // Unlink credit notes that reference this invoice
      await tx.creditNote.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null },
      });

      // Unlink quotation that was converted to this invoice
      await tx.quotation.updateMany({
        where: { convertedInvoiceId: id },
        data: { convertedInvoiceId: null, convertedAt: null },
      });

      // Delete journal entries for this invoice
      await tx.journalEntry.deleteMany({
        where: { sourceType: "INVOICE", sourceId: id, organizationId },
      });

      // Delete invoice (cascade will delete items and their consumptions)
      await tx.invoice.delete({
        where: { id, organizationId },
      });

      // Update customer balance (subtract the unpaid amount)
      const unpaidAmount = Number(invoice.total) - Number(invoice.amountPaid);
      await tx.customer.update({
        where: { id: invoice.customerId, organizationId },
        data: {
          balance: { decrement: unpaidAmount },
        },
      });

      // Recalculate FIFO for affected products
      for (const { productId } of productsWithConsumptions) {
        await recalculateFromDate(productId, invoice.issueDate, tx, "recalculation", undefined, organizationId);
      }
    }, { timeout: 30000 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
