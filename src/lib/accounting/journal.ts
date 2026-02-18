// Journal entry helpers for auto-generated double-entry accounting
import { generateAutoNumber } from "./auto-number";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export async function getSystemAccount(
  tx: Tx,
  organizationId: string,
  code: string
): Promise<{ id: string; code: string; name: string } | null> {
  try {
    const account = await tx.account.findFirst({
      where: { organizationId, code },
      select: { id: true, code: true, name: true },
    });
    return account;
  } catch {
    return null;
  }
}

export function validateJournalBalance(
  lines: Array<{ debit: number; credit: number }>
): boolean {
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

interface JournalLine {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
}

export async function createAutoJournalEntry(
  tx: Tx,
  organizationId: string,
  options: {
    date: Date;
    description: string;
    sourceType: string;
    sourceId: string;
    lines: JournalLine[];
  }
): Promise<{ id: string; journalNumber: string } | null> {
  const { date, description, sourceType, sourceId, lines } = options;

  // Validate all account IDs are present
  if (lines.some((l) => !l.accountId)) {
    return null;
  }

  // Validate balance
  if (!validateJournalBalance(lines)) {
    console.error("Journal entry lines do not balance", { description, lines });
    return null;
  }

  const journalNumber = await generateAutoNumber(
    tx.journalEntry,
    "journalNumber",
    "JV",
    organizationId
  );

  const journalEntry = await tx.journalEntry.create({
    data: {
      journalNumber,
      date,
      description,
      status: "POSTED",
      sourceType,
      sourceId,
      organizationId,
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          description: line.description || null,
          debit: line.debit,
          credit: line.credit,
          organizationId,
        })),
      },
    },
    select: { id: true, journalNumber: true },
  });

  return journalEntry;
}

// Helper to get the default cash or bank account for a payment method
export async function getDefaultCashBankAccount(
  tx: Tx,
  organizationId: string,
  paymentMethod: string
): Promise<{ accountId: string; cashBankAccountId: string } | null> {
  const subType =
    paymentMethod === "CASH" ? "CASH" : "BANK";

  const cashBankAccount = await tx.cashBankAccount.findFirst({
    where: {
      organizationId,
      accountSubType: subType,
      isActive: true,
    },
    orderBy: { isDefault: "desc" },
    select: { id: true, accountId: true },
  });

  if (!cashBankAccount) return null;

  return {
    accountId: cashBankAccount.accountId,
    cashBankAccountId: cashBankAccount.id,
  };
}
