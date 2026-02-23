import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createAutoJournalEntry } from "@/lib/accounting/journal";

export async function POST(
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
    const { cashBankAccountId } = body;

    if (!cashBankAccountId) {
      return NextResponse.json(
        { error: "Cash/bank account is required" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
        include: {
          items: {
            include: { account: true },
          },
        },
      });

      if (!expense) throw new Error("Expense not found");

      if (expense.status !== "APPROVED") {
        throw new Error("Only approved expenses can be paid");
      }

      const cashBankAccount = await tx.cashBankAccount.findFirst({
        where: { id: cashBankAccountId, organizationId },
      });

      if (!cashBankAccount) throw new Error("Cash/bank account not found");
      if (!cashBankAccount.accountId) throw new Error("Cash/bank account is not linked to a GL account");

      const totalAmount = Number(expense.total);

      // Update cash/bank account balance
      const newBalance = Number(cashBankAccount.balance) - totalAmount;
      await tx.cashBankAccount.update({
        where: { id: cashBankAccountId, organizationId },
        data: { balance: newBalance },
      });

      // Create cash/bank transaction
      await tx.cashBankTransaction.create({
        data: {
          cashBankAccountId,
          transactionType: "WITHDRAWAL",
          amount: -totalAmount,
          runningBalance: newBalance,
          description: `Expense ${expense.expenseNumber}`,
          referenceType: "EXPENSE",
          referenceId: expense.id,
          transactionDate: expense.expenseDate,
          organizationId,
        },
      });

      // Create journal entry: Debit expense account(s), Credit cash/bank
      const journalLines = expense.items.map((item) => ({
        accountId: item.accountId,
        description: item.description,
        debit: Number(item.amount),
        credit: 0,
      }));

      // Add tax as debit if applicable
      if (Number(expense.taxAmount) > 0) {
        // Find taxes payable account
        const taxAccount = await tx.account.findFirst({
          where: { organizationId, code: "2200" },
        });
        if (taxAccount) {
          journalLines.push({
            accountId: taxAccount.id,
            description: "Tax",
            debit: Number(expense.taxAmount),
            credit: 0,
          });
        } else {
          // Fallback: account 2200 not found — roll tax into first expense debit line
          // to keep the journal entry balanced (debit total must equal credit total)
          journalLines[0] = {
            ...journalLines[0],
            debit: journalLines[0].debit + Number(expense.taxAmount),
          };
        }
      }

      // Credit cash/bank for total
      journalLines.push({
        accountId: cashBankAccount.accountId,
        description: `Payment for ${expense.expenseNumber}`,
        debit: 0,
        credit: totalAmount,
      });

      const journalEntry = await createAutoJournalEntry(tx, organizationId, {
        date: expense.expenseDate,
        description: `Expense ${expense.expenseNumber}${expense.description ? `: ${expense.description}` : ""}`,
        sourceType: "EXPENSE",
        sourceId: expense.id,
        lines: journalLines,
      });

      // Update expense status and link
      const updated = await tx.expense.update({
        where: { id, organizationId },
        data: {
          status: "PAID",
          cashBankAccountId,
          journalEntryId: journalEntry?.id || null,
        },
        include: {
          items: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
          cashBankAccount: { select: { id: true, name: true } },
        },
      });

      return updated;
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to pay expense:", error);
    const message = error instanceof Error ? error.message : "Failed to pay expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
