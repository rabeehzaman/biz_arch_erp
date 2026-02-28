import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PaymentMethod } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createAutoJournalEntry, getSystemAccount, getDefaultCashBankAccount } from "@/lib/accounting/journal";

// Generate supplier payment number: SPAY-YYYYMMDD-XXX
async function generateSupplierPaymentNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `SPAY-${dateStr}`;

  const lastPayment = await prisma.supplierPayment.findFirst({
    where: { paymentNumber: { startsWith: prefix }, organizationId },
    orderBy: { paymentNumber: "desc" },
  });

  let sequence = 1;
  if (lastPayment) {
    const lastSequence = parseInt(lastPayment.paymentNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const payments = await prisma.supplierPayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
        purchaseInvoice: {
          select: { id: true, purchaseInvoiceNumber: true },
        },
      },
    });
    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch supplier payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier payments" },
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
    const { supplierId, purchaseInvoiceId, amount, paymentDate, paymentMethod: rawMethod, reference, notes, discountGiven: rawDiscount } = body;
    const discountGiven = rawDiscount || 0;
    // Normalize paymentMethod to uppercase enum value
    const paymentMethod = (rawMethod ? String(rawMethod).toUpperCase().replace(/\s+/g, "_") : "CASH") as PaymentMethod;

    if (!supplierId || !amount) {
      return NextResponse.json(
        { error: "Supplier and amount are required" },
        { status: 400 }
      );
    }

    const paymentNumber = await generateSupplierPaymentNumber(organizationId);
    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Use transaction to ensure data consistency
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          amount,
          discountGiven,
          paymentDate: parsedPaymentDate,
          paymentMethod: paymentMethod,
          reference: reference || null,
          notes: notes || null,
          organizationId,
        },
      });

      // Total settlement = cash paid + discount received from supplier
      const totalSettlement = Number(amount) + Number(discountGiven);

      // Update supplier balance (decrease payable by amount + discount)
      await tx.supplier.update({
        where: { id: supplierId, organizationId },
        data: {
          balance: { decrement: totalSettlement },
        },
      });

      // Create auto journal entry: DR Accounts Payable [totalSettlement], CR Cash/Bank [amount], CR Purchase Discounts [discount]
      const apAccount = await getSystemAccount(tx, organizationId, "2100");
      const cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, paymentMethod);
      if (!apAccount) {
        console.error(`[supplier-payments] No AP account (2100) found for org ${organizationId} — journal entry skipped for payment ${paymentNumber}. Ensure COA is seeded.`);
      }
      if (!cashBankInfo) {
        console.error(`[supplier-payments] No active cash/bank account found for method "${paymentMethod || "CASH"}" in org ${organizationId} — journal entry and cash balance update skipped for payment ${paymentNumber}.`);
      }
      if (apAccount && cashBankInfo) {
        const paymentLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
          { accountId: apAccount.id, description: "Accounts Payable", debit: totalSettlement, credit: 0 },
          { accountId: cashBankInfo.accountId, description: "Cash/Bank", debit: 0, credit: Number(amount) },
        ];

        // Record purchase discount received from supplier
        if (Number(discountGiven) > 0) {
          const discountAccount = await getSystemAccount(tx, organizationId, "5600");
          if (discountAccount) {
            paymentLines.push({ accountId: discountAccount.id, description: "Purchase Discount Received", debit: 0, credit: Number(discountGiven) });
          } else {
            // Fallback: no discount account, reduce AP debit to actual cash only
            paymentLines[0] = { accountId: apAccount.id, description: "Accounts Payable", debit: Number(amount), credit: 0 };
          }
        }

        await createAutoJournalEntry(tx, organizationId, {
          date: parsedPaymentDate,
          description: `Supplier Payment ${paymentNumber}`,
          sourceType: "SUPPLIER_PAYMENT",
          sourceId: newPayment.id,
          lines: paymentLines,
        });

        // Update cash/bank account balance — only actual cash paid
        await tx.cashBankAccount.update({
          where: { id: cashBankInfo.cashBankAccountId, organizationId },
          data: { balance: { decrement: Number(amount) } },
        });

        // Create cash/bank transaction for actual cash paid
        const updatedCB = await tx.cashBankAccount.findUnique({
          where: { id: cashBankInfo.cashBankAccountId },
        });
        await tx.cashBankTransaction.create({
          data: {
            cashBankAccountId: cashBankInfo.cashBankAccountId,
            transactionType: "WITHDRAWAL",
            amount: -Number(amount),
            runningBalance: Number(updatedCB?.balance || 0),
            description: `Supplier Payment ${paymentNumber}`,
            referenceType: "SUPPLIER_PAYMENT",
            referenceId: newPayment.id,
            transactionDate: parsedPaymentDate,
            organizationId,
          },
        });
      }

      // Create SupplierTransaction record for payment
      await tx.supplierTransaction.create({
        data: {
          supplierId,
          transactionType: "PAYMENT",
          transactionDate: parsedPaymentDate,
          amount: -totalSettlement, // Negative = reduces what we owe (payment + discount)
          description: purchaseInvoiceId
            ? `Payment ${paymentNumber} for purchase invoice`
            : `Payment ${paymentNumber} (On Account)`,
          supplierPaymentId: newPayment.id,
          runningBalance: 0, // Will be recalculated if needed
          organizationId,
        },
      });

      // Apply payment to purchase invoices
      if (purchaseInvoiceId) {
        // Specific invoice selected - apply to that invoice only
        const invoice = await tx.purchaseInvoice.findUnique({
          where: { id: purchaseInvoiceId, organizationId },
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        if (invoice) {
          const applyAmount = Math.min(totalSettlement, Number(invoice.balanceDue));
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

          await tx.purchaseInvoice.update({
            where: { id: purchaseInvoiceId, organizationId },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
              status: newStatus,
            },
          });

          // Create allocation record
          await tx.supplierPaymentAllocation.create({
            data: {
              supplierPaymentId: newPayment.id,
              purchaseInvoiceId: purchaseInvoiceId,
              amount: applyAmount,
              organizationId,
            },
          });
        }
      } else {
        // No specific invoice - FIFO auto-apply to unpaid purchase invoices
        const unpaidInvoices = await tx.purchaseInvoice.findMany({
          where: {
            supplierId,
            organizationId,
            balanceDue: { gt: 0 },
          },
          orderBy: { invoiceDate: "asc" }, // Oldest first (FIFO)
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        let remainingAmount = totalSettlement;

        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break;

          const balanceDue = Number(invoice.balanceDue);
          const applyAmount = Math.min(remainingAmount, balanceDue);
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

          // Update invoice
          await tx.purchaseInvoice.update({
            where: { id: invoice.id, organizationId },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
              status: newStatus,
            },
          });

          // Create allocation record
          await tx.supplierPaymentAllocation.create({
            data: {
              supplierPaymentId: newPayment.id,
              purchaseInvoiceId: invoice.id,
              amount: applyAmount,
              organizationId,
            },
          });

          remainingAmount -= applyAmount;
        }
        // Any remaining amount just reduces supplier balance (already done above)
      }

      return newPayment;
    }, { timeout: 30000 });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create supplier payment:", error);
    return NextResponse.json(
      { error: "Failed to create supplier payment" },
      { status: 500 }
    );
  }
}
