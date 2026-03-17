import prisma from "@/lib/prisma";

export interface LedgerTransaction {
  id: string;
  date: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerData {
  entityName: string;
  entityType: "ACCOUNT" | "CUSTOMER" | "SUPPLIER";
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactions: LedgerTransaction[];
}

export async function getLedgerData(
  organizationId: string,
  entityType: "ACCOUNT" | "CUSTOMER" | "SUPPLIER",
  entityId: string,
  fromDate?: string,
  toDate?: string
): Promise<LedgerData> {
  let entityName = "";
  let transactions: LedgerTransaction[] = [];
  let openingBalance = 0;

  if (entityType === "ACCOUNT") {
    const account = await prisma.account.findUnique({
      where: { id: entityId, organizationId },
      select: { name: true, code: true },
    });
    entityName = account ? `${account.code} - ${account.name}` : "Unknown Account";

    const dateFilter: Record<string, any> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate + "T23:59:59.999Z");

    // Opening balance: sum of debits - credits before fromDate
    if (fromDate) {
      const priorLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: entityId,
          organizationId,
          journalEntry: {
            status: "POSTED",
            date: { lt: new Date(fromDate) },
          },
        },
        select: { debit: true, credit: true },
      });
      openingBalance = priorLines.reduce(
        (sum, l) => sum + Number(l.debit) - Number(l.credit),
        0
      );
    }

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: entityId,
        organizationId,
        journalEntry: {
          status: "POSTED",
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let runningBalance = openingBalance;
    transactions = lines.map((line) => {
      runningBalance += Number(line.debit) - Number(line.credit);
      return {
        id: line.id,
        date: line.journalEntry.date.toISOString(),
        ref: line.journalEntry.journalNumber,
        description:
          line.description || line.journalEntry.description || "Journal Entry",
        debit: Number(line.debit),
        credit: Number(line.credit),
        balance: runningBalance,
      };
    });
  } else if (entityType === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { id: entityId, organizationId },
      select: { name: true },
    });
    entityName = customer?.name || "Unknown Customer";

    const dateFilter: Record<string, any> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate + "T23:59:59.999Z");

    if (fromDate) {
      const priorTxs = await prisma.customerTransaction.findMany({
        where: {
          customerId: entityId,
          organizationId,
          transactionDate: { lt: new Date(fromDate) },
        },
        select: { amount: true },
      });
      openingBalance = priorTxs.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
    }

    const txs = await prisma.customerTransaction.findMany({
      where: {
        customerId: entityId,
        organizationId,
        ...(Object.keys(dateFilter).length > 0
          ? { transactionDate: dateFilter }
          : {}),
      },
      orderBy: { transactionDate: "asc" },
      include: { creditNote: true },
    });

    const invoiceIds = txs
      .map((t) => t.invoiceId)
      .filter(Boolean) as string[];
    const paymentIds = txs
      .map((t) => t.paymentId)
      .filter(Boolean) as string[];

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, invoiceNumber: true },
      }),
      prisma.payment.findMany({
        where: { id: { in: paymentIds } },
        select: { id: true, paymentNumber: true },
      }),
    ]);

    const invoiceMap = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
    const paymentMap = new Map(payments.map((p) => [p.id, p.paymentNumber]));

    let runningBalance = openingBalance;
    transactions = txs.map((tx) => {
      runningBalance += Number(tx.amount);
      const invNum = tx.invoiceId ? invoiceMap.get(tx.invoiceId) : null;
      const payNum = tx.paymentId ? paymentMap.get(tx.paymentId) : null;
      const ref =
        invNum || payNum || tx.creditNote?.creditNoteNumber || "-";
      return {
        id: tx.id,
        date: tx.transactionDate.toISOString(),
        ref,
        description: tx.description || "",
        debit: Number(tx.amount) > 0 ? Number(tx.amount) : 0,
        credit: Number(tx.amount) < 0 ? Math.abs(Number(tx.amount)) : 0,
        balance: runningBalance,
      };
    });
  } else if (entityType === "SUPPLIER") {
    const supplier = await prisma.supplier.findUnique({
      where: { id: entityId, organizationId },
      select: { name: true },
    });
    entityName = supplier?.name || "Unknown Supplier";

    const dateFilter: Record<string, any> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate + "T23:59:59.999Z");

    if (fromDate) {
      const priorTxs = await prisma.supplierTransaction.findMany({
        where: {
          supplierId: entityId,
          organizationId,
          transactionDate: { lt: new Date(fromDate) },
        },
        select: { amount: true },
      });
      openingBalance = priorTxs.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
    }

    const txs = await prisma.supplierTransaction.findMany({
      where: {
        supplierId: entityId,
        organizationId,
        ...(Object.keys(dateFilter).length > 0
          ? { transactionDate: dateFilter }
          : {}),
      },
      orderBy: { transactionDate: "asc" },
      include: { debitNote: true },
    });

    const invoiceIds = txs
      .map((t) => t.purchaseInvoiceId)
      .filter(Boolean) as string[];
    const paymentIds = txs
      .map((t) => t.supplierPaymentId)
      .filter(Boolean) as string[];

    const [invoices, payments] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, purchaseInvoiceNumber: true },
      }),
      prisma.supplierPayment.findMany({
        where: { id: { in: paymentIds } },
        select: { id: true, paymentNumber: true },
      }),
    ]);

    const invoiceMap = new Map(
      invoices.map((i) => [i.id, i.purchaseInvoiceNumber])
    );
    const paymentMap = new Map(
      payments.map((p) => [p.id, p.paymentNumber])
    );

    let runningBalance = openingBalance;
    transactions = txs.map((tx) => {
      runningBalance += Number(tx.amount);
      const invNum = tx.purchaseInvoiceId
        ? invoiceMap.get(tx.purchaseInvoiceId)
        : null;
      const payNum = tx.supplierPaymentId
        ? paymentMap.get(tx.supplierPaymentId)
        : null;
      const ref =
        invNum || payNum || tx.debitNote?.debitNoteNumber || "-";
      return {
        id: tx.id,
        date: tx.transactionDate.toISOString(),
        ref,
        description: tx.description || "",
        debit: Number(tx.amount) < 0 ? Math.abs(Number(tx.amount)) : 0,
        credit: Number(tx.amount) > 0 ? Number(tx.amount) : 0,
        balance: runningBalance,
      };
    });
  }

  const totalDebit = transactions.reduce((sum, tx) => sum + tx.debit, 0);
  const totalCredit = transactions.reduce((sum, tx) => sum + tx.credit, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  return {
    entityName,
    entityType,
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance,
    transactions,
  };
}
