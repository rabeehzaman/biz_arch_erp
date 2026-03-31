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

    // Verify customer belongs to this org
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();

    const [invoices, payments, creditNotes, quotations] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId: id, organizationId },
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          total: true,
          balanceDue: true,
        },
      }),
      prisma.payment.findMany({
        where: { customerId: id, organizationId },
        orderBy: { paymentDate: "desc" },
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          amount: true,
          paymentMethod: true,
          invoice: {
            select: { invoiceNumber: true },
          },
        },
      }),
      prisma.creditNote.findMany({
        where: { customerId: id, organizationId },
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          creditNoteNumber: true,
          issueDate: true,
          total: true,
        },
      }),
      prisma.quotation.findMany({
        where: { customerId: id, organizationId },
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          quotationNumber: true,
          issueDate: true,
          validUntil: true,
          total: true,
          status: true,
        },
      }),
    ]);

    // Compute invoice status
    const invoicesWithStatus = invoices.map((inv) => {
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
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        total,
        balanceDue,
        status,
      };
    });

    return NextResponse.json({
      invoices: invoicesWithStatus,
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      creditNotes: creditNotes.map((cn) => ({
        ...cn,
        total: Number(cn.total),
      })),
      quotations: quotations.map((q) => ({
        ...q,
        total: Number(q.total),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch customer transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer transactions" },
      { status: 500 }
    );
  }
}
