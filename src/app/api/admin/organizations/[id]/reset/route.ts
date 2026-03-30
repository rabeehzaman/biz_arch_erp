import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { seedDefaultCOA } from "@/lib/accounting/seed-coa";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { type } = body;

        if (!["transactions_only", "complete_reset"].includes(type)) {
            return NextResponse.json({ error: "Invalid reset type" }, { status: 400 });
        }

        const org = await prisma.organization.findUnique({
            where: { id },
        });

        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // 1. Delete dependent transactional records first (allocations and consumptions)
        await prisma.paymentAllocation.deleteMany({ where: { organizationId: id } });
        await prisma.supplierPaymentAllocation.deleteMany({ where: { organizationId: id } });

        await prisma.stockLotConsumption.deleteMany({ where: { organizationId: id } });
        await prisma.debitNoteLotConsumption.deleteMany({ where: { organizationId: id } });
        await prisma.costAuditLog.deleteMany({ where: { organizationId: id } });

        // 2. Stock lots must be deleted before their sources (purchase invoice items, opening stocks)
        await prisma.stockLot.deleteMany({ where: { organizationId: id } });
        await prisma.openingStock.deleteMany({ where: { organizationId: id } });

        // 3. Delete document line items
        await prisma.invoiceItem.deleteMany({ where: { organizationId: id } });
        await prisma.purchaseInvoiceItem.deleteMany({ where: { organizationId: id } });
        await prisma.quotationItem.deleteMany({ where: { organizationId: id } });
        await prisma.creditNoteItem.deleteMany({ where: { organizationId: id } });
        await prisma.debitNoteItem.deleteMany({ where: { organizationId: id } });
        await prisma.expenseItem.deleteMany({ where: { organizationId: id } });
        await prisma.journalEntryLine.deleteMany({ where: { organizationId: id } });
        await prisma.pOSHeldOrder.deleteMany({ where: { organizationId: id } });

        // 4. Core transactional documents and payments
        await prisma.payment.deleteMany({ where: { organizationId: id } });
        await prisma.supplierPayment.deleteMany({ where: { organizationId: id } });

        // Break Quotation-Invoice foreign key loop before deleting invoices
        await prisma.quotation.updateMany({
            where: { organizationId: id },
            data: { convertedInvoiceId: null }
        });

        await prisma.creditNote.deleteMany({ where: { organizationId: id } });
        await prisma.debitNote.deleteMany({ where: { organizationId: id } });

        await prisma.invoice.deleteMany({ where: { organizationId: id } });
        await prisma.purchaseInvoice.deleteMany({ where: { organizationId: id } });
        await prisma.quotation.deleteMany({ where: { organizationId: id } });
        await prisma.expense.deleteMany({ where: { organizationId: id } });
        await prisma.journalEntry.deleteMany({ where: { organizationId: id } });
        await prisma.pOSSession.deleteMany({ where: { organizationId: id } });

        // 5. Delete statement transactions
        await prisma.cashBankTransaction.deleteMany({ where: { organizationId: id } });
        await prisma.customerTransaction.deleteMany({ where: { organizationId: id } });
        await prisma.supplierTransaction.deleteMany({ where: { organizationId: id } });

        // Reset Balances
        await prisma.customer.updateMany({
            where: { organizationId: id },
            data: { balance: 0 },
        });
        await prisma.supplier.updateMany({
            where: { organizationId: id },
            data: { balance: 0 },
        });
        await prisma.cashBankAccount.updateMany({
            where: { organizationId: id },
            data: { balance: 0 },
        });

        if (type === "complete_reset") {
            // Complete reset: delete master data
            await prisma.customerAssignment.deleteMany({ where: { organizationId: id } });
            await prisma.customer.deleteMany({ where: { organizationId: id } });
            await prisma.supplier.deleteMany({ where: { organizationId: id } });

            await prisma.unitConversion.deleteMany({ where: { organizationId: id } });
            await prisma.product.deleteMany({ where: { organizationId: id } });
            await prisma.productCategory.deleteMany({ where: { organizationId: id } });
            await prisma.unit.deleteMany({ where: { organizationId: id } });

            await prisma.cashBankAccount.deleteMany({ where: { organizationId: id } });
            await prisma.account.deleteMany({ where: { organizationId: id } });

            await prisma.setting.deleteMany({ where: { organizationId: id } });

            // Re-seed Chart of Accounts
            try {
                await seedDefaultCOA(prisma as never, id);
            } catch (err) {
                console.error("Failed to re-seed COA during reset:", err);
            }
        }

        return NextResponse.json({ message: "Reset successful", type });
    } catch (error) {
        console.error("Failed to reset organization:", error);
        return NextResponse.json(
            { error: "Failed to reset organization. Please check server logs." },
            { status: 500 }
        );
    }
}
