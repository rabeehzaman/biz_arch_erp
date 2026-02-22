import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function PUT(
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

    // Validate session belongs to org and is OPEN
    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
    });

    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    if (posSession.status !== "OPEN") {
      return NextResponse.json(
        { error: "This session is already closed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { closingCash, notes } = body;

    if (closingCash === undefined || closingCash === null) {
      return NextResponse.json(
        { error: "Closing cash amount is required" },
        { status: 400 }
      );
    }

    // Calculate expected cash: openingCash + sum of all CASH payments on invoices in this session
    const cashPayments = await prisma.payment.aggregate({
      where: {
        invoice: { posSessionId: id },
        paymentMethod: "CASH",
      },
      _sum: { amount: true },
    });

    const cashReceived = Number(cashPayments._sum.amount || 0);
    const expectedCash = Number(posSession.openingCash) + cashReceived;
    const cashDifference = Number(closingCash) - expectedCash;

    // Aggregate totals from invoices in this session
    const invoiceAggregates = await prisma.invoice.aggregate({
      where: { posSessionId: id },
      _sum: { total: true },
      _count: { id: true },
    });

    const totalSales = Number(invoiceAggregates._sum.total || 0);
    const totalTransactions = invoiceAggregates._count.id;

    // Update session
    const updatedSession = await prisma.pOSSession.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingCash,
        expectedCash,
        cashDifference,
        totalSales,
        totalTransactions,
        notes: notes || posSession.notes,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Failed to close POS session:", error);
    return NextResponse.json(
      { error: "Failed to close POS session" },
      { status: 500 }
    );
  }
}
