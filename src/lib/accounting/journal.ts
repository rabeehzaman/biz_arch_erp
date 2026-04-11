// Journal entry helpers for auto-generated double-entry accounting
import { generateAutoNumber } from "./auto-number";

 
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

// Auto-create a system account if it doesn't exist.
// Used by POS cash movements so first-time use doesn't fail.
const ACCOUNT_DEFS: Record<string, { name: string; accountType: string; accountSubType: string; parentCode: string }> = {
  "3100": { name: "Owner's Capital (رأس مال المالك)", accountType: "EQUITY", accountSubType: "OWNERS_EQUITY", parentCode: "3000" },
  "3300": { name: "Owner's Drawings (المسحوبات الشخصية)", accountType: "EQUITY", accountSubType: "OTHER_EQUITY", parentCode: "3000" },
  "4900": { name: "Other Revenue (إيرادات أخرى)", accountType: "REVENUE", accountSubType: "OTHER_REVENUE", parentCode: "4000" },
};

export async function ensureSystemAccount(
  tx: Tx,
  organizationId: string,
  code: string
): Promise<{ id: string; code: string; name: string }> {
  const existing = await getSystemAccount(tx, organizationId, code);
  if (existing) return existing;

  const def = ACCOUNT_DEFS[code];
  if (!def) throw new Error(`No account definition for code ${code}`);

  const parentAccount = await tx.account.findFirst({
    where: { organizationId, code: def.parentCode },
    select: { id: true },
  });
  if (!parentAccount) throw new Error(`Parent account ${def.parentCode} not found`);

  return tx.account.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: {},
    create: {
      organizationId,
      code,
      name: def.name,
      accountType: def.accountType,
      accountSubType: def.accountSubType,
      parentId: parentAccount.id,
      isSystem: false,
    },
    select: { id: true, code: true, name: true },
  });
}

export async function ensureCashShortOverAccount(
  tx: Tx,
  organizationId: string
): Promise<{ id: string; code: string; name: string } | null> {
  const existing = await getSystemAccount(tx, organizationId, "6150");
  if (existing) return existing;

  const parentAccount = await tx.account.findFirst({
    where: { organizationId, code: "5000" },
    select: { id: true },
  });

  if (!parentAccount) return null;

  const account = await tx.account.upsert({
    where: { organizationId_code: { organizationId, code: "6150" } },
    update: {},
    create: {
      organizationId,
      code: "6150",
      name: "Cash Short and Over (العجز والزيادة في النقدية)",
      accountType: "EXPENSE",
      accountSubType: "OTHER_EXPENSE",
      parentId: parentAccount.id,
      isSystem: true,
    },
    select: { id: true, code: true, name: true },
  });

  return account;
}

export async function ensureRoundOffAccount(
  tx: Tx,
  organizationId: string
): Promise<{ id: string; code: string; name: string } | null> {
  const existing = await getSystemAccount(tx, organizationId, "6160");
  if (existing) return existing;

  const parentAccount = await tx.account.findFirst({
    where: { organizationId, code: "5000" },
    select: { id: true },
  });

  if (!parentAccount) return null;

  const account = await tx.account.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "6160",
      },
    },
    update: {},
    create: {
      organizationId,
      code: "6160",
      name: "Round Off Adjustment (تسوية التقريب)",
      accountType: "EXPENSE",
      accountSubType: "OTHER_EXPENSE",
      parentId: parentAccount.id,
      isSystem: true,
    },
    select: { id: true, code: true, name: true },
  });

  return account;
}

