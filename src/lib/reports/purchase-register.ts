import prisma from "@/lib/prisma";

export interface PurchaseRegisterRow {
  id: string;
  invoiceNumber: string;
  date: string;
  supplierName: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

export interface PurchaseRegisterData {
  rows: PurchaseRegisterRow[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
  };
  invoiceCount: number;
}

export async function getPurchaseRegisterData(
  organizationId: string,
  fromDate: string,
  toDate: string,
  branchId?: string
): Promise<PurchaseRegisterData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      organizationId,
      invoiceDate: { gte: from, lte: to },
      status: { not: "DRAFT" },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      purchaseInvoiceNumber: true,
      invoiceDate: true,
      subtotal: true,
      total: true,
      amountPaid: true,
      balanceDue: true,
      status: true,
      totalVat: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      supplier: { select: { name: true } },
    },
    orderBy: { invoiceDate: "asc" },
  });

  const rows: PurchaseRegisterRow[] = invoices.map((inv) => {
    const balanceDue = Number(inv.balanceDue);
    const amountPaid = Number(inv.amountPaid);
    const tax =
      Number(inv.totalVat || 0) +
      Number(inv.totalCgst || 0) +
      Number(inv.totalSgst || 0) +
      Number(inv.totalIgst || 0);

    let status: string;
    if (balanceDue <= 0) {
      status = "PAID";
    } else if (amountPaid > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }

    return {
      id: inv.id,
      invoiceNumber: inv.purchaseInvoiceNumber,
      date: inv.invoiceDate.toISOString(),
      supplierName: inv.supplier.name,
      subtotal: Number(inv.subtotal),
      tax,
      total: Number(inv.total),
      amountPaid,
      balanceDue,
      status,
    };
  });

  const totals = {
    subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
    tax: rows.reduce((s, r) => s + r.tax, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    amountPaid: rows.reduce((s, r) => s + r.amountPaid, 0),
    balanceDue: rows.reduce((s, r) => s + r.balanceDue, 0),
  };

  return { rows, totals, invoiceCount: rows.length };
}
