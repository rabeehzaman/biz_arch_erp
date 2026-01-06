import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      totalInvoices,
      pendingInvoices,
      totalCustomers,
      totalProducts,
      revenueResult,
      recentInvoices,
    ] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({
        where: { balanceDue: { gt: 0 } },
      }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.invoice.aggregate({
        _sum: { amountPaid: true },
      }),
      prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      totalInvoices,
      pendingInvoices,
      totalCustomers,
      totalProducts,
      totalRevenue: Number(revenueResult._sum.amountPaid || 0),
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.name,
        total: Number(inv.total),
        createdAt: inv.createdAt.toISOString(),
      })),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
