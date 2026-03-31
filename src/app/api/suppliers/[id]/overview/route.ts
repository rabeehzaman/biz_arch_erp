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
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();

    // Run all aggregate queries in parallel
    const [
      unpaidPurchaseInvoices,
      lastPurchaseInvoice,
      lastPayment,
      purchaseInvoiceCount,
      paymentCount,
      debitNoteCount,
      expenseCount,
    ] = await Promise.all([
      // Purchase invoices with balanceDue > 0 for outstanding + aging
      prisma.purchaseInvoice.findMany({
        where: {
          supplierId: id,
          organizationId,
          balanceDue: { gt: 0 },
        },
        select: {
          balanceDue: true,
          dueDate: true,
        },
      }),
      // Last purchase invoice date
      prisma.purchaseInvoice.findFirst({
        where: { supplierId: id, organizationId },
        orderBy: { invoiceDate: "desc" },
        select: { invoiceDate: true },
      }),
      // Last supplier payment date
      prisma.supplierPayment.findFirst({
        where: { supplierId: id, organizationId },
        orderBy: { paymentDate: "desc" },
        select: { paymentDate: true },
      }),
      // Counts
      prisma.purchaseInvoice.count({ where: { supplierId: id, organizationId } }),
      prisma.supplierPayment.count({ where: { supplierId: id, organizationId } }),
      prisma.debitNote.count({ where: { supplierId: id, organizationId } }),
      prisma.expense.count({ where: { supplierId: id, organizationId } }),
    ]);

    // Calculate totals and aging buckets
    let totalOutstanding = 0;
    const aging = { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };

    for (const inv of unpaidPurchaseInvoices) {
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
      supplier: {
        ...supplier,
        balance: Number(supplier.balance),
      },
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      aging,
      lastInvoiceDate: lastPurchaseInvoice?.invoiceDate?.toISOString() ?? null,
      lastPaymentDate: lastPayment?.paymentDate?.toISOString() ?? null,
      counts: {
        purchaseInvoices: purchaseInvoiceCount,
        payments: paymentCount,
        debitNotes: debitNoteCount,
        expenses: expenseCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch supplier overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier overview" },
      { status: 500 }
    );
  }
}