export async function ensureJewelleryAccounts(
  tx: Tx,
  organizationId: string
): Promise<{
  goldInventory: { id: string; code: string; name: string };
  goldWithKarigars: { id: string; code: string; name: string };
  metalRevenue: { id: string; code: string; name: string };
  makingRevenue: { id: string; code: string; name: string };
  metalCOGS: { id: string; code: string; name: string };
  makingCOGS: { id: string; code: string; name: string };
} | null> {
  const codes = ["1460", "1465", "4110", "4120", "5110", "5120"];
  const accounts = await Promise.all(
    codes.map((code) => getSystemAccount(tx, organizationId, code))
  );

  // If any account is missing, try to seed them
  if (accounts.some((a) => !a)) {
    const { seedJewelleryAccounts } = await import("./seed-coa");
    await seedJewelleryAccounts(tx, organizationId);
    const retried = await Promise.all(
      codes.map((code) => getSystemAccount(tx, organizationId, code))
    );
    if (retried.some((a) => !a)) return null;
    return {
      goldInventory: retried[0]!,
      goldWithKarigars: retried[1]!,
      metalRevenue: retried[2]!,
      makingRevenue: retried[3]!,
      metalCOGS: retried[4]!,
      makingCOGS: retried[5]!,
    };
  }

  return {
    goldInventory: accounts[0]!,
    goldWithKarigars: accounts[1]!,
    metalRevenue: accounts[2]!,
    makingRevenue: accounts[3]!,
    metalCOGS: accounts[4]!,
    makingCOGS: accounts[5]!,
  };
}

export async function ensureInventoryAdjustmentAccounts(
  tx: Tx,
  organizationId: string
): Promise<{
  adjustmentExpense: { id: string; code: string; name: string };
  adjustmentIncome: { id: string; code: string; name: string };
} | null> {
  let expenseAccount = await getSystemAccount(tx, organizationId, "5910");
  let incomeAccount = await getSystemAccount(tx, organizationId, "4910");

  if (!expenseAccount) {
    const parentExpense = await tx.account.findFirst({
      where: { organizationId, code: "5000" },
      select: { id: true },
    });
    if (!parentExpense) return null;

    expenseAccount = await tx.account.upsert({
      where: { organizationId_code: { organizationId, code: "5910" } },
      update: {},
      create: {
        organizationId,
        code: "5910",
        name: "Inventory Adjustment Loss (خسارة تسوية المخزون)",
        accountType: "EXPENSE",
        accountSubType: "OTHER_EXPENSE",
        parentId: parentExpense.id,
        isSystem: true,
      },
      select: { id: true, code: true, name: true },
    });
  }

  if (!incomeAccount) {
    const parentIncome = await tx.account.findFirst({
      where: { organizationId, code: "4000" },
      select: { id: true },
    });
    if (!parentIncome) return null;

    incomeAccount = await tx.account.upsert({
      where: { organizationId_code: { organizationId, code: "4910" } },
      update: {},
      create: {
        organizationId,
        code: "4910",
        name: "Inventory Adjustment Gain (أرباح تسوية المخزون)",
        accountType: "REVENUE",
        accountSubType: "OTHER_REVENUE",
        parentId: parentIncome.id,
        isSystem: true,
      },
      select: { id: true, code: true, name: true },
    });
  }

  if (!expenseAccount || !incomeAccount) return null;

  return {
    adjustmentExpense: expenseAccount,
    adjustmentIncome: incomeAccount,
  };
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

export class AutoJournalEntryCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutoJournalEntryCreationError";
  }
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
    organizationId,
    tx
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

