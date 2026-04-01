import prisma from "@/lib/prisma";

export interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

export interface APAgingSupplierRow {
  supplierId: string;
  supplierName: string;
  buckets: AgingBuckets;
}

export interface APAgingData {
  suppliers: APAgingSupplierRow[];
  totals: AgingBuckets;
}

export async function getAPAgingData(
  organizationId: string,
  asOfDate: string,
  branchId?: string
): Promise<APAgingData> {
  const asOf = new Date(asOfDate + "T23:59:59.999Z");

  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      organizationId,
      status: { in: ["RECEIVED", "PARTIALLY_PAID"] },
      balanceDue: { gt: 0 },
      invoiceDate: { lte: asOf },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      dueDate: true,
      balanceDue: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
    },
  });

  const supplierMap = new Map<string, APAgingSupplierRow>();

  for (const inv of invoices) {
    const balance = Number(inv.balanceDue);
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : asOf;
    const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let existing = supplierMap.get(inv.supplierId);
    if (!existing) {
      existing = {
        supplierId: inv.supplierId,
        supplierName: inv.supplier.name,
        buckets: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 },
      };
      supplierMap.set(inv.supplierId, existing);
    }

    if (daysOverdue <= 0) {
      existing.buckets.current += balance;
    } else if (daysOverdue <= 30) {
      existing.buckets.days1to30 += balance;
    } else if (daysOverdue <= 60) {
      existing.buckets.days31to60 += balance;
    } else if (daysOverdue <= 90) {
      existing.buckets.days61to90 += balance;
    } else {
      existing.buckets.over90 += balance;
    }
    existing.buckets.total += balance;
  }

  const suppliers = Array.from(supplierMap.values()).sort(
    (a, b) => b.buckets.total - a.buckets.total
  );

  const totals: AgingBuckets = {
    current: suppliers.reduce((s, c) => s + c.buckets.current, 0),
    days1to30: suppliers.reduce((s, c) => s + c.buckets.days1to30, 0),
    days31to60: suppliers.reduce((s, c) => s + c.buckets.days31to60, 0),
    days61to90: suppliers.reduce((s, c) => s + c.buckets.days61to90, 0),
    over90: suppliers.reduce((s, c) => s + c.buckets.over90, 0),
    total: suppliers.reduce((s, c) => s + c.buckets.total, 0),
  };

  return { suppliers, totals };
}
