import prisma from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────

export interface GoldAnnotation {
  fineWeightGrams: number;
  label: string;
  marketValue?: number;
  marketRate?: number;
  rateDate?: string;
}

export interface ProfitLossGoldContext {
  accountAnnotations: Record<string, GoldAnnotation>;
  goldMovement: {
    goldSold: number;
    oldGoldReceived: number;
    goldPurchased: number;
    netMovement: number;
  };
}

export interface BalanceSheetGoldContext {
  accountAnnotations: Record<string, GoldAnnotation>;
  goldPosition: {
    inStockFineWeight: number;
    withKarigarsFineWeight: number;
    totalFineWeight: number;
    bookValue: number;
    marketValue: number;
    currentRate: number;
    rateDate: string;
  };
}

// ── P&L Gold Context ─────────────────────────────────────────────

export async function getProfitLossGoldContext(
  organizationId: string,
  fromDate: string,
  toDate: string,
): Promise<ProfitLossGoldContext> {
  const groups = await prisma.metalLedgerEntry.groupBy({
    by: ["sourceType", "direction"],
    where: {
      organizationId,
      date: {
        gte: new Date(fromDate),
        lte: new Date(toDate + "T23:59:59.999Z"),
      },
    },
    _sum: { fineWeight: true },
  });

  let totalInflow = 0;
  let totalOutflow = 0;
  let goldSold = 0;
  let oldGoldReceived = 0;
  let goldPurchased = 0;

  for (const g of groups) {
    const fw = Number(g._sum.fineWeight ?? 0);
    if (g.direction === "INFLOW") {
      totalInflow += fw;
      if (g.sourceType === "OLD_GOLD_IN") oldGoldReceived += fw;
      if (g.sourceType === "PURCHASE") goldPurchased += fw;
    } else {
      totalOutflow += fw;
      if (g.sourceType === "SALE") goldSold += fw;
    }
  }

  const accountAnnotations: Record<string, GoldAnnotation> = {};
  if (goldSold > 0) {
    accountAnnotations["4110"] = {
      fineWeightGrams: goldSold,
      label: `${goldSold.toFixed(3)}g fine gold sold`,
    };
    accountAnnotations["5110"] = {
      fineWeightGrams: goldSold,
      label: `${goldSold.toFixed(3)}g fine gold cost`,
    };
  }

  return {
    accountAnnotations,
    goldMovement: {
      goldSold,
      oldGoldReceived,
      goldPurchased,
      netMovement: totalInflow - totalOutflow,
    },
  };
}

// ── Balance Sheet Gold Context ───────────────────────────────────

export async function getBalanceSheetGoldContext(
  organizationId: string,
  asOfDate: string,
  bookValues: { account1460: number; account1465: number },
): Promise<BalanceSheetGoldContext> {
  const asOfDateObj = new Date(asOfDate + "T23:59:59.999Z");

  // In-stock fine gold (entries without karigarId)
  const [inStockIn, inStockOut] = await Promise.all([
    prisma.metalLedgerEntry.aggregate({
      where: { organizationId, karigarId: null, direction: "INFLOW", date: { lte: asOfDateObj } },
      _sum: { fineWeight: true },
    }),
    prisma.metalLedgerEntry.aggregate({
      where: { organizationId, karigarId: null, direction: "OUTFLOW", date: { lte: asOfDateObj } },
      _sum: { fineWeight: true },
    }),
  ]);

  // Gold with karigars (entries with karigarId)
  const [karigarIn, karigarOut] = await Promise.all([
    prisma.metalLedgerEntry.aggregate({
      where: { organizationId, karigarId: { not: null }, direction: "INFLOW", date: { lte: asOfDateObj } },
      _sum: { fineWeight: true },
    }),
    prisma.metalLedgerEntry.aggregate({
      where: { organizationId, karigarId: { not: null }, direction: "OUTFLOW", date: { lte: asOfDateObj } },
      _sum: { fineWeight: true },
    }),
  ]);

  const inStockFineWeight =
    Number(inStockIn._sum.fineWeight ?? 0) - Number(inStockOut._sum.fineWeight ?? 0);
  const withKarigarsFineWeight =
    Number(karigarOut._sum.fineWeight ?? 0) - Number(karigarIn._sum.fineWeight ?? 0);
  const totalFineWeight = inStockFineWeight + withKarigarsFineWeight;

  // Fetch current gold rate (K24 GOLD) for market value
  const { rate: currentRate, rateDate } = await getLatestGoldRate(organizationId);
  const marketValue = totalFineWeight * currentRate;

  const accountAnnotations: Record<string, GoldAnnotation> = {};
  if (inStockFineWeight > 0 || bookValues.account1460 > 0) {
    accountAnnotations["1460"] = {
      fineWeightGrams: inStockFineWeight,
      label: `${inStockFineWeight.toFixed(3)}g fine gold in stock`,
      marketValue: inStockFineWeight * currentRate,
      marketRate: currentRate,
      rateDate,
    };
  }
  if (withKarigarsFineWeight > 0 || bookValues.account1465 > 0) {
    accountAnnotations["1465"] = {
      fineWeightGrams: withKarigarsFineWeight,
      label: `${withKarigarsFineWeight.toFixed(3)}g fine gold with karigars`,
    };
  }

  return {
    accountAnnotations,
    goldPosition: {
      inStockFineWeight,
      withKarigarsFineWeight,
      totalFineWeight,
      bookValue: bookValues.account1460 + bookValues.account1465,
      marketValue,
      currentRate,
      rateDate,
    },
  };
}

// ── Helper: fetch latest K24 GOLD sell rate ──────────────────────

async function getLatestGoldRate(
  organizationId: string,
): Promise<{ rate: number; rateDate: string }> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Try today's rate first
  let rate = await prisma.goldRate.findFirst({
    where: {
      organizationId,
      metalType: "GOLD",
      purity: "K24",
      date: { gte: todayStart, lt: todayEnd },
    },
    select: { sellRate: true, date: true },
  });

  if (rate) {
    return { rate: Number(rate.sellRate), rateDate: todayStart.toISOString().split("T")[0] };
  }

  // Fallback to most recent
  rate = await prisma.goldRate.findFirst({
    where: { organizationId, metalType: "GOLD", purity: "K24" },
    orderBy: { date: "desc" },
    select: { sellRate: true, date: true },
  });

  if (rate) {
    return {
      rate: Number(rate.sellRate),
      rateDate: new Date(rate.date).toISOString().split("T")[0],
    };
  }

  return { rate: 0, rateDate: "" };
}