export async function createRequiredAutoJournalEntry(
  tx: Tx,
  organizationId: string,
  options: Parameters<typeof createAutoJournalEntry>[2],
  failureMessage: string
): Promise<{ id: string; journalNumber: string }> {
  const journalEntry = await createAutoJournalEntry(tx, organizationId, options);
  if (!journalEntry) {
    throw new AutoJournalEntryCreationError(failureMessage);
  }
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
      totalVat: true,
      roundOffAmount: true,
      branchId: true,
    },
  });

  if (!invoice) return;

  const subtotal = Number(invoice.subtotal);
  const total = Number(invoice.total);
  const totalCgst = Number(invoice.totalCgst);
  const totalSgst = Number(invoice.totalSgst);
  const totalIgst = Number(invoice.totalIgst);
  const totalVat = Number(invoice.totalVat || 0);
  const roundOffAmount = Number(invoice.roundOffAmount || 0);
  const totalTax = totalVat > 0 ? totalVat : (totalCgst + totalSgst + totalIgst);

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

    // Tax journal lines
    if (totalTax > 0) {
      if (totalVat > 0) {
        // Saudi VAT: single VAT output account
        const vatAccount = await getSystemAccount(tx, organizationId, "2240");
        if (vatAccount) {
          revenueLines.push({ accountId: vatAccount.id, description: "VAT Output", debit: 0, credit: totalVat });
        }
      } else {
        // GST: CGST/SGST/IGST accounts
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
    }

    if (Math.abs(roundOffAmount) > 0.0001) {
      const roundOffAccount = await ensureRoundOffAccount(tx, organizationId);
      if (roundOffAccount) {
        revenueLines.push({
          accountId: roundOffAccount.id,
          description: "Round Off Adjustment",
          debit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
          credit: roundOffAmount > 0 ? roundOffAmount : 0,
        });
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
      totalVat: true,
      roundOffAmount: true,
      branchId: true,
    },
  });

  if (!invoice) return;

  const subtotal = Number(invoice.subtotal);
  const total = Number(invoice.total);
  const totalCgst = Number(invoice.totalCgst);
  const totalSgst = Number(invoice.totalSgst);
  const totalIgst = Number(invoice.totalIgst);
  const totalVat = Number(invoice.totalVat || 0);
  const roundOffAmount = Number(invoice.roundOffAmount || 0);

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

    // Tax Input journal lines
    if (totalVat > 0) {
      // Saudi VAT: single VAT input account
      const vatInput = await getSystemAccount(tx, organizationId, "1380");
      if (vatInput) {
        purchaseLines.push({ accountId: vatInput.id, description: "VAT Input", debit: totalVat, credit: 0 });
      }
    } else {
      // GST: CGST/SGST/IGST input accounts
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
    }

    if (Math.abs(roundOffAmount) > 0.0001) {
      const roundOffAccount = await ensureRoundOffAccount(tx, organizationId);
      if (roundOffAccount) {
        purchaseLines.push({
          accountId: roundOffAccount.id,
          description: "Round Off Adjustment",
          debit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
          credit: roundOffAmount > 0 ? roundOffAmount : 0,
        });
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

/**
 * Sync journal entries for a jewellery sale invoice with split revenue and COGS.
 * Revenue split: Metal Value (4110) vs Making Charges (4120)
 * COGS split: Metal Cost (5110) vs Making/Wastage Cost (5120)
 * Falls back to standard journals if jewellery accounts aren't available.
 */
export async function syncJewellerySaleJournal(
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
      totalVat: true,
      roundOffAmount: true,
      branchId: true,
      items: {
        select: {
          jewelleryItemId: true,
          costOfGoodsSold: true,
          goldRate: true,
          netWeight: true,
          wastagePercent: true,
          makingChargeType: true,
          makingChargeValue: true,
          stoneValue: true,
          unitPrice: true,
          quantity: true,
        },
      },
    },
  });

  if (!invoice) return;

  const jwAccounts = await ensureJewelleryAccounts(tx, organizationId);
  if (!jwAccounts) {
    // Fallback to standard journals if jewellery accounts unavailable
    await syncInvoiceRevenueJournal(tx, organizationId, invoiceId);
    await syncInvoiceCOGSJournal(tx, organizationId, invoiceId);
    return;
  }

  // Calculate revenue split from invoice items
  let metalRevenue = 0;   // goldValue + wastageValue
  let makingRevenue = 0;   // makingCharges + stoneValue
  let metalCOGS = 0;
  let makingCOGS = 0;

  for (const item of invoice.items) {
    if (item.jewelleryItemId && item.goldRate && item.netWeight) {
      const nw = Number(item.netWeight);
      const gr = Number(item.goldRate);
      const wp = Number(item.wastagePercent || 0);
      const sv = Number(item.stoneValue || 0);
      const mcv = Number(item.makingChargeValue || 0);
      const mct = item.makingChargeType as string;

      const goldValue = nw * gr;
      const wastageValue = nw * (wp / 100) * gr;
      let makingCharges = 0;
      if (mct === "PER_GRAM") makingCharges = mcv * nw;
      else if (mct === "PERCENTAGE") makingCharges = goldValue * (mcv / 100);
      else if (mct === "FIXED") makingCharges = mcv;

      metalRevenue += goldValue + wastageValue;
      makingRevenue += makingCharges + sv;

      // Split COGS proportionally based on revenue split
      const totalItemCOGS = Number(item.costOfGoodsSold);
      const itemSubtotal = goldValue + wastageValue + makingCharges + sv;
      if (itemSubtotal > 0 && totalItemCOGS > 0) {
        const metalRatio = (goldValue + wastageValue) / itemSubtotal;
        metalCOGS += totalItemCOGS * metalRatio;
        makingCOGS += totalItemCOGS * (1 - metalRatio);
      }
    } else {
      // Non-jewellery item in a jewellery invoice — treat as making revenue
      makingRevenue += Number(item.unitPrice) * Number(item.quantity);
      makingCOGS += Number(item.costOfGoodsSold);
    }
  }

  metalRevenue = Math.round(metalRevenue * 100) / 100;
  makingRevenue = Math.round(makingRevenue * 100) / 100;
  metalCOGS = Math.round(metalCOGS * 100) / 100;
  makingCOGS = Math.round(makingCOGS * 100) / 100;

  const total = Number(invoice.total);
  const totalCgst = Number(invoice.totalCgst);
  const totalSgst = Number(invoice.totalSgst);
  const totalIgst = Number(invoice.totalIgst);
  const totalVat = Number(invoice.totalVat || 0);
  const roundOffAmount = Number(invoice.roundOffAmount || 0);

  // ── Revenue Journal ──
  // Delete existing
  await tx.journalEntry.deleteMany({
    where: {
      sourceType: "INVOICE",
      sourceId: invoiceId,
      description: { startsWith: "Sales Invoice" },
      organizationId,
    },
  });

  const arAccount = await getSystemAccount(tx, organizationId, "1300");
  if (arAccount) {
    const revenueLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
      { accountId: arAccount.id, description: "Accounts Receivable", debit: total, credit: 0 },
    ];

    if (metalRevenue > 0) {
      revenueLines.push({ accountId: jwAccounts.metalRevenue.id, description: "Jewellery Metal Revenue", debit: 0, credit: metalRevenue });
    }
    if (makingRevenue > 0) {
      revenueLines.push({ accountId: jwAccounts.makingRevenue.id, description: "Making Charge Revenue", debit: 0, credit: makingRevenue });
    }

    // Tax lines
    if (totalVat > 0) {
      const vatAccount = await getSystemAccount(tx, organizationId, "2240");
      if (vatAccount) revenueLines.push({ accountId: vatAccount.id, description: "VAT Output", debit: 0, credit: totalVat });
    } else {
      if (totalCgst > 0) {
        const cgstAccount = await getSystemAccount(tx, organizationId, "2210");
        if (cgstAccount) revenueLines.push({ accountId: cgstAccount.id, description: "CGST Output", debit: 0, credit: totalCgst });
      }
      if (totalSgst > 0) {
        const sgstAccount = await getSystemAccount(tx, organizationId, "2220");
        if (sgstAccount) revenueLines.push({ accountId: sgstAccount.id, description: "SGST Output", debit: 0, credit: totalSgst });
      }
      if (totalIgst > 0) {
        const igstAccount = await getSystemAccount(tx, organizationId, "2230");
        if (igstAccount) revenueLines.push({ accountId: igstAccount.id, description: "IGST Output", debit: 0, credit: totalIgst });
      }
    }

    if (Math.abs(roundOffAmount) > 0.0001) {
      const roundOffAccount = await ensureRoundOffAccount(tx, organizationId);
      if (roundOffAccount) {
        revenueLines.push({
          accountId: roundOffAccount.id,
          description: "Round Off Adjustment",
          debit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
          credit: roundOffAmount > 0 ? roundOffAmount : 0,
        });
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

  // ── COGS Journal (split) ──
  await tx.journalEntry.deleteMany({
    where: {
      sourceType: "INVOICE",
      sourceId: invoiceId,
      description: { startsWith: "COGS" },
      organizationId,
    },
  });

  const totalCOGS = metalCOGS + makingCOGS;
  if (totalCOGS > 0) {
    const cogsLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [];

    if (metalCOGS > 0) {
      cogsLines.push({ accountId: jwAccounts.metalCOGS.id, description: "Metal Cost of Goods Sold", debit: metalCOGS, credit: 0 });
    }
    if (makingCOGS > 0) {
      cogsLines.push({ accountId: jwAccounts.makingCOGS.id, description: "Making & Wastage Cost", debit: makingCOGS, credit: 0 });
    }
    cogsLines.push({ accountId: jwAccounts.goldInventory.id, description: "Gold Inventory", debit: 0, credit: totalCOGS });

    await createAutoJournalEntry(tx, organizationId, {
      date: invoice.issueDate,
      description: `COGS - ${invoice.invoiceNumber}`,
      sourceType: "INVOICE",
      sourceId: invoiceId,
      branchId: invoice.branchId,
      lines: cogsLines,
    });
  }
}

export async function syncCashBankForJournalLines(
  tx: Tx,
  organizationId: string,
  journalEntryId: string,
  date: Date,
  description: string,
  lines: Array<{ accountId: string; debit: number; credit: number }>
): Promise<void> {
  for (const line of lines) {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit === 0 && credit === 0) continue;

    const cbAccount = await tx.cashBankAccount.findFirst({
      where: { accountId: line.accountId, organizationId },
    });
    if (!cbAccount) continue;

    const isDeposit = debit > 0;
    const signedAmount = isDeposit ? debit : -credit;
    const newBalance = Number(cbAccount.balance) + signedAmount;

    await tx.cashBankAccount.update({
      where: { id: cbAccount.id, organizationId },
      data: { balance: newBalance },
    });

    await tx.cashBankTransaction.create({
      data: {
        cashBankAccountId: cbAccount.id,
        transactionType: isDeposit ? "DEPOSIT" : "WITHDRAWAL",
        amount: signedAmount,
        runningBalance: newBalance,
        description,
        referenceType: "JOURNAL_ENTRY",
        referenceId: journalEntryId,
        transactionDate: date,
        organizationId,
      },
    });
  }
}

