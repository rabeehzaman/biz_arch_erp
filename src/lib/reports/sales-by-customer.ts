import prisma from "@/lib/prisma";

export interface SalesByCustomerRow {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  returnCount: number;
  grossSales: number;
  returns: number;
  netSales: number;
  tax: number;
  total: number;
}

export interface SalesByCustomerData {
  rows: SalesByCustomerRow[];
  totals: {
    invoiceCount: number;
    returnCount: number;
    grossSales: number;
    returns: number;
    netSales: number;
    tax: number;
    total: number;
  };
}

export async function getSalesByCustomerData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<SalesByCustomerData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const [invoices, creditNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to } },
      select: {
        customerId: true,
        customer: { select: { name: true } },
        subtotal: true,
        total: true,
        totalVat: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
      },
    }),
    prisma.creditNote.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to } },
      select: {
        customerId: true,
        customer: { select: { name: true } },
        subtotal: true,
        total: true,
        totalVat: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
      },
    }),
  ]);

  const map = new Map<
    string,
    {
      customerName: string;
      invoiceCount: number;
      returnCount: number;
      grossSales: number;
      returns: number;
      invoiceTax: number;
      returnTax: number;
      invoiceTotal: number;
      returnTotal: number;
    }
  >();

  for (const inv of invoices) {
    const existing = map.get(inv.customerId) || {
      customerName: inv.customer.name,
      invoiceCount: 0,
      returnCount: 0,
      grossSales: 0,
      returns: 0,
      invoiceTax: 0,
      returnTax: 0,
      invoiceTotal: 0,
      returnTotal: 0,
    };
    existing.invoiceCount += 1;
    existing.grossSales += Number(inv.subtotal);
    existing.invoiceTax +=
      Number(inv.totalVat || 0) +
      Number(inv.totalCgst) +
      Number(inv.totalSgst) +
      Number(inv.totalIgst);
    existing.invoiceTotal += Number(inv.total);
    map.set(inv.customerId, existing);
  }

  for (const cn of creditNotes) {
    const existing = map.get(cn.customerId) || {
      customerName: cn.customer.name,
      invoiceCount: 0,
      returnCount: 0,
      grossSales: 0,
      returns: 0,
      invoiceTax: 0,
      returnTax: 0,
      invoiceTotal: 0,
      returnTotal: 0,
    };
    existing.returnCount += 1;
    existing.returns += Number(cn.subtotal);
    existing.returnTax +=
      Number(cn.totalVat || 0) +
      Number(cn.totalCgst) +
      Number(cn.totalSgst) +
      Number(cn.totalIgst);
    existing.returnTotal += Number(cn.total);
    map.set(cn.customerId, existing);
  }

  const rows: SalesByCustomerRow[] = [];

  for (const [customerId, v] of map) {
    rows.push({
      customerId,
      customerName: v.customerName,
      invoiceCount: v.invoiceCount,
      returnCount: v.returnCount,
      grossSales: v.grossSales,
      returns: v.returns,
      netSales: v.grossSales - v.returns,
      tax: v.invoiceTax - v.returnTax,
      total: v.invoiceTotal - v.returnTotal,
    });
  }

  // Sort by total descending
  rows.sort((a, b) => b.total - a.total);

  const totals = rows.reduce(
    (acc, r) => ({
      invoiceCount: acc.invoiceCount + r.invoiceCount,
      returnCount: acc.returnCount + r.returnCount,
      grossSales: acc.grossSales + r.grossSales,
      returns: acc.returns + r.returns,
      netSales: acc.netSales + r.netSales,
      tax: acc.tax + r.tax,
      total: acc.total + r.total,
    }),
    {
      invoiceCount: 0,
      returnCount: 0,
      grossSales: 0,
      returns: 0,
      netSales: 0,
      tax: 0,
      total: 0,
    }
  );

  return { rows, totals };
}
