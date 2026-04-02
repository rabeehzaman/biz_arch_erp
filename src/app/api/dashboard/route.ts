import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);
    const isAdmin = isAdminRole(session.user.role);
    const userId = session.user.id;

    // Scoped filters: admins see everything, salesmen see only assigned customers' data
    const invoiceWhere = isAdmin
      ? { organizationId }
      : { organizationId, customer: { assignments: { some: { userId } } } };
    const customerWhere = isAdmin
      ? { organizationId, isActive: true }
      : { organizationId, isActive: true, assignments: { some: { userId } } };

    const [
      totalInvoices,
      pendingInvoices,
      totalCustomers,
      totalProducts,
      revenueResult,
      collectedResult,
      recentInvoices,
      totalBranches,
      totalWarehouses,
    ] = await Promise.all([
      prisma.invoice.count({ where: invoiceWhere }),
      prisma.invoice.count({
        where: { ...invoiceWhere, balanceDue: { gt: 0 } },
      }),
      prisma.customer.count({ where: customerWhere }),
      prisma.product.count({ where: { organizationId, isActive: true } }),
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { amountPaid: true },
      }),
      prisma.invoice.findMany({
        where: invoiceWhere,
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.branch.count({ where: { organizationId, isActive: true } }),
      prisma.warehouse.count({ where: { organizationId, isActive: true } }),
    ]);

    return NextResponse.json({
      totalInvoices,
      pendingInvoices,
      totalCustomers,
      totalProducts,
      totalRevenue: Number(revenueResult._sum.total || 0),
      totalCollected: Number(collectedResult._sum.amountPaid || 0),
      totalBranches,
      totalWarehouses,
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
