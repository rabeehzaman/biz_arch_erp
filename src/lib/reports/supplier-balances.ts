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
  organizationId: string,
  branchId?: string
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

  let formatted: SupplierBalanceRow[];

  if (branchId) {
    // Recompute balances from branch-filtered purchase invoices and supplier payments
    const [purchaseInvoices, supplierPayments] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: { organizationId, branchId },
        select: { supplierId: true, total: true },
      }),
      prisma.supplierPayment.findMany({
        where: { organizationId, branchId },
        select: { supplierId: true, amount: true },
      }),
    ]);

    const invoiceTotals = new Map<string, number>();
    for (const inv of purchaseInvoices) {
      invoiceTotals.set(inv.supplierId, (invoiceTotals.get(inv.supplierId) || 0) + Number(inv.total));
    }
    const paymentTotals = new Map<string, number>();
    for (const pmt of supplierPayments) {
      paymentTotals.set(pmt.supplierId, (paymentTotals.get(pmt.supplierId) || 0) + Number(pmt.amount));
    }

    // Count branch-specific invoices per supplier
    const invoiceCounts = new Map<string, number>();
    for (const inv of purchaseInvoices) {
      invoiceCounts.set(inv.supplierId, (invoiceCounts.get(inv.supplierId) || 0) + 1);
    }

    formatted = suppliers
      .map((s) => {
        const branchInvoiced = invoiceTotals.get(s.id) || 0;
        const branchPaid = paymentTotals.get(s.id) || 0;
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          balance: branchInvoiced - branchPaid,
          invoiceCount: invoiceCounts.get(s.id) || 0,
          isActive: s.isActive,
        };
      })
      .filter((s) => s.balance !== 0 || s.invoiceCount > 0)
      .sort((a, b) => b.balance - a.balance);
  } else {
    formatted = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      balance: Number(s.balance),
      invoiceCount: s._count.purchaseInvoices,
      isActive: s.isActive,
    }));
  }

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
      totalSuppliers: formatted.length,
      activeSuppliers: formatted.filter((s) => s.isActive).length,
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
