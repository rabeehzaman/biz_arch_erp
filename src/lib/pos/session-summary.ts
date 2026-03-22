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

export interface POSSessionReportInvoicePayment {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  paymentDate: Date;
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
  payments: POSSessionReportInvoicePayment[];
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

export interface POSSessionCashOutEntry {
  id: string;
  type: "SUPPLIER_PAYMENT" | "EXPENSE" | "TRANSFER" | "OTHER";
  description: string;
  amount: number;
  createdAt: Date;
  referenceId: string | null;
  referenceName: string | null;
}

export interface POSSessionCashMovementSummary {
  supplierPaymentsTotal: number;
  expensesTotal: number;
  transfersOutTotal: number;
  transfersInTotal: number;
  otherCashOutTotal: number;
  otherCashInTotal: number;
  totalCashOut: number;
  totalCashIn: number;
  entries: POSSessionCashOutEntry[];
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
    totalReturns: number;
    totalReturnTransactions: number;
    notes: string | null;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
    employee: {
      id: string;
      name: string;
    } | null;
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
  cashMovements: POSSessionCashMovementSummary;
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
      employee: {
        select: { id: true, name: true },
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
      payments: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          reference: true,
          paymentDate: true,
        },
        orderBy: { paymentDate: "asc" },
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

  // Fetch credit notes (returns) for this session to show refunds in the breakdown
  const sessionCreditNotes = await prisma.creditNote.findMany({
    where: { posSessionId: id, organizationId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, arabicName: true },
          },
        },
      },
    },
  });

  const totalRefunds = sessionCreditNotes.reduce((sum, cn) => sum + Number(cn.total), 0);
  if (totalRefunds > 0) {
    paymentMap.set("CASH_REFUND", { total: -totalRefunds, count: sessionCreditNotes.length });
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

  // Net out returned items from sold products
  for (const cn of sessionCreditNotes) {
    for (const item of cn.items) {
      const key = item.productId || item.description;
      const existing = soldProductMap.get(key);
      if (existing) {
        existing.quantity -= Number(item.quantity);
        existing.revenue -= Number(item.total);
        // Remove entry if fully returned (qty hits 0 or below)
        if (existing.quantity <= 0) {
          soldProductMap.delete(key);
        }
      }
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
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      method: payment.paymentMethod,
      amount: Number(payment.amount),
      reference: payment.reference,
      paymentDate: payment.paymentDate,
    })),
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

  // ── Cash movements during session ──────────────────────────────────
  const cashOutEntries: POSSessionCashOutEntry[] = [];

  // Supplier payments made during this session
  const sessionSupplierPayments = await prisma.supplierPayment.findMany({
    where: { organizationId, posSessionId: id },
    include: { supplier: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  let supplierPaymentsTotal = 0;
  for (const sp of sessionSupplierPayments) {
    const amt = Number(sp.amount);
    supplierPaymentsTotal += amt;
    cashOutEntries.push({
      id: sp.id,
      type: "SUPPLIER_PAYMENT",
      description: `Vendor Payment - ${sp.supplier.name} (${sp.paymentNumber})`,
      amount: amt,
      createdAt: sp.createdAt,
      referenceId: sp.supplierId,
      referenceName: sp.supplier.name,
    });
  }

  // Expenses paid during this session
  const sessionExpenses = await prisma.expense.findMany({
    where: { organizationId, posSessionId: id, status: "PAID" },
    orderBy: { createdAt: "asc" },
  });
  let expensesTotal = 0;
  for (const exp of sessionExpenses) {
    const amt = Number(exp.total);
    expensesTotal += amt;
    cashOutEntries.push({
      id: exp.id,
      type: "EXPENSE",
      description: `Expense - ${exp.expenseNumber}${exp.description ? `: ${exp.description}` : ""}`,
      amount: amt,
      createdAt: exp.createdAt,
      referenceId: exp.id,
      referenceName: exp.expenseNumber,
    });
  }

  // Transfers during this session
  const sessionTransfersOut = await prisma.cashBankTransaction.findMany({
    where: { organizationId, posSessionId: id, transactionType: "TRANSFER_OUT" },
    include: { cashBankAccount: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  let transfersOutTotal = 0;
  for (const tx of sessionTransfersOut) {
    const amt = Math.abs(Number(tx.amount));
    transfersOutTotal += amt;
    cashOutEntries.push({
      id: tx.id,
      type: "TRANSFER",
      description: `Transfer Out - ${tx.description}`,
      amount: amt,
      createdAt: tx.createdAt,
      referenceId: tx.referenceId,
      referenceName: tx.cashBankAccount.name,
    });
  }

  const sessionTransfersInAgg = await prisma.cashBankTransaction.aggregate({
    where: { organizationId, posSessionId: id, transactionType: "TRANSFER_IN" },
    _sum: { amount: true },
  });
  const transfersInTotal = Number(sessionTransfersInAgg._sum.amount || 0);

  // Other cash movements (POSCashMovement)
  const sessionCashMovements = await prisma.pOSCashMovement.findMany({
    where: { organizationId, sessionId: id },
    orderBy: { createdAt: "asc" },
  });
  let otherCashOutTotal = 0;
  let otherCashInTotal = 0;
  for (const cm of sessionCashMovements) {
    const amt = Number(cm.amount);
    if (cm.type === "CASH_OUT") {
      otherCashOutTotal += amt;
      cashOutEntries.push({
        id: cm.id,
        type: "OTHER",
        description: `Cash Out - ${cm.reason}`,
        amount: amt,
        createdAt: cm.createdAt,
        referenceId: null,
        referenceName: null,
      });
    } else {
      otherCashInTotal += amt;
    }
  }

  const totalCashOut = supplierPaymentsTotal + expensesTotal + transfersOutTotal + otherCashOutTotal;
  const totalCashIn = transfersInTotal + otherCashInTotal;

  const cashMovements: POSSessionCashMovementSummary = {
    supplierPaymentsTotal,
    expensesTotal,
    transfersOutTotal,
    transfersInTotal,
    otherCashOutTotal,
    otherCashInTotal,
    totalCashOut,
    totalCashIn,
    entries: cashOutEntries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  };

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
      totalReturns: Number(posSession.totalReturns),
      totalReturnTransactions: posSession.totalReturnTransactions,
      notes: posSession.notes,
      user: {
        id: posSession.user.id,
        name: posSession.user.name,
        email: posSession.user.email,
      },
      employee: posSession.employee
        ? {
            id: posSession.employee.id,
            name: posSession.employee.name,
          }
        : null,
      branch: posSession.branch,
      warehouse: posSession.warehouse,
    },
    invoices: normalizedInvoices,
    paymentBreakdown,
    soldProducts,
    cashMovements,
    totals: {
      invoiceCount: normalizedInvoices.length,
      soldProductCount: soldProducts.length,
      totalQuantity: soldProducts.reduce((sum, item) => sum + item.quantity, 0),
      totalPaid: normalizedInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      totalBalanceDue: normalizedInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    },
  };
}