export async function removeCashBankTransactionsForJournalEntry(
  tx: Tx,
  organizationId: string,
  journalEntryId: string
): Promise<void> {
  const txns = await tx.cashBankTransaction.findMany({
    where: { referenceType: "JOURNAL_ENTRY", referenceId: journalEntryId, organizationId },
  });

  for (const txn of txns) {
    const cbAccount = await tx.cashBankAccount.findFirst({
      where: { id: txn.cashBankAccountId, organizationId },
    });
    if (cbAccount) {
      await tx.cashBankAccount.update({
        where: { id: cbAccount.id, organizationId },
        data: { balance: Number(cbAccount.balance) - Number(txn.amount) },
      });
    }
  }

  await tx.cashBankTransaction.deleteMany({
    where: { referenceType: "JOURNAL_ENTRY", referenceId: journalEntryId, organizationId },
  });
}

// Helper to get the default cash or bank account for a payment method
export async function getDefaultCashBankAccount(
  tx: Tx,
  organizationId: string,
  paymentMethod: string,
  branchId?: string | null,
  preferredCashBankAccountId?: string | null
): Promise<{ accountId: string; cashBankAccountId: string } | null> {
  const subType =
    paymentMethod === "CASH" ? "CASH" : "BANK";

  const where: any = {
    organizationId,
    accountSubType: subType,
    isActive: true,
  };

  if (preferredCashBankAccountId) {
    const preferredAccount = await tx.cashBankAccount.findFirst({
      where: {
        ...where,
        id: preferredCashBankAccountId,
      },
      select: { id: true, accountId: true },
    });

    if (preferredAccount) {
      return {
        accountId: preferredAccount.accountId,
        cashBankAccountId: preferredAccount.id,
      };
    }
  }

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
