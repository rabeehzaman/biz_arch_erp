import prisma from "@/lib/prisma";

export interface PurchasesBySupplierRow {
  supplierId: string;
  supplierName: string;
  invoiceCount: number;
  returnCount: number;
  grossPurchases: number;
  returns: number;
  netPurchases: number;
  tax: number;
  total: number;
}

export interface PurchasesBySupplierData {
  rows: PurchasesBySupplierRow[];
  totals: {
    invoiceCount: number;
    returnCount: number;
    grossPurchases: number;
    returns: number;
    netPurchases: number;
    tax: number;
    total: number;
  };
}

export async function getPurchasesBySupplierData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<PurchasesBySupplierData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const [invoices, debitNotes] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        organizationId,
        invoiceDate: { gte: from, lte: to },
        status: { not: "DRAFT" },
      },
      select: {
        supplierId: true,
        supplier: { select: { name: true } },
        subtotal: true,
        total: true,
        totalVat: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
      },
    }),
    prisma.debitNote.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to } },
      select: {
        supplierId: true,
        supplier: { select: { name: true } },
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
      supplierName: string;
      invoiceCount: number;
      returnCount: number;
      grossPurchases: number;
      returns: number;
      invoiceTax: number;
      returnTax: number;
      invoiceTotal: number;
      returnTotal: number;
    }
  >();

  for (const inv of invoices) {
    const existing = map.get(inv.supplierId) || {
      supplierName: inv.supplier.name,
      invoiceCount: 0,
      returnCount: 0,
      grossPurchases: 0,
      returns: 0,
      invoiceTax: 0,
      returnTax: 0,
      invoiceTotal: 0,
      returnTotal: 0,
    };
    existing.invoiceCount += 1;
    existing.grossPurchases += Number(inv.subtotal);
    existing.invoiceTax +=
      Number(inv.totalVat || 0) +
      Number(inv.totalCgst) +
      Number(inv.totalSgst) +
      Number(inv.totalIgst);
    existing.invoiceTotal += Number(inv.total);
    map.set(inv.supplierId, existing);
  }

  for (const dn of debitNotes) {
    const existing = map.get(dn.supplierId) || {
      supplierName: dn.supplier.name,
      invoiceCount: 0,
      returnCount: 0,
      grossPurchases: 0,
      returns: 0,
      invoiceTax: 0,
      returnTax: 0,
      invoiceTotal: 0,
      returnTotal: 0,
    };
    existing.returnCount += 1;
    existing.returns += Number(dn.subtotal);
    existing.returnTax +=
      Number(dn.totalVat || 0) +
      Number(dn.totalCgst) +
      Number(dn.totalSgst) +
      Number(dn.totalIgst);
    existing.returnTotal += Number(dn.total);
    map.set(dn.supplierId, existing);
  }

  const rows: PurchasesBySupplierRow[] = [];

  for (const [supplierId, v] of map) {
    rows.push({
      supplierId,
      supplierName: v.supplierName,
      invoiceCount: v.invoiceCount,
      returnCount: v.returnCount,
      grossPurchases: v.grossPurchases,
      returns: v.returns,
      netPurchases: v.grossPurchases - v.returns,
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
      grossPurchases: acc.grossPurchases + r.grossPurchases,
      returns: acc.returns + r.returns,
      netPurchases: acc.netPurchases + r.netPurchases,
      tax: acc.tax + r.tax,
      total: acc.total + r.total,
    }),
    {
      invoiceCount: 0,
      returnCount: 0,
      grossPurchases: 0,
      returns: 0,
      netPurchases: 0,
      tax: 0,
      total: 0,
    }
  );

  return { rows, totals };
}
