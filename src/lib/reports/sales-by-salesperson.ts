import prisma from "@/lib/prisma";

export interface SalesBySalespersonRow {
  userId: string;
  userName: string;
  invoiceCount: number;
  totalSales: number;
  totalTax: number;
  totalAmount: number;
  collected: number;
  outstanding: number;
}

export interface SalesBySalespersonData {
  rows: SalesBySalespersonRow[];
  totals: {
    invoiceCount: number;
    totalSales: number;
    totalTax: number;
    totalAmount: number;
    collected: number;
    outstanding: number;
  };
}

export async function getSalesBySalespersonData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<SalesBySalespersonData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      issueDate: { gte: from, lte: to },
    },
    select: {
      id: true,
      subtotal: true,
      total: true,
      amountPaid: true,
      balanceDue: true,
      totalVat: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const userMap = new Map<string, SalesBySalespersonRow>();

  for (const inv of invoices) {
    const userId = inv.createdById || "unknown";
    const userName = inv.createdBy?.name || "Unknown";

    let existing = userMap.get(userId);
    if (!existing) {
      existing = {
        userId,
        userName,
        invoiceCount: 0,
        totalSales: 0,
        totalTax: 0,
        totalAmount: 0,
        collected: 0,
        outstanding: 0,
      };
      userMap.set(userId, existing);
    }

    const tax =
      Number(inv.totalVat || 0) +
      Number(inv.totalCgst || 0) +
      Number(inv.totalSgst || 0) +
      Number(inv.totalIgst || 0);

    existing.invoiceCount += 1;
    existing.totalSales += Number(inv.subtotal);
    existing.totalTax += tax;
    existing.totalAmount += Number(inv.total);
    existing.collected += Number(inv.amountPaid);
    existing.outstanding += Number(inv.balanceDue);
  }

  const rows = Array.from(userMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  const totals = {
    invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
    totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
    totalTax: rows.reduce((s, r) => s + r.totalTax, 0),
    totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
    collected: rows.reduce((s, r) => s + r.collected, 0),
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  };

  return { rows, totals };
}
