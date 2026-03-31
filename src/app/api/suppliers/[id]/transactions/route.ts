import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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

    // Verify supplier belongs to this org
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();

    const [purchaseInvoices, payments, debitNotes, expenses] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: { supplierId: id, organizationId },
        orderBy: { invoiceDate: "desc" },
        select: {
          id: true,
          purchaseInvoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          total: true,
          balanceDue: true,
          supplierInvoiceRef: true,
        },
      }),
      prisma.supplierPayment.findMany({
        where: { supplierId: id, organizationId },
        orderBy: { paymentDate: "desc" },
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          amount: true,
          paymentMethod: true,
          purchaseInvoice: {
            select: { purchaseInvoiceNumber: true },
          },
        },
      }),
      prisma.debitNote.findMany({
        where: { supplierId: id, organizationId },
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          debitNoteNumber: true,
          issueDate: true,
          total: true,
        },
      }),
      prisma.expense.findMany({
        where: { supplierId: id, organizationId },
        orderBy: { expenseDate: "desc" },
        select: {
          id: true,
          expenseDate: true,
          total: true,
          description: true,
          items: {
            select: {
              account: {
                select: { name: true },
              },
            },
            take: 1,
          },
        },
      }),
    ]);

    // Compute purchase invoice status
    const purchaseInvoicesWithStatus = purchaseInvoices.map((inv) => {
      const total = Number(inv.total);
      const balanceDue = Number(inv.balanceDue);
      let status: string;

      if (balanceDue === 0) {
        status = "PAID";
      } else if (inv.dueDate < now && balanceDue > 0) {
        status = "OVERDUE";
      } else if (balanceDue < total) {
        status = "PARTIAL";
      } else {
        status = "UNPAID";
      }

      return {
        id: inv.id,
        purchaseInvoiceNumber: inv.purchaseInvoiceNumber,
        issueDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total,
        balanceDue,
        status,
        supplierInvoiceRef: inv.supplierInvoiceRef,
      };
    });

    return NextResponse.json({
      purchaseInvoices: purchaseInvoicesWithStatus,
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      debitNotes: debitNotes.map((dn) => ({
        ...dn,
        total: Number(dn.total),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        expenseDate: e.expenseDate,
        category: e.items[0]?.account?.name ?? null,
        total: Number(e.total),
        description: e.description,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch supplier transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier transactions" },
      { status: 500 }
    );
  }
}
