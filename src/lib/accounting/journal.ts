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

/**
 * Sync COGS journal entry for an invoice.
 * Deletes existing COGS journal and recreates it with current costOfGoodsSold values.
 */
export async function syncInvoiceCOGSJournal(
  tx: Tx,
  organizationId: string,
  invoiceId: string
): Promise<void> {
  // Fetch invoice with items
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      invoiceNumber: true,
      issueDate: true,
      items: { select: { costOfGoodsSold: true } },
    },
  });

  if (!invoice) return;

  const totalCOGS = invoice.items.reduce(
    (sum: number, item: { costOfGoodsSold: unknown }) => sum + Number(item.costOfGoodsSold),
    0
  );

  // Delete existing COGS journal entries for this invoice
  await tx.journalEntry.deleteMany({
    where: {
      sourceType: "INVOICE",
      sourceId: invoiceId,
      description: { startsWith: "COGS" },
      organizationId,
    },
  });

  // Recreate if totalCOGS > 0
  if (totalCOGS > 0) {
    const cogsAccount = await getSystemAccount(tx, organizationId, "5100");
    const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
    if (cogsAccount && inventoryAccount) {
      await createAutoJournalEntry(tx, organizationId, {
        date: invoice.issueDate,
        description: `COGS - ${invoice.invoiceNumber}`,
        sourceType: "INVOICE",
        sourceId: invoiceId,
        lines: [
          { accountId: cogsAccount.id, description: "Cost of Goods Sold", debit: totalCOGS, credit: 0 },
          { accountId: inventoryAccount.id, description: "Inventory", debit: 0, credit: totalCOGS },
        ],
      });
    }
  }
}

/**
 * Sync revenue journal entry for an invoice.
 * Deletes existing revenue journal and recreates it with current invoice totals.
 */
export async function syncInvoiceRevenueJournal(
  tx: Tx,
  organizationId: string,
  invoiceId: string
): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      invoiceNumber: true,
      issueDate: true,
      subtotal: true,
      taxAmount: true,
      total: true,
    },
  });

  if (!invoice) return;

  const subtotal = Number(invoice.subtotal);
  const taxAmount = Number(invoice.taxAmount);
  const total = Number(invoice.total);

  // Delete existing revenue journal entries for this invoice
  await tx.journalEntry.deleteMany({
    where: {
      sourceType: "INVOICE",
      sourceId: invoiceId,
      description: { startsWith: "Sales Invoice" },
      organizationId,
    },
  });

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
        revenueLines[1] = { accountId: revenueAccount.id, description: "Sales Revenue", debit: 0, credit: total };
      }
    }
    await createAutoJournalEntry(tx, organizationId, {
      date: invoice.issueDate,
      description: `Sales Invoice ${invoice.invoiceNumber}`,
      sourceType: "INVOICE",
      sourceId: invoiceId,
      lines: revenueLines,
    });
  }
}

/**
 * Sync purchase journal entry for a purchase invoice.
 * Deletes existing purchase journal and recreates it with current totals.
 */
export async function syncPurchaseJournal(
  tx: Tx,
  organizationId: string,
  purchaseInvoiceId: string
): Promise<void> {
  const invoice = await tx.purchaseInvoice.findUnique({
    where: { id: purchaseInvoiceId },
    select: {
      purchaseInvoiceNumber: true,
      invoiceDate: true,
      subtotal: true,
      taxAmount: true,
      total: true,
    },
  });

  if (!invoice) return;

  const subtotal = Number(invoice.subtotal);
  const taxAmount = Number(invoice.taxAmount);
  const total = Number(invoice.total);

  // Delete existing purchase journal entries
  await tx.journalEntry.deleteMany({
    where: {
      sourceType: "PURCHASE_INVOICE",
      sourceId: purchaseInvoiceId,
      organizationId,
    },
  });

  const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
  const apAccount = await getSystemAccount(tx, organizationId, "2100");
  if (inventoryAccount && apAccount) {
    const purchaseLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
      { accountId: inventoryAccount.id, description: "Inventory", debit: subtotal, credit: 0 },
      { accountId: apAccount.id, description: "Accounts Payable", debit: 0, credit: total },
    ];
    if (taxAmount > 0) {
      const taxPayableAccount = await getSystemAccount(tx, organizationId, "2200");
      if (taxPayableAccount) {
        purchaseLines.push({ accountId: taxPayableAccount.id, description: "Input Tax Recoverable", debit: taxAmount, credit: 0 });
      } else {
        purchaseLines[0] = { accountId: inventoryAccount.id, description: "Inventory", debit: total, credit: 0 };
      }
    }
    await createAutoJournalEntry(tx, organizationId, {
      date: invoice.invoiceDate,
      description: `Purchase Invoice ${invoice.purchaseInvoiceNumber}`,
      sourceType: "PURCHASE_INVOICE",
      sourceId: purchaseInvoiceId,
      lines: purchaseLines,
    });
  }
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
