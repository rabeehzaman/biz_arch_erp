import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    // Get the session
    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    // Get all invoices for this session with items
    const invoices = await prisma.invoice.findMany({
      where: { posSessionId: id },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Get all payments for invoices in this session
    const invoiceIds = invoices.map((inv) => inv.id);
    const payments = await prisma.payment.findMany({
      where: { invoiceId: { in: invoiceIds } },
    });

    // Group payments by method and sum amounts
    const paymentMap = new Map<string, { total: number; count: number }>();
    for (const payment of payments) {
      const method = payment.paymentMethod;
      const existing = paymentMap.get(method) || { total: 0, count: 0 };
      existing.total += Number(payment.amount);
      existing.count += 1;
      paymentMap.set(method, existing);
    }

    const paymentBreakdown = Array.from(paymentMap.entries()).map(
      ([method, data]) => ({
        method,
        total: data.total,
        count: data.count,
      })
    );

    // Calculate top products by quantity sold
    const productMap = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const key = item.productId || item.description;
        const name = item.product?.name || item.description;
        const existing = productMap.get(key) || {
          name,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += Number(item.quantity);
        existing.revenue += Number(item.total);
        productMap.set(key, existing);
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return NextResponse.json({
      session: posSession,
      paymentBreakdown,
      invoices,
      topProducts,
    });
  } catch (error) {
    console.error("Failed to fetch POS session summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS session summary" },
      { status: 500 }
    );
  }
}
