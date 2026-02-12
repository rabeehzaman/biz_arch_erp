import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { SupplierStatementPDF } from "@/components/pdf/supplier-statement-pdf";
import { createElement } from "react";

interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "PURCHASE_INVOICE" | "PAYMENT" | "DEBIT_NOTE" | "ADJUSTMENT";
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const supplier = await prisma.supplier.findUnique({
      where: { id, organizationId },
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
        organizationId,
      },
      orderBy: { transactionDate: "asc" },
    });

    // Get all purchase invoices
    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where: {
        supplierId: id,
        organizationId,
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
        organizationId,
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
        organizationId,
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

    const statement = {
      supplier,
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
      createElement(SupplierStatementPDF, { statement }) as any
    );

    // Return PDF as response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${supplier.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate supplier PDF statement:", error);
    return NextResponse.json(
      { error: "Failed to generate supplier PDF statement" },
      { status: 500 }
    );
  }
}
