import prisma from "@/lib/prisma";

export interface SalesRegisterRow {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentType: string;
  status: string;
}

export interface SalesRegisterData {
  rows: SalesRegisterRow[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
  };
  invoiceCount: number;
}

export async function getSalesRegisterData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<SalesRegisterData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      issueDate: { gte: from, lte: to },
    },
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      subtotal: true,
      total: true,
      amountPaid: true,
      balanceDue: true,
      paymentType: true,
      totalVat: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      customer: { select: { name: true } },
    },
    orderBy: { issueDate: "asc" },
  });

  const rows: SalesRegisterRow[] = invoices.map((inv) => {
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
      invoiceNumber: inv.invoiceNumber,
      date: inv.issueDate.toISOString(),
      customerName: inv.customer.name,
      subtotal: Number(inv.subtotal),
      tax,
      total: Number(inv.total),
      amountPaid,
      balanceDue,
      paymentType: inv.paymentType || "N/A",
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
