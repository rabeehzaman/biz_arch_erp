import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  createStockLotFromCreditNote,
  getOriginalCOGSForInvoiceItem,
} from "@/lib/inventory/returns";
import { isBackdated, recalculateFromDate } from "@/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

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

export async function GET(request: NextRequest) {
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

    const creditNoteNumber = await generateCreditNoteNumber(organizationId);
    const creditNoteDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate totals with item-level discounts
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

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          organizationId,
          creditNoteNumber,
          customerId,
          createdById: session.user.id,
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
          customer: true,
          items: true,
        },
      });

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

          // Create stock lot
          await createStockLotFromCreditNote(
            creditNoteItem.id,
            creditNoteItem.productId,
            creditNoteItem.quantity,
            unitCost,
            creditNoteDate,
            tx,
            organizationId
          );

          // Accumulate COGS for the GL reversal entry
          totalReturnedCOGS += Number(unitCost) * Number(creditNoteItem.quantity);

          productsToRecalculate.add(creditNoteItem.productId);
        }
      }

      // Update customer balance (decrement - reduces receivable)
      if (appliedToBalance) {
        await tx.customer.update({
          where: { id: customerId },
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

      // Create auto journal entry: DR Sales Revenue [+ DR Tax Payable], CR Accounts Receivable
      if (appliedToBalance) {
        const revenueAccount = await getSystemAccount(tx, organizationId, "4100");
        const arAccount = await getSystemAccount(tx, organizationId, "1300");
        if (revenueAccount && arAccount) {
          const returnLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
            { accountId: revenueAccount.id, description: "Sales Revenue (Return)", debit: subtotal, credit: 0 },
            { accountId: arAccount.id, description: "Accounts Receivable", debit: 0, credit: total },
          ];
          if (taxAmount > 0) {
            const taxPayableAccount = await getSystemAccount(tx, organizationId, "2200");
            if (taxPayableAccount) {
              returnLines.push({ accountId: taxPayableAccount.id, description: "Tax Payable (Return)", debit: taxAmount, credit: 0 });
            } else {
              // Fallback: lump tax into revenue reversal
              returnLines[0] = { accountId: revenueAccount.id, description: "Sales Revenue (Return)", debit: total, credit: 0 };
            }
          }
          await createAutoJournalEntry(tx, organizationId, {
            date: creditNoteDate,
            description: `Credit Note ${creditNoteNumber}`,
            sourceType: "CREDIT_NOTE",
            sourceId: creditNote.id,
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
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create credit note:", error);
    return NextResponse.json(
      { error: "Failed to create credit note" },
      { status: 500 }
    );
  }
}
