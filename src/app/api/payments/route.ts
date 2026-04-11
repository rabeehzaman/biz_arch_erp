import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PaymentMethod } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import { createAutoJournalEntry, getSystemAccount, getDefaultCashBankAccount } from "@/lib/accounting/journal";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { getUserAllowedBranchIds, buildBranchWhereClause } from "@/lib/user-access";

// Generate payment number: PAY-YYYYMMDD-XXX
async function generatePaymentNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PAY-${dateStr}`;

  const lastPayment = await prisma.payment.findFirst({
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

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { limit, offset, search } = parsePagination(request);
    const isAdmin = isAdminRole(session.user.role);
    const userId = session.user.id;

    const allowedBranchIds = await getUserAllowedBranchIds(prisma, organizationId, userId!, session.user.role);
    if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
      return paginatedResponse([], 0, false);
    }
    const branchFilter = buildBranchWhereClause(allowedBranchIds, { includeNullBranch: true });

    const baseWhere = isAdmin
      ? { organizationId, ...branchFilter }
      : { organizationId, customer: { assignments: { some: { userId } } }, ...branchFilter };
    const where = search
      ? {
          ...baseWhere,
          OR: [
            { paymentNumber: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : baseWhere;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: { id: true, name: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return paginatedResponse(payments, total, offset + payments.length < total);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
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
    const { customerId, invoiceId, amount, paymentDate, paymentMethod: rawMethod, reference, notes, discountReceived: rawDiscount, adjustmentAccountId, cashBankAccountId, allocations, isAdvance } = body;
    const discountReceived = rawDiscount || 0;
    // Normalize paymentMethod to uppercase enum value
    let paymentMethod = (rawMethod ? String(rawMethod).toUpperCase().replace(/\s+/g, "_") : "CASH") as PaymentMethod;

    if (!customerId || !amount) {
      return NextResponse.json(
        { error: "Customer and amount are required" },
        { status: 400 }
      );
    }

    if (paymentMethod === "ADJUSTMENT" && !adjustmentAccountId) {
      return NextResponse.json(
        { error: "Adjustment account is required" },
        { status: 400 }
      );
    }

    if (isAdvance && (invoiceId || (allocations && allocations.length > 0))) {
      return NextResponse.json(
        { error: "Advance payments cannot be allocated to invoices" },
        { status: 400 }
      );
    }

    const paymentNumber = await generatePaymentNumber(organizationId);
    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Use transaction to ensure data consistency
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId,
          invoiceId: isAdvance ? null : (invoiceId || null),
          amount,
          discountReceived,
          paymentDate: parsedPaymentDate,
          paymentMethod: paymentMethod,
          reference: reference || null,
          notes: notes || null,
          isAdvance: !!isAdvance,
          adjustmentAccountId: paymentMethod === "ADJUSTMENT" ? adjustmentAccountId : null,
          organizationId,
        },
      });

      // Total settlement = cash received + discount
      const totalSettlement = Number(amount) + Number(discountReceived);

      // Update customer balance
      if (isAdvance) {
        // Advance: increase advance balance (liability), do NOT touch AR balance
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: {
            advanceBalance: { increment: totalSettlement },
          },
        });
      } else {
        // Regular: amount + discount settles the AR balance
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: {
            balance: { decrement: totalSettlement },
          },
        });
      }

      // Apply payment to invoices (skip for advance payments)
      if (allocations && Array.isArray(allocations) && allocations.length > 0) {
        // Explicit multi-invoice allocation from create page
        for (const alloc of allocations) {
          const invoice = await tx.invoice.findUnique({
            where: { id: alloc.invoiceId, organizationId },
            select: { id: true, total: true, amountPaid: true, balanceDue: true },
          });
          if (!invoice) continue;

          const applyAmount = Math.min(Number(alloc.amount), Number(invoice.balanceDue));
          if (applyAmount <= 0) continue;

          await tx.invoice.update({
            where: { id: invoice.id, organizationId },
            data: {
              amountPaid: { increment: applyAmount },
              balanceDue: { decrement: applyAmount },
            },
          });

          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              invoiceId: invoice.id,
              amount: applyAmount,
              organizationId,
            },
          });
        }
      } else if (invoiceId) {
        // Specific invoice selected - apply to that invoice only
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId, organizationId },
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        if (invoice) {
          const applyAmount = Math.min(totalSettlement, Number(invoice.balanceDue));
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;

          await tx.invoice.update({
            where: { id: invoiceId, organizationId },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
            },
          });

          // Create allocation record
          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              invoiceId: invoiceId,
              amount: applyAmount,
              organizationId,
            },
          });
        }
      } else {
        // No specific invoice - FIFO auto-apply to unpaid invoices
        const unpaidInvoices = await tx.invoice.findMany({
          where: {
            customerId,
            organizationId,
            balanceDue: { gt: 0 },
          },
          orderBy: { issueDate: "asc" }, // Oldest first (FIFO)
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        let remainingAmount = totalSettlement;

        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break;

          const balanceDue = Number(invoice.balanceDue);
          const applyAmount = Math.min(remainingAmount, balanceDue);

          // Update invoice
          await tx.invoice.update({
            where: { id: invoice.id, organizationId },
            data: {
              amountPaid: { increment: applyAmount },
              balanceDue: { decrement: applyAmount },
            },
          });

          // Create allocation record
          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              invoiceId: invoice.id,
              amount: applyAmount,
              organizationId,
            },
          });

          remainingAmount -= applyAmount;
        }
        // Any remaining amount just reduces customer balance (already done above)
      }

      // Create auto journal entry: DR Cash/Bank [amount], DR Sales Discounts [discount], CR Accounts Receivable [totalSettlement]
      // Or in the case of ADJUSTMENT: DR Selected Adjustment Account [amount]...
      const arAccount = await getSystemAccount(tx, organizationId, "1300");
      let debitAccountId: string | null = null;
      let cashBankInfo = null;

      if (paymentMethod === "ADJUSTMENT") {
        debitAccountId = adjustmentAccountId;
      } else if (cashBankAccountId) {
        // Use explicitly selected cash/bank account
        const selectedAccount = await tx.cashBankAccount.findFirst({
          where: { id: cashBankAccountId, organizationId, isActive: true },
          select: { id: true, accountId: true, accountSubType: true },
        });
        if (selectedAccount) {
          cashBankInfo = { accountId: selectedAccount.accountId, cashBankAccountId: selectedAccount.id };
          debitAccountId = selectedAccount.accountId;
          paymentMethod = (selectedAccount.accountSubType === "CASH" ? "CASH" : "BANK_TRANSFER") as PaymentMethod;
        } else {
          console.error(`[payments] Selected cash/bank account "${cashBankAccountId}" not found or inactive in org ${organizationId} — falling back to default.`);
          cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, paymentMethod);
          if (cashBankInfo) debitAccountId = cashBankInfo.accountId;
        }
      } else {
        cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, paymentMethod);
        if (cashBankInfo) {
          debitAccountId = cashBankInfo.accountId;
        } else {
          console.error(`[payments] No active cash/bank account found for method "${paymentMethod}" in org ${organizationId} — journal entry and cash balance update skipped for payment ${paymentNumber}.`);
        }
      }

      if (!arAccount) {
        console.error(`[payments] No AR account (1300) found for org ${organizationId} — journal entry skipped for payment ${paymentNumber}. Ensure COA is seeded.`);
      }

      if (arAccount && debitAccountId) {
        const paymentLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
          { accountId: debitAccountId, description: paymentMethod === "ADJUSTMENT" ? "Customer Balance Adjustment" : "Cash/Bank", debit: Number(amount), credit: 0 },
          { accountId: arAccount.id, description: "Accounts Receivable", debit: 0, credit: totalSettlement },
        ];

        // Record discount allowed as a debit to Sales Discounts if applicable
        if (Number(discountReceived) > 0) {
          const discountAccount = await getSystemAccount(tx, organizationId, "4200");
          if (discountAccount) {
            paymentLines.push({ accountId: discountAccount.id, description: "Sales Discount Allowed", debit: Number(discountReceived), credit: 0 });
          } else {
            // Fallback: no discount account, reduce AR credit to actual cash only
            paymentLines[1] = { accountId: arAccount.id, description: "Accounts Receivable", debit: 0, credit: Number(amount) };
          }
        }

        await createAutoJournalEntry(tx, organizationId, {
          date: parsedPaymentDate,
          description: paymentMethod === "ADJUSTMENT" ? `Customer Adjustment ${paymentNumber}` : `Customer Payment ${paymentNumber}`,
          sourceType: "PAYMENT",
          sourceId: newPayment.id,
          lines: paymentLines,
        });

        // Update cash/bank account balance — only actual cash received, and ONLY IF not an adjustment
        if (paymentMethod !== "ADJUSTMENT" && cashBankInfo) {
          await tx.cashBankAccount.update({
            where: { id: cashBankInfo.cashBankAccountId, organizationId },
            data: { balance: { increment: Number(amount) } },
          });

          // Create cash/bank transaction for actual cash received
          const updatedCB = await tx.cashBankAccount.findUnique({
            where: { id: cashBankInfo.cashBankAccountId },
          });
          await tx.cashBankTransaction.create({
            data: {
              cashBankAccountId: cashBankInfo.cashBankAccountId,
              transactionType: "DEPOSIT",
              amount: Number(amount),
              runningBalance: Number(updatedCB?.balance || 0),
              description: `Customer Payment ${paymentNumber}`,
              referenceType: "PAYMENT",
              referenceId: newPayment.id,
              transactionDate: parsedPaymentDate,
              organizationId,
            },
          });
        }
      }

      // Create CustomerTransaction record for audit trail
      await tx.customerTransaction.create({
        data: {
          customerId,
          transactionType: paymentMethod === "ADJUSTMENT" ? "ADJUSTMENT" : "PAYMENT",
          transactionDate: parsedPaymentDate,
          amount: -totalSettlement, // Negative for credit (payment + discount reduces balance)
          description: invoiceId
            ? `Payment ${paymentNumber}`
            : `Payment ${paymentNumber} (Auto-Applied)`,
          paymentId: newPayment.id,
          runningBalance: 0, // Will be recalculated when viewing statement
          organizationId,
        },
      });

      return newPayment;
    }, { timeout: 60000 });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
