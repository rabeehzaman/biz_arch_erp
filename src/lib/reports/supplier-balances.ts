import { prisma } from "@/lib/prisma";

export interface SupplierBalanceRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  invoiceCount: number;
  isActive: boolean;
}

export interface SupplierBalancesSummary {
  totalSuppliers: number;
  activeSuppliers: number;
  totalPayable: number;
  suppliersWithBalance: number;
}

export interface SupplierBalancesReconciliation {
  glBalance: number;
  ledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

export interface SupplierBalancesData {
  suppliers: SupplierBalanceRow[];
  summary: SupplierBalancesSummary;
  reconciliation: SupplierBalancesReconciliation;
}

export async function getSupplierBalancesData(
  organizationId: string
): Promise<SupplierBalancesData> {
  const suppliers = await prisma.supplier.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      balance: true,
      isActive: true,
      _count: { select: { purchaseInvoices: true } },
    },
    orderBy: { balance: "desc" },
  });

  const formatted = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    balance: Number(s.balance),
    invoiceCount: s._count.purchaseInvoices,
    isActive: s.isActive,
  }));

  const ledgerBalance = formatted.reduce((sum, s) => sum + s.balance, 0);

  const glAPLines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId,
      journalEntry: { status: "POSTED" },
      account: { code: "2100" },
    },
    select: { debit: true, credit: true },
  });
  const glBalance = glAPLines.reduce(
    (sum, line) => sum + Number(line.credit) - Number(line.debit),
    0
  );

  return {
    suppliers: formatted,
    summary: {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter((s) => s.isActive).length,
      totalPayable: ledgerBalance,
      suppliersWithBalance: formatted.filter((s) => s.balance > 0).length,
    },
    reconciliation: {
      glBalance,
      ledgerBalance,
      difference: glBalance - ledgerBalance,
      isReconciled: Math.abs(glBalance - ledgerBalance) < 0.01,
    },
  };
}
