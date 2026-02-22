import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createAutoJournalEntry } from "@/lib/accounting/journal";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { fromAccountId, toAccountId, amount, description, transactionDate } = body;

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "From account, to account, and positive amount are required" },
        { status: 400 }
      );
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same account" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromAccount = await tx.cashBankAccount.findFirst({
        where: { id: fromAccountId, organizationId },
      });
      const toAccount = await tx.cashBankAccount.findFirst({
        where: { id: toAccountId, organizationId },
      });

      if (!fromAccount || !toAccount) throw new Error("Account not found");

      const txDate = transactionDate ? new Date(transactionDate) : new Date();
      const transferAmount = Number(amount);
      const desc = description || `Transfer from ${fromAccount.name} to ${toAccount.name}`;

      const newFromBalance = Number(fromAccount.balance) - transferAmount;
      const newToBalance = Number(toAccount.balance) + transferAmount;

      // Update balances
      await tx.cashBankAccount.update({
        where: { id: fromAccountId, organizationId },
        data: { balance: newFromBalance },
      });
      await tx.cashBankAccount.update({
        where: { id: toAccountId, organizationId },
        data: { balance: newToBalance },
      });

      // Create transactions
      const fromTx = await tx.cashBankTransaction.create({
        data: {
          cashBankAccountId: fromAccountId,
          transactionType: "TRANSFER_OUT",
          amount: -transferAmount,
          runningBalance: newFromBalance,
          description: desc,
          referenceType: "TRANSFER",
          referenceId: toAccountId,
          transactionDate: txDate,
          organizationId,
        },
      });

      await tx.cashBankTransaction.create({
        data: {
          cashBankAccountId: toAccountId,
          transactionType: "TRANSFER_IN",
          amount: transferAmount,
          runningBalance: newToBalance,
          description: desc,
          referenceType: "TRANSFER",
          referenceId: fromAccountId,
          transactionDate: txDate,
          organizationId,
        },
      });

      // Journal entry: Debit destination, Credit source
      if (fromAccount.accountId && toAccount.accountId) {
        await createAutoJournalEntry(tx, organizationId, {
          date: txDate,
          description: desc,
          sourceType: "TRANSFER",
          sourceId: fromTx.id,
          lines: [
            { accountId: toAccount.accountId, debit: transferAmount, credit: 0 },
            { accountId: fromAccount.accountId, debit: 0, credit: transferAmount },
          ],
        });
      }

      return { fromBalance: newFromBalance, toBalance: newToBalance };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to transfer:", error);
    return NextResponse.json(
      { error: "Failed to transfer" },
      { status: 500 }
    );
  }
}
