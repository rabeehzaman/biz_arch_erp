import prisma from "@/lib/prisma";

export interface VATSection {
  taxableAmount: number;
  vatAmount: number;
}

export interface VATSummaryData {
  sales: VATSection;
  salesReturns: VATSection;
  purchases: VATSection;
  purchaseReturns: VATSection;
  netOutputVAT: VATSection;
  netInputVAT: VATSection;
  netVATPayable: number;
}

export async function getVATSummaryData(
  organizationId: string,
  fromDate: string,
  toDate: string,
  branchId?: string
): Promise<VATSummaryData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const [salesAgg, salesReturnsAgg, purchasesAgg, purchaseReturnsAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { organizationId, issueDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      _sum: { subtotal: true, totalVat: true },
    }),
    prisma.creditNote.aggregate({
      where: { organizationId, issueDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      _sum: { subtotal: true, totalVat: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: { organizationId, invoiceDate: { gte: from, lte: to }, status: { not: "DRAFT" }, ...(branchId ? { branchId } : {}) },
      _sum: { subtotal: true, totalVat: true },
    }),
    prisma.debitNote.aggregate({
      where: { organizationId, issueDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      _sum: { subtotal: true, totalVat: true },
    }),
  ]);

  const getVal = (agg: any, field: string) => Number(agg?._sum?.[field] || 0);

  const sales = { taxableAmount: getVal(salesAgg, "subtotal"), vatAmount: getVal(salesAgg, "totalVat") };
  const salesReturns = { taxableAmount: getVal(salesReturnsAgg, "subtotal"), vatAmount: getVal(salesReturnsAgg, "totalVat") };
  const purchases = { taxableAmount: getVal(purchasesAgg, "subtotal"), vatAmount: getVal(purchasesAgg, "totalVat") };
  const purchaseReturns = { taxableAmount: getVal(purchaseReturnsAgg, "subtotal"), vatAmount: getVal(purchaseReturnsAgg, "totalVat") };

  const netOutputVAT = {
    taxableAmount: sales.taxableAmount - salesReturns.taxableAmount,
    vatAmount: sales.vatAmount - salesReturns.vatAmount,
  };

  const netInputVAT = {
    taxableAmount: purchases.taxableAmount - purchaseReturns.taxableAmount,
    vatAmount: purchases.vatAmount - purchaseReturns.vatAmount,
  };

  return {
    sales,
    salesReturns,
    purchases,
    purchaseReturns,
    netOutputVAT,
    netInputVAT,
    netVATPayable: netOutputVAT.vatAmount - netInputVAT.vatAmount,
  };
}
