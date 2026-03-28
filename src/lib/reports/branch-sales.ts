import prisma from "@/lib/prisma";

export interface BranchSessionRow {
  sessionId: string;
  sessionNumber: string;
  sessionLabel: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openedBy: string | null;
  closedBy: string | null;
  cash: number;
  bank: number;
  total: number;
  transactionCount: number;
}

export interface BranchSalesRow {
  branchId: string | null;
  branchName: string;
  branchCode: string | null;
  sessions: BranchSessionRow[];
  totalCash: number;
  totalBank: number;
  grandTotal: number;
}

export interface BranchSalesData {
  rows: BranchSalesRow[];
  totals: { cash: number; bank: number; total: number };
  from: string;
  to: string;
}

const BANK_METHODS = new Set(["BANK_TRANSFER", "CHECK", "CREDIT_CARD", "UPI"]);

function classifyPayment(method: string): "cash" | "bank" | null {
  if (method === "CASH") return "cash";
  if (BANK_METHODS.has(method)) return "bank";
  return null;
}

export async function getBranchSalesData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<BranchSalesData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  // Fetch branches and POS sessions in date range
  const [branches, sessions] = await Promise.all([
    prisma.branch.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.pOSSession.findMany({
      where: {
        organizationId,
        openedAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        sessionNumber: true,
        status: true,
        openedAt: true,
        closedAt: true,
        branchId: true,
        totalTransactions: true,
        user: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
      orderBy: { openedAt: "asc" },
    }),
  ]);

  if (sessions.length === 0) {
    return { rows: [], totals: { cash: 0, bank: 0, total: 0 }, from: from.toISOString(), to: to.toISOString() };
  }

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const sessionIds = sessions.map((s) => s.id);

  // Fetch all payments for invoices in these sessions in one batch
  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      invoice: { posSessionId: { in: sessionIds } },
    },
    select: {
      amount: true,
      paymentMethod: true,
      invoice: { select: { posSessionId: true } },
    },
  });

  // Aggregate payments per session
  const sessionPayments = new Map<string, { cash: number; bank: number }>();
  for (const p of payments) {
    const sid = p.invoice?.posSessionId;
    if (!sid) continue;
    const type = classifyPayment(p.paymentMethod);
    if (!type) continue;
    const agg = sessionPayments.get(sid) || { cash: 0, bank: 0 };
    agg[type] += Number(p.amount);
    sessionPayments.set(sid, agg);
  }

  // Group sessions by branch, number them sequentially per branch per day
  const branchSessionsMap = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.branchId ?? "null";
    const arr = branchSessionsMap.get(key) || [];
    arr.push(s);
    branchSessionsMap.set(key, arr);
  }

  const rows: BranchSalesRow[] = [];

  for (const [branchKey, branchSessions] of branchSessionsMap) {
    const branch = branchKey !== "null" ? branchMap.get(branchKey) : null;

    // Number sessions per day within this branch
    const dayCounters = new Map<string, number>();
    const sessionRows: BranchSessionRow[] = branchSessions.map((s) => {
      const dayKey = s.openedAt.toISOString().slice(0, 10);
      const count = (dayCounters.get(dayKey) || 0) + 1;
      dayCounters.set(dayKey, count);

      const agg = sessionPayments.get(s.id) || { cash: 0, bank: 0 };
      return {
        sessionId: s.id,
        sessionNumber: s.sessionNumber,
        sessionLabel: `Session ${count}`,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
        status: s.status,
        openedBy: s.user?.name ?? null,
        closedBy: s.closedBy?.name ?? null,
        cash: agg.cash,
        bank: agg.bank,
        total: agg.cash + agg.bank,
        transactionCount: s.totalTransactions,
      };
    });

    const totalCash = sessionRows.reduce((s, r) => s + r.cash, 0);
    const totalBank = sessionRows.reduce((s, r) => s + r.bank, 0);

    rows.push({
      branchId: branchKey !== "null" ? branchKey : null,
      branchName: branch?.name ?? "Unassigned",
      branchCode: branch?.code ?? null,
      sessions: sessionRows,
      totalCash,
      totalBank,
      grandTotal: totalCash + totalBank,
    });
  }

  // Sort: named branches alphabetically, Unassigned last
  rows.sort((a, b) => {
    if (a.branchId === null) return 1;
    if (b.branchId === null) return -1;
    return a.branchName.localeCompare(b.branchName);
  });

  const totals = {
    cash: rows.reduce((s, r) => s + r.totalCash, 0),
    bank: rows.reduce((s, r) => s + r.totalBank, 0),
    total: rows.reduce((s, r) => s + r.grandTotal, 0),
  };

  return { rows, totals, from: from.toISOString(), to: to.toISOString() };
}
