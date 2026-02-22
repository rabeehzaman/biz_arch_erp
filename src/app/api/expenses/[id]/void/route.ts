import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createAutoJournalEntry } from "@/lib/accounting/journal";

export async function POST(
  _request: NextRequest,
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
      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
        include: {
          journalEntry: { include: { lines: true } },
        },
      });

      if (!expense) throw new Error("Expense not found");

      if (expense.status === "VOID") {
        throw new Error("Expense is already void");
      }

      // If paid, reverse the cash/bank transaction
      if (expense.status === "PAID" && expense.cashBankAccountId) {
        const totalAmount = Number(expense.total);

        // Reverse cash/bank balance
        await tx.cashBankAccount.update({
          where: { id: expense.cashBankAccountId, organizationId },
          data: { balance: { increment: totalAmount } },
        });

        // Get current balance for running balance
        const account = await tx.cashBankAccount.findUnique({
          where: { id: expense.cashBankAccountId },
        });

        // Create reversal transaction
        await tx.cashBankTransaction.create({
          data: {
            cashBankAccountId: expense.cashBankAccountId,
            transactionType: "DEPOSIT",
            amount: totalAmount,
            runningBalance: Number(account?.balance || 0),
            description: `Void: Expense ${expense.expenseNumber}`,
            referenceType: "EXPENSE",
            referenceId: expense.id,
            transactionDate: new Date(),
            organizationId,
          },
        });

        // Void journal entry and create reversal
        if (expense.journalEntry) {
          await tx.journalEntry.update({
            where: { id: expense.journalEntry.id, organizationId },
            data: { status: "VOID" },
          });

          // Create reversal journal entry
          await createAutoJournalEntry(tx, organizationId, {
            date: new Date(),
            description: `Reversal: Expense ${expense.expenseNumber}`,
            sourceType: "EXPENSE",
            sourceId: expense.id,
            lines: expense.journalEntry.lines.map((line) => ({
              accountId: line.accountId,
              description: `Reversal`,
              debit: Number(line.credit),
              credit: Number(line.debit),
            })),
          });
        }
      }

      // Update expense status
      const updated = await tx.expense.update({
        where: { id, organizationId },
        data: { status: "VOID" },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to void expense:", error);
    const message = error instanceof Error ? error.message : "Failed to void expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
