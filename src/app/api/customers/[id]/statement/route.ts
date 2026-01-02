import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "INVOICE" | "PAYMENT" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  openingBalance: number;
  transactions: StatementTransaction[];
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

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    // Get opening balance transaction
    const openingBalanceTxn = await prisma.customerTransaction.findFirst({
      where: {
        customerId: id,
        transactionType: "OPENING_BALANCE",
      },
      orderBy: { transactionDate: "asc" },
    });

    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: id,
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
      },
      orderBy: { issueDate: "asc" },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        total: true,
      },
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: {
        invoice: {
          customerId: id,
        },
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      orderBy: { paymentDate: "asc" },
      include: {
        invoice: {
          select: { invoiceNumber: true },
        },
      },
    });

    // Build transactions list
    const transactions: StatementTransaction[] = [];

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

    // Add invoices (debits - customer owes us)
    for (const invoice of invoices) {
      transactions.push({
        id: invoice.id,
        date: invoice.issueDate.toISOString(),
        type: "INVOICE",
        reference: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber}`,
        debit: Number(invoice.total),
        credit: 0,
        runningBalance: 0,
      });
    }

    // Add payments (credits - customer paid us)
    for (const payment of payments) {
      transactions.push({
        id: payment.id,
        date: payment.paymentDate.toISOString(),
        type: "PAYMENT",
        reference: payment.paymentNumber,
        description: `Payment for ${payment.invoice?.invoiceNumber || "Invoice"}`,
        debit: 0,
        credit: Number(payment.amount),
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

    const statement: CustomerStatement = {
      customer,
      openingBalance,
      transactions,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(statement);
  } catch (error) {
    console.error("Failed to generate statement:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 }
    );
  }
}
