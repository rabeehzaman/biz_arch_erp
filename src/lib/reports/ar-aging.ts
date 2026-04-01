import prisma from "@/lib/prisma";

export interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

export interface ARAgingCustomerRow {
  customerId: string;
  customerName: string;
  buckets: AgingBuckets;
}

export interface ARAgingData {
  customers: ARAgingCustomerRow[];
  totals: AgingBuckets;
}

export async function getARAgingData(
  organizationId: string,
  asOfDate: string,
  branchId?: string
): Promise<ARAgingData> {
  const asOf = new Date(asOfDate + "T23:59:59.999Z");

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      balanceDue: { gt: 0 },
      issueDate: { lte: asOf },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      dueDate: true,
      balanceDue: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
    },
  });

  const customerMap = new Map<string, ARAgingCustomerRow>();

  for (const inv of invoices) {
    const balance = Number(inv.balanceDue);
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : asOf;
    const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let existing = customerMap.get(inv.customerId);
    if (!existing) {
      existing = {
        customerId: inv.customerId,
        customerName: inv.customer.name,
        buckets: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 },
      };
      customerMap.set(inv.customerId, existing);
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

  const customers = Array.from(customerMap.values()).sort(
    (a, b) => b.buckets.total - a.buckets.total
  );

  const totals: AgingBuckets = {
    current: customers.reduce((s, c) => s + c.buckets.current, 0),
    days1to30: customers.reduce((s, c) => s + c.buckets.days1to30, 0),
    days31to60: customers.reduce((s, c) => s + c.buckets.days31to60, 0),
    days61to90: customers.reduce((s, c) => s + c.buckets.days61to90, 0),
    over90: customers.reduce((s, c) => s + c.buckets.over90, 0),
    total: customers.reduce((s, c) => s + c.buckets.total, 0),
  };

  return { customers, totals };
}
