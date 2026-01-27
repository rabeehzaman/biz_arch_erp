import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export interface SupplierStatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "PURCHASE_INVOICE" | "PAYMENT" | "DEBIT_NOTE" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface SupplierStatement {
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  openingBalance: number;
  transactions: SupplierStatementTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  generatedAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    // Get opening balance transaction
    const openingBalanceTxn = await prisma.supplierTransaction.findFirst({
      where: {
        supplierId: id,
        transactionType: "OPENING_BALANCE",
      },
      orderBy: { transactionDate: "asc" },
    });

    // Get all purchase invoices
    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where: {
        supplierId: id,
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter }),
      },
      orderBy: { invoiceDate: "asc" },
      select: {
        id: true,
        purchaseInvoiceNumber: true,
        invoiceDate: true,
        total: true,
      },
    });

    // Get all supplier payments
    const payments = await prisma.supplierPayment.findMany({
      where: {
        supplierId: id,
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      orderBy: { paymentDate: "asc" },
      include: {
        purchaseInvoice: {
          select: { purchaseInvoiceNumber: true },
        },
      },
    });

    // Get all debit notes applied to balance
    const debitNotes = await prisma.debitNote.findMany({
      where: {
        supplierId: id,
        appliedToBalance: true,
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
      },
      orderBy: { issueDate: "asc" },
      select: {
        id: true,
        debitNoteNumber: true,
        issueDate: true,
        total: true,
        reason: true,
      },
    });

    // Build transactions list
    const transactions: SupplierStatementTransaction[] = [];

    // Add opening balance if exists
    if (openingBalanceTxn) {
      transactions.push({
        id: openingBalanceTxn.id,
        date: openingBalanceTxn.transactionDate.toISOString(),
        type: "OPENING_BALANCE",
        reference: "OB",
        description: openingBalanceTxn.description || "Opening Balance",
        debit: Number(openingBalanceTxn.amount) > 0 ? Number(openingBalanceTxn.amount) : 0,
        credit: Number(openingBalanceTxn.amount) < 0 ? Math.abs(Number(openingBalanceTxn.amount)) : 0,
        runningBalance: 0, // Will be calculated
      });
    }

    // Add purchase invoices (debits - we owe supplier)
    for (const invoice of purchaseInvoices) {
      transactions.push({
        id: invoice.id,
        date: invoice.invoiceDate.toISOString(),
        type: "PURCHASE_INVOICE",
        reference: invoice.purchaseInvoiceNumber,
        description: `Purchase Invoice ${invoice.purchaseInvoiceNumber}`,
        debit: Number(invoice.total),
        credit: 0,
        runningBalance: 0,
      });
    }

    // Add payments (credits - we paid supplier)
    for (const payment of payments) {
      transactions.push({
        id: payment.id,
        date: payment.paymentDate.toISOString(),
        type: "PAYMENT",
        reference: payment.paymentNumber,
        description: payment.purchaseInvoice?.purchaseInvoiceNumber
          ? `Payment for ${payment.purchaseInvoice.purchaseInvoiceNumber}`
          : `Payment ${payment.paymentNumber} (On Account)`,
        debit: 0,
        credit: Number(payment.amount),
        runningBalance: 0,
      });
    }

    // Add debit notes (credits - reduces what we owe supplier)
    for (const debitNote of debitNotes) {
      transactions.push({
        id: debitNote.id,
        date: debitNote.issueDate.toISOString(),
        type: "DEBIT_NOTE",
        reference: debitNote.debitNoteNumber,
        description: debitNote.reason || `Debit Note ${debitNote.debitNoteNumber}`,
        debit: 0,
        credit: Number(debitNote.total),
        runningBalance: 0,
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balances
    let runningBalance = 0;
    let totalDebits = 0;
    let totalCredits = 0;

    for (const txn of transactions) {
      totalDebits += txn.debit;
      totalCredits += txn.credit;
      runningBalance += txn.debit - txn.credit;
      txn.runningBalance = runningBalance;
    }

    const openingBalance = openingBalanceTxn ? Number(openingBalanceTxn.amount) : 0;

    const statement: SupplierStatement = {
      supplier,
      openingBalance,
      transactions,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(statement);
  } catch (error) {
    console.error("Failed to generate supplier statement:", error);
    return NextResponse.json(
      { error: "Failed to generate supplier statement" },
      { status: 500 }
    );
  }
}
