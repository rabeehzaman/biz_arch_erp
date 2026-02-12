import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

/**
 * GET /api/reports/cost-audit
 *
 * Query parameters:
 * - productId: Filter by specific product (optional)
 * - startDate: Filter changes from this date onwards (optional)
 * - endDate: Filter changes up to this date (optional)
 * - limit: Number of records to return (default: 100)
 * - offset: Number of records to skip (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    // Only admins can view cost audit logs
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build filter conditions
    const where: any = { organizationId };

    if (productId) {
      where.productId = productId;
    }

    if (startDate || endDate) {
      where.changedAt = {};
      if (startDate) {
        where.changedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.changedAt.lte = new Date(endDate);
      }
    }

    // Get audit logs with related data
    const auditLogs = await prisma.costAuditLog.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
        invoiceItem: {
          include: {
            invoice: {
              select: { invoiceNumber: true, issueDate: true },
            },
          },
        },
      },
      orderBy: { changedAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.costAuditLog.count({ where });

    // Calculate summary statistics
    const summary = await prisma.costAuditLog.aggregate({
      where,
      _sum: {
        changeAmount: true,
      },
      _count: true,
    });

    return NextResponse.json({
      logs: auditLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        totalChanges: summary._count,
        totalChangeAmount: summary._sum.changeAmount || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch cost audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost audit logs" },
      { status: 500 }
    );
  }
}
