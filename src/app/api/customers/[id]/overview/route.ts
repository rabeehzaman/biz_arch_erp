import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { canAccessCustomer, isAdminRole } from "@/lib/access-control";

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

    // Check salesman assignment
    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdminRole(session.user.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify customer belongs to this org
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        gstin: true,
        vatNumber: true,
        arabicName: true,
        ccNo: true,
        buildingNo: true,
        addNo: true,
        district: true,
        balance: true,
        notes: true,
        isActive: true,
        createdAt: true,
        assignments: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();

    // Run all aggregate queries in parallel
    const [
      unpaidInvoices,
      unusedCreditsAgg,
      lastInvoice,
      lastPayment,
      invoiceCount,
      paymentCount,
      creditNoteCount,
      quotationCount,
    ] = await Promise.all([
      // Invoices with balanceDue > 0 for outstanding + aging
      prisma.invoice.findMany({
        where: {
          customerId: id,
          organizationId,
          balanceDue: { gt: 0 },
        },
        select: {
          balanceDue: true,
          dueDate: true,
        },
      }),
      // Sum of unapplied credit notes
      prisma.creditNote.aggregate({
        where: {
          customerId: id,
          organizationId,
          appliedToBalance: false,
          creditNoteNumber: { not: "" },
        },
        _sum: { total: true },
      }),
      // Last invoice date
      prisma.invoice.findFirst({
        where: { customerId: id, organizationId },
        orderBy: { issueDate: "desc" },
        select: { issueDate: true },
      }),
      // Last payment date
      prisma.payment.findFirst({
        where: { customerId: id, organizationId },
        orderBy: { paymentDate: "desc" },
        select: { paymentDate: true },
      }),
      // Counts
      prisma.invoice.count({ where: { customerId: id, organizationId } }),
      prisma.payment.count({ where: { customerId: id, organizationId } }),
      prisma.creditNote.count({ where: { customerId: id, organizationId } }),
      prisma.quotation.count({ where: { customerId: id, organizationId } }),
    ]);

    // Calculate totals and aging buckets
    let totalOutstanding = 0;
    const aging = { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };

    for (const inv of unpaidInvoices) {
      const balanceDue = Number(inv.balanceDue);
      totalOutstanding += balanceDue;

      if (inv.dueDate) {
        const diffMs = now.getTime() - new Date(inv.dueDate).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          aging.current += balanceDue;
        } else if (diffDays <= 60) {
          aging.days31_60 += balanceDue;
        } else if (diffDays <= 90) {
          aging.days61_90 += balanceDue;
        } else {
          aging.days90Plus += balanceDue;
        }
      } else {
        aging.current += balanceDue;
      }
    }

    // Round aging values
    aging.current = Math.round(aging.current * 100) / 100;
    aging.days31_60 = Math.round(aging.days31_60 * 100) / 100;
    aging.days61_90 = Math.round(aging.days61_90 * 100) / 100;
    aging.days90Plus = Math.round(aging.days90Plus * 100) / 100;

    return NextResponse.json({
      customer: {
        ...customer,
        balance: Number(customer.balance),
      },
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalUnusedCredits: Number(unusedCreditsAgg._sum.total ?? 0),
      aging,
      lastInvoiceDate: lastInvoice?.issueDate?.toISOString() ?? null,
      lastPaymentDate: lastPayment?.paymentDate?.toISOString() ?? null,
      counts: {
        invoices: invoiceCount,
        payments: paymentCount,
        creditNotes: creditNoteCount,
        quotations: quotationCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch customer overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer overview" },
      { status: 500 }
    );
  }
}
