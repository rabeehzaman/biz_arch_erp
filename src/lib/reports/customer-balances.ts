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
  organizationId: string
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

  const formatted = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    balance: Number(c.balance),
    invoiceCount: c._count.invoices,
    isActive: c.isActive,
  }));

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
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c) => c.isActive).length,
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
