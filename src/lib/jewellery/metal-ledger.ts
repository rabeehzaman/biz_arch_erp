/**
 * Metal Ledger — tracks fine gold (and other metal) weight movements.
 * Every jewellery transaction records both a money journal entry AND a metal ledger entry.
 * The running balance (INFLOW - OUTFLOW) must match physical stock fine weight.
 */

type Tx = any;

export interface MetalLedgerInput {
  date: Date;
  metalType: string;
  purity: string;
  grossWeight: number;
  fineWeight: number;
  direction: "INFLOW" | "OUTFLOW";
  description: string;
  sourceType: string;
  sourceId: string;
  jewelleryItemId?: string | null;
  karigarId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  invoiceId?: string | null;
  purchaseInvoiceId?: string | null;
  oldGoldPurchaseId?: string | null;
}

export async function createMetalLedgerEntry(
  tx: Tx,
  organizationId: string,
  entry: MetalLedgerInput
): Promise<void> {
  await tx.metalLedgerEntry.create({
    data: {
      organizationId,
      date: entry.date,
      metalType: entry.metalType,
      purity: entry.purity,
      grossWeight: entry.grossWeight,
      fineWeight: entry.fineWeight,
      direction: entry.direction,
      description: entry.description,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      jewelleryItemId: entry.jewelleryItemId || null,
      karigarId: entry.karigarId || null,
      customerId: entry.customerId || null,
      supplierId: entry.supplierId || null,
      invoiceId: entry.invoiceId || null,
      purchaseInvoiceId: entry.purchaseInvoiceId || null,
      oldGoldPurchaseId: entry.oldGoldPurchaseId || null,
    },
  });
}

export async function createMetalLedgerEntries(
  tx: Tx,
  organizationId: string,
  entries: MetalLedgerInput[]
): Promise<void> {
  for (const entry of entries) {
    await createMetalLedgerEntry(tx, organizationId, entry);
  }
}

export interface MetalBalanceResult {
  totalInflow: number;
  totalOutflow: number;
  balance: number;
}

export async function getMetalBalance(
  tx: Tx,
  organizationId: string,
  filters?: {
    metalType?: string;
    purity?: string;
    karigarId?: string;
    asOfDate?: Date;
  }
): Promise<MetalBalanceResult> {
  const where: any = { organizationId };
  if (filters?.metalType) where.metalType = filters.metalType;
  if (filters?.purity) where.purity = filters.purity;
  if (filters?.karigarId) where.karigarId = filters.karigarId;
  if (filters?.asOfDate) where.date = { lte: filters.asOfDate };

  const inflow = await tx.metalLedgerEntry.aggregate({
    where: { ...where, direction: "INFLOW" },
    _sum: { fineWeight: true },
  });

  const outflow = await tx.metalLedgerEntry.aggregate({
    where: { ...where, direction: "OUTFLOW" },
    _sum: { fineWeight: true },
  });

  const totalInflow = Number(inflow._sum.fineWeight || 0);
  const totalOutflow = Number(outflow._sum.fineWeight || 0);

  return {
    totalInflow,
    totalOutflow,
    balance: totalInflow - totalOutflow,
  };
}
