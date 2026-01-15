import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { CustomerStatementPDF } from "@/components/pdf/customer-statement-pdf";
import { createElement } from "react";

interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "INVOICE" | "PAYMENT" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
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

    // Get all payments (by customerId directly to include on-account payments)
    const payments = await prisma.payment.findMany({
      where: {
        customerId: id,
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
        runningBalance: 0,
      });
    }

    // Add invoices
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

    // Add payments
    for (const payment of payments) {
      transactions.push({
        id: payment.id,
        date: payment.paymentDate.toISOString(),
        type: "PAYMENT",
        reference: payment.paymentNumber,
        description: payment.invoice?.invoiceNumber
          ? `Payment for ${payment.invoice.invoiceNumber}`
          : `Payment ${payment.paymentNumber} (On Account)`,
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

    const statement = {
      customer,
      openingBalance,
      transactions,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      generatedAt: new Date().toISOString(),
    };

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      createElement(CustomerStatementPDF, { statement }) as any
    );

    // Return PDF as response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${customer.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate PDF statement:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF statement" },
      { status: 500 }
    );
  }
}
