import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = getOrgId(session);
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type"); // ACCOUNT, CUSTOMER, SUPPLIER
        const id = searchParams.get("id");

        if (!type || !id) {
            return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
        }

        let result: any[] = [];
        let runningBalance = 0;

        if (type === "ACCOUNT") {
            const lines = await prisma.journalEntryLine.findMany({
                where: { accountId: id, organizationId, journalEntry: { status: "POSTED" } },
                include: { journalEntry: true },
                orderBy: { journalEntry: { date: "asc" } },
            });

            result = lines.map((line) => {
                runningBalance += Number(line.debit) - Number(line.credit);
                return {
                    id: line.id,
                    date: line.journalEntry.date,
                    ref: line.journalEntry.journalNumber,
                    description: line.description || line.journalEntry.description || "Journal Entry",
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                    balance: runningBalance,
                };
            });
        } else if (type === "CUSTOMER") {
            const txs = await prisma.customerTransaction.findMany({
                where: { customerId: id, organizationId },
                orderBy: { transactionDate: "asc" },
                include: { creditNote: true },
            });

            // Fetch related invoices and payments to get their numbers
            const invoiceIds = txs.map(t => t.invoiceId).filter(Boolean) as string[];
            const paymentIds = txs.map(t => t.paymentId).filter(Boolean) as string[];

            const invoices = await prisma.invoice.findMany({
                where: { id: { in: invoiceIds } },
                select: { id: true, invoiceNumber: true }
            });
            const payments = await prisma.payment.findMany({
                where: { id: { in: paymentIds } },
                select: { id: true, paymentNumber: true }
            });

            const invoiceMap = new Map(invoices.map(i => [i.id, i.invoiceNumber]));
            const paymentMap = new Map(payments.map(p => [p.id, p.paymentNumber]));

            result = txs.map((tx) => {
                runningBalance += Number(tx.amount);
                const invNum = tx.invoiceId ? invoiceMap.get(tx.invoiceId) : null;
                const payNum = tx.paymentId ? paymentMap.get(tx.paymentId) : null;
                const ref = invNum || payNum || tx.creditNote?.creditNoteNumber || "-";
                return {
                    id: tx.id,
                    date: tx.transactionDate,
                    ref,
                    description: tx.description,
                    debit: Number(tx.amount) > 0 ? Number(tx.amount) : 0,
                    credit: Number(tx.amount) < 0 ? Math.abs(Number(tx.amount)) : 0,
                    balance: runningBalance,
                };
            });
        } else if (type === "SUPPLIER") {
            const txs = await prisma.supplierTransaction.findMany({
                where: { supplierId: id, organizationId },
                orderBy: { transactionDate: "asc" },
                include: { debitNote: true },
            });

            const invoiceIds = txs.map(t => t.purchaseInvoiceId).filter(Boolean) as string[];
            const paymentIds = txs.map(t => t.supplierPaymentId).filter(Boolean) as string[];

            const invoices = await prisma.purchaseInvoice.findMany({
                where: { id: { in: invoiceIds } },
                select: { id: true, purchaseInvoiceNumber: true }
            });
            const payments = await prisma.supplierPayment.findMany({
                where: { id: { in: paymentIds } },
                select: { id: true, paymentNumber: true }
            });

            const invoiceMap = new Map(invoices.map(i => [i.id, i.purchaseInvoiceNumber]));
            const paymentMap = new Map(payments.map(p => [p.id, p.paymentNumber]));

            result = txs.map((tx) => {
                runningBalance += Number(tx.amount);
                const invNum = tx.purchaseInvoiceId ? invoiceMap.get(tx.purchaseInvoiceId) : null;
                const payNum = tx.supplierPaymentId ? paymentMap.get(tx.supplierPaymentId) : null;
                const ref = invNum || payNum || tx.debitNote?.debitNoteNumber || "-";
                return {
                    id: tx.id,
                    date: tx.transactionDate,
                    ref,
                    description: tx.description,
                    debit: Number(tx.amount) < 0 ? Math.abs(Number(tx.amount)) : 0, // usually payments to supplier reduce liability
                    credit: Number(tx.amount) > 0 ? Number(tx.amount) : 0, // purchases increase liability
                    balance: runningBalance,
                };
            });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to fetch ledger transactions:", error);
        return NextResponse.json(
            { error: "Failed to fetch ledger transactions" },
            { status: 500 }
        );
    }
}
