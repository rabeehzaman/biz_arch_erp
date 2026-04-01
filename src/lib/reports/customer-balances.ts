import { prisma } from "@/lib/prisma";

export interface CustomerBalanceRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  invoiceCount: number;
  isActive: boolean;
}

export interface CustomerBalancesSummary {
  totalCustomers: number;
  activeCustomers: number;
  totalReceivable: number;
  totalAdvances: number;
  netBalance: number;
  customersWithBalance: number;
  customersWithAdvances: number;
}

export interface CustomerBalancesReconciliation {
  glBalance: number;
  ledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

export interface CustomerBalancesData {
  customers: CustomerBalanceRow[];
  summary: CustomerBalancesSummary;
  reconciliation: CustomerBalancesReconciliation;
}

export async function getCustomerBalancesData(
  organizationId: string,
  branchId?: string
): Promise<CustomerBalancesData> {
  const customers = await prisma.customer.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      balance: true,
      isActive: true,
      _count: { select: { invoices: true } },
    },
    orderBy: { balance: "desc" },
  });

  let formatted: CustomerBalanceRow[];

  if (branchId) {
    // Recompute balances from branch-filtered invoices and payments
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId, branchId },
        select: { customerId: true, total: true },
      }),
      prisma.payment.findMany({
        where: { organizationId, branchId },
        select: { customerId: true, amount: true },
      }),
    ]);

    const invoiceTotals = new Map<string, number>();
    for (const inv of invoices) {
      invoiceTotals.set(inv.customerId, (invoiceTotals.get(inv.customerId) || 0) + Number(inv.total));
    }
    const paymentTotals = new Map<string, number>();
    for (const pmt of payments) {
      paymentTotals.set(pmt.customerId, (paymentTotals.get(pmt.customerId) || 0) + Number(pmt.amount));
    }

    // Count branch-specific invoices per customer
    const invoiceCounts = new Map<string, number>();
    for (const inv of invoices) {
      invoiceCounts.set(inv.customerId, (invoiceCounts.get(inv.customerId) || 0) + 1);
    }

    formatted = customers
      .map((c) => {
        const branchInvoiced = invoiceTotals.get(c.id) || 0;
        const branchPaid = paymentTotals.get(c.id) || 0;
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          balance: branchInvoiced - branchPaid,
          invoiceCount: invoiceCounts.get(c.id) || 0,
          isActive: c.isActive,
        };
      })
      .filter((c) => c.balance !== 0 || c.invoiceCount > 0)
      .sort((a, b) => b.balance - a.balance);
  } else {
    formatted = customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      balance: Number(c.balance),
      invoiceCount: c._count.invoices,
      isActive: c.isActive,
    }));
  }

  const ledgerBalance = formatted.reduce((sum, c) => sum + c.balance, 0);

  const glARLines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId,
      journalEntry: { status: "POSTED" },
      account: { code: "1300" },
    },
    select: { debit: true, credit: true },
  });
  const glBalance = glARLines.reduce(
    (sum, line) => sum + Number(line.debit) - Number(line.credit),
    0
  );

  return {
    customers: formatted,
    summary: {
      totalCustomers: formatted.length,
      activeCustomers: formatted.filter((c) => c.isActive).length,
      totalReceivable: formatted.reduce((sum, c) => sum + Math.max(0, c.balance), 0),
      totalAdvances: formatted.reduce((sum, c) => sum + Math.abs(Math.min(0, c.balance)), 0),
      netBalance: ledgerBalance,
      customersWithBalance: formatted.filter((c) => c.balance > 0).length,
      customersWithAdvances: formatted.filter((c) => c.balance < 0).length,
    },
    reconciliation: {
      glBalance,
      ledgerBalance,
      difference: glBalance - ledgerBalance,
      isReconciled: Math.abs(glBalance - ledgerBalance) < 0.01,
    },
  };
}
