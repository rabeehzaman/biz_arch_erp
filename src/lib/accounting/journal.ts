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
    branchId?: string | null;
  }
): Promise<{ id: string; journalNumber: string } | null> {
  const { date, description, sourceType, sourceId, lines, branchId } = options;

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
      branchId: branchId || null,
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
      branchId: true,
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
        branchId: invoice.branchId,
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
      total: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      branchId: true,
    },
  });

  if (!invoice) return;

  const subtotal = Number(invoice.subtotal);
  const total = Number(invoice.total);
  const totalCgst = Number(invoice.totalCgst);
  const totalSgst = Number(invoice.totalSgst);
  const totalIgst = Number(invoice.totalIgst);
  const totalTax = totalCgst + totalSgst + totalIgst;

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

    // GST journal lines
    if (totalTax > 0) {
      if (totalCgst > 0) {
        const cgstAccount = await getSystemAccount(tx, organizationId, "2210");
        if (cgstAccount) {
          revenueLines.push({ accountId: cgstAccount.id, description: "CGST Output", debit: 0, credit: totalCgst });
        }
      }
      if (totalSgst > 0) {
        const sgstAccount = await getSystemAccount(tx, organizationId, "2220");
        if (sgstAccount) {
          revenueLines.push({ accountId: sgstAccount.id, description: "SGST Output", debit: 0, credit: totalSgst });
        }
      }
      if (totalIgst > 0) {
        const igstAccount = await getSystemAccount(tx, organizationId, "2230");
        if (igstAccount) {
          revenueLines.push({ accountId: igstAccount.id, description: "IGST Output", debit: 0, credit: totalIgst });
        }
      }
    }

    await createAutoJournalEntry(tx, organizationId, {
      date: invoice.issueDate,
      description: `Sales Invoice ${invoice.invoiceNumber}`,
      sourceType: "INVOICE",
      sourceId: invoiceId,
      branchId: invoice.branchId,
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
      total: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      branchId: true,
    },
  });

  if (!invoice) return;

  const subtotal = Number(invoice.subtotal);
  const total = Number(invoice.total);
  const totalCgst = Number(invoice.totalCgst);
  const totalSgst = Number(invoice.totalSgst);
  const totalIgst = Number(invoice.totalIgst);

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

    // GST Input journal lines
    if (totalCgst > 0) {
      const cgstInput = await getSystemAccount(tx, organizationId, "1350");
      if (cgstInput) {
        purchaseLines.push({ accountId: cgstInput.id, description: "CGST Input", debit: totalCgst, credit: 0 });
      }
    }
    if (totalSgst > 0) {
      const sgstInput = await getSystemAccount(tx, organizationId, "1360");
      if (sgstInput) {
        purchaseLines.push({ accountId: sgstInput.id, description: "SGST Input", debit: totalSgst, credit: 0 });
      }
    }
    if (totalIgst > 0) {
      const igstInput = await getSystemAccount(tx, organizationId, "1370");
      if (igstInput) {
        purchaseLines.push({ accountId: igstInput.id, description: "IGST Input", debit: totalIgst, credit: 0 });
      }
    }

    await createAutoJournalEntry(tx, organizationId, {
      date: invoice.invoiceDate,
      description: `Purchase Invoice ${invoice.purchaseInvoiceNumber}`,
      sourceType: "PURCHASE_INVOICE",
      sourceId: purchaseInvoiceId,
      branchId: invoice.branchId,
      lines: purchaseLines,
    });
  }
}

// Helper to get the default cash or bank account for a payment method
export async function getDefaultCashBankAccount(
  tx: Tx,
  organizationId: string,
  paymentMethod: string,
  branchId?: string | null
): Promise<{ accountId: string; cashBankAccountId: string } | null> {
  const subType =
    paymentMethod === "CASH" ? "CASH" : "BANK";

  const where: any = {
    organizationId,
    accountSubType: subType,
    isActive: true,
  };

  // If branchId is provided, prefer branch-specific accounts first
  if (branchId) {
    const branchAccount = await tx.cashBankAccount.findFirst({
      where: { ...where, branchId },
      orderBy: { isDefault: "desc" },
      select: { id: true, accountId: true },
    });
    if (branchAccount) {
      return {
        accountId: branchAccount.accountId,
        cashBankAccountId: branchAccount.id,
      };
    }
  }

  // Fallback to any org-wide account
  const cashBankAccount = await tx.cashBankAccount.findFirst({
    where,
    orderBy: { isDefault: "desc" },
    select: { id: true, accountId: true },
  });

  if (!cashBankAccount) return null;

  return {
    accountId: cashBankAccount.accountId,
    cashBankAccountId: cashBankAccount.id,
  };
}
