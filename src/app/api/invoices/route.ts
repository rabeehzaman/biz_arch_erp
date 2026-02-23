import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { consumeStockFIFO, recalculateFromDate, isBackdated } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

// Generate invoice number: INV-YYYYMMDD-XXX
async function generateInvoiceNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix }, organizationId },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0");
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

    const invoices = await prisma.invoice.findMany({
      where: isAdmin ? { organizationId } : {
        organizationId,
        customer: {
          assignments: {
            some: { userId }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
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
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, issueDate, dueDate, items, taxRate, notes, terms } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    if (!issueDate || !dueDate) {
      return NextResponse.json(
        { error: "Issue date and due date are required" },
        { status: 400 }
      );
    }

    const invoiceNumber = await generateInvoiceNumber(organizationId);
    const invoiceDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate totals with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
        sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;
    const balanceDue = total;

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          customerId,
          createdById: userId,
          issueDate: invoiceDate,
          dueDate: new Date(dueDate),
          subtotal,
          taxRate: taxRate || 0,
          taxAmount,
          total,
          balanceDue,
          notes: notes || null,
          terms: terms || null,
          items: {
            create: items.map((item: {
              productId?: string;
              description: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
            }) => ({
              organizationId,
              productId: item.productId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
              costOfGoodsSold: 0, // Will be updated below
            })),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Collect warnings from FIFO consumption
      const warnings: string[] = [];

      // Get unique product IDs to check for backdating
      const productIds = items
        .filter((item: { productId?: string }) => item.productId)
        .map((item: { productId: string }) => item.productId);
      const uniqueProductIds: string[] = [...new Set<string>(productIds)];

      // OPTIMIZATION: Check if any products are backdated before consuming
      const backdatedProducts = new Set<string>();
      for (const productId of uniqueProductIds) {
        const backdated = await isBackdated(productId, invoiceDate, tx);
        if (backdated) {
          backdatedProducts.add(productId);
        }
      }

      // Consume stock for each item with a productId
      // If product is backdated, skip individual consumption (will be handled by recalculation)
      for (const invoiceItem of invoice.items) {
        if (invoiceItem.productId) {
          if (!backdatedProducts.has(invoiceItem.productId)) {
            // Normal flow: consume stock and update COGS
            const fifoResult = await consumeStockFIFO(
              invoiceItem.productId,
              invoiceItem.quantity,
              invoiceItem.id,
              invoiceDate,
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

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId, organizationId },
        data: {
          balance: { increment: total },
        },
      });

      // Create CustomerTransaction record for invoice
      await tx.customerTransaction.create({
        data: {
          organizationId,
          customerId,
          transactionType: "INVOICE",
          transactionDate: invoiceDate,
          amount: total, // Positive = debit (customer owes)
          description: `Invoice ${invoiceNumber}`,
          invoiceId: invoice.id,
          runningBalance: 0, // Will be recalculated if needed
        },
      });

      // Recalculate FIFO for backdated products
      for (const productId of backdatedProducts) {
        await recalculateFromDate(
          productId,
          invoiceDate,
          tx,
          "backdated_invoice",
          `Invoice created with date ${invoiceDate.toISOString().split("T")[0]}`,
          organizationId
        );
      }

      // Re-fetch all invoice items to get final COGS values (includes backdated recalculations)
      const finalItems = await tx.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
      const totalCOGS = finalItems.reduce((sum, item) => sum + Number(item.costOfGoodsSold), 0);

      // Create auto journal entry: DR Accounts Receivable, CR Sales Revenue [+ CR Tax Payable]
      const arAccount = await getSystemAccount(tx, organizationId, "1300");
      const revenueAccount = await getSystemAccount(tx, organizationId, "4100");
      if (arAccount && revenueAccount) {
        const revenueLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
          { accountId: arAccount.id, description: "Accounts Receivable", debit: total, credit: 0 },
          { accountId: revenueAccount.id, description: "Sales Revenue", debit: 0, credit: subtotal },
        ];
        if (taxAmount > 0) {
          const taxPayableAccount = await getSystemAccount(tx, organizationId, "2200");
          if (taxPayableAccount) {
            revenueLines.push({ accountId: taxPayableAccount.id, description: "Tax Payable", debit: 0, credit: taxAmount });
          } else {
            // Fallback: lump tax into revenue if account 2200 not found
            revenueLines[1] = { accountId: revenueAccount.id, description: "Sales Revenue", debit: 0, credit: total };
          }
        }
        await createAutoJournalEntry(tx, organizationId, {
          date: invoiceDate,
          description: `Sales Invoice ${invoiceNumber}`,
          sourceType: "INVOICE",
          sourceId: invoice.id,
          lines: revenueLines,
        });
      }

      // Create COGS journal entry: DR Cost of Goods Sold, CR Inventory
      if (totalCOGS > 0) {
        const cogsAccount = await getSystemAccount(tx, organizationId, "5100");
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        if (cogsAccount && inventoryAccount) {
          await createAutoJournalEntry(tx, organizationId, {
            date: invoiceDate,
            description: `COGS - ${invoiceNumber}`,
            sourceType: "INVOICE",
            sourceId: invoice.id,
            lines: [
              { accountId: cogsAccount.id, description: "Cost of Goods Sold", debit: totalCOGS, credit: 0 },
              { accountId: inventoryAccount.id, description: "Inventory", debit: 0, credit: totalCOGS },
            ],
          });
        }
      }

      // Fetch the updated invoice with COGS
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          items: true,
        },
      });

      return { invoice: updatedInvoice, warnings };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    console.error("Failed to create invoice:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
