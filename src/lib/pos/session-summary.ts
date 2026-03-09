import prisma from "@/lib/prisma";

export interface POSSessionReportInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  productId: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    arabicName: string | null;
  } | null;
}

export interface POSSessionReportInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  createdAt: Date;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentType: string;
  customer: {
    id: string;
    name: string;
    arabicName: string | null;
  };
  items: POSSessionReportInvoiceItem[];
}

export interface POSSessionSoldProduct {
  key: string;
  name: string;
  arabicName: string | null;
  sku: string | null;
  quantity: number;
  revenue: number;
  lineCount: number;
}

export interface POSSessionPaymentBreakdown {
  method: string;
  total: number;
  count: number;
}

export interface POSSessionReportData {
  session: {
    id: string;
    sessionNumber: string;
    status: string;
    openedAt: Date;
    closedAt: Date | null;
    openingCash: number;
    closingCash: number | null;
    expectedCash: number | null;
    cashDifference: number | null;
    totalSales: number;
    totalTransactions: number;
    notes: string | null;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
    branch: {
      id: string;
      name: string;
      code: string;
    } | null;
    warehouse: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  invoices: POSSessionReportInvoice[];
  paymentBreakdown: POSSessionPaymentBreakdown[];
  soldProducts: POSSessionSoldProduct[];
  totals: {
    invoiceCount: number;
    soldProductCount: number;
    totalQuantity: number;
    totalPaid: number;
    totalBalanceDue: number;
  };
}

export async function getPOSSessionReportData(
  organizationId: string,
  id: string
): Promise<POSSessionReportData | null> {
  const posSession = await prisma.pOSSession.findFirst({
    where: { id, organizationId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
      warehouse: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (!posSession) {
    return null;
  }

  const invoices = await prisma.invoice.findMany({
    where: { posSessionId: id, organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: { id: true, name: true, arabicName: true },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              arabicName: true,
            },
          },
        },
      },
    },
  });

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const payments = invoiceIds.length
    ? await prisma.payment.findMany({
        where: {
          organizationId,
          invoiceId: { in: invoiceIds },
        },
      })
    : [];

  const paymentMap = new Map<string, { total: number; count: number }>();
  for (const payment of payments) {
    const method = payment.paymentMethod || "OTHER";
    const existing = paymentMap.get(method) || { total: 0, count: 0 };
    existing.total += Number(payment.amount);
    existing.count += 1;
    paymentMap.set(method, existing);
  }

  const soldProductMap = new Map<string, POSSessionSoldProduct>();
  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const key = item.productId || item.description;
      const existing = soldProductMap.get(key) || {
        key,
        name: item.product?.name || item.description,
        arabicName: item.product?.arabicName || null,
        sku: item.product?.sku || null,
        quantity: 0,
        revenue: 0,
        lineCount: 0,
      };

      existing.quantity += Number(item.quantity);
      existing.revenue += Number(item.total);
      existing.lineCount += 1;
      soldProductMap.set(key, existing);
    }
  }

  const normalizedInvoices: POSSessionReportInvoice[] = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    createdAt: invoice.createdAt,
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balanceDue: Number(invoice.balanceDue),
    paymentType: invoice.paymentType,
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      arabicName: invoice.customer.arabicName,
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      total: Number(item.total),
      productId: item.productId,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            arabicName: item.product.arabicName,
          }
        : null,
    })),
  }));

  const soldProducts = Array.from(soldProductMap.values()).sort((a, b) => {
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return b.revenue - a.revenue;
  });

  const paymentBreakdown = Array.from(paymentMap.entries())
    .map(([method, data]) => ({
      method,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    session: {
      id: posSession.id,
      sessionNumber: posSession.sessionNumber,
      status: posSession.status,
      openedAt: posSession.openedAt,
      closedAt: posSession.closedAt,
      openingCash: Number(posSession.openingCash),
      closingCash: posSession.closingCash == null ? null : Number(posSession.closingCash),
      expectedCash: posSession.expectedCash == null ? null : Number(posSession.expectedCash),
      cashDifference: posSession.cashDifference == null ? null : Number(posSession.cashDifference),
      totalSales: Number(posSession.totalSales),
      totalTransactions: posSession.totalTransactions,
      notes: posSession.notes,
      user: {
        id: posSession.user.id,
        name: posSession.user.name,
        email: posSession.user.email,
      },
      branch: posSession.branch,
      warehouse: posSession.warehouse,
    },
    invoices: normalizedInvoices,
    paymentBreakdown,
    soldProducts,
    totals: {
      invoiceCount: normalizedInvoices.length,
      soldProductCount: soldProducts.length,
      totalQuantity: soldProducts.reduce((sum, item) => sum + item.quantity, 0),
      totalPaid: normalizedInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      totalBalanceDue: normalizedInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    },
  };
}
