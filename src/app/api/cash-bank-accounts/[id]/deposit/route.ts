import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

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
    const { amount, description, transactionDate, referenceType, referenceId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.cashBankAccount.findFirst({
        where: { id, organizationId },
      });

      if (!account) throw new Error("Account not found");

      const newBalance = Number(account.balance) + Number(amount);

      // Update balance
      await tx.cashBankAccount.update({
        where: { id, organizationId },
        data: { balance: newBalance },
      });

      // Create transaction
      const transaction = await tx.cashBankTransaction.create({
        data: {
          cashBankAccountId: id,
          transactionType: "DEPOSIT",
          amount: Number(amount),
          runningBalance: newBalance,
          description: description || "Deposit",
          referenceType: referenceType || null,
          referenceId: referenceId || null,
          transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
          organizationId,
        },
      });

      // Create journal entry (Debit Cash/Bank, Credit source account)
      const equityAccount = await getSystemAccount(tx, organizationId, "3100");
      if (account.accountId && equityAccount) {
        await createAutoJournalEntry(tx, organizationId, {
          date: transactionDate ? new Date(transactionDate) : new Date(),
          description: description || "Deposit",
          sourceType: "TRANSFER",
          sourceId: transaction.id,
          lines: [
            { accountId: account.accountId, debit: Number(amount), credit: 0 },
            { accountId: equityAccount.id, debit: 0, credit: Number(amount) },
          ],
        });
      }

      return transaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to record deposit:", error);
    return NextResponse.json(
      { error: "Failed to record deposit" },
      { status: 500 }
    );
  }
}
