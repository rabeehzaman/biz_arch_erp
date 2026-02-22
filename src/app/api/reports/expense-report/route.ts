import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate") || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = searchParams.get("toDate") || new Date().toISOString();

    const expenses = await prisma.expense.findMany({
      where: {
        organizationId,
        // Only include PAID expenses — these are the only ones with journal entries,
        // so only they appear in P&L. PENDING/APPROVED expenses are not yet in the GL.
        status: "PAID",
        expenseDate: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { expenseDate: "desc" },
    });

    // Aggregate by category (account)
    const byCategory = new Map<string, { account: { code: string; name: string }; total: number; count: number }>();

    for (const expense of expenses) {
      for (const item of expense.items) {
        const key = item.accountId;
        const existing = byCategory.get(key) || {
          account: { code: item.account.code, name: item.account.name },
          total: 0,
          count: 0,
        };
        existing.total += Number(item.amount);
        existing.count++;
        byCategory.set(key, existing);
      }
    }

    // Aggregate by supplier
    const bySupplier = new Map<string, { name: string; total: number; count: number }>();

    for (const expense of expenses) {
      const name = expense.supplier?.name || "No Supplier";
      const key = expense.supplier?.id || "none";
      const existing = bySupplier.get(key) || { name, total: 0, count: 0 };
      existing.total += Number(expense.total);
      existing.count++;
      bySupplier.set(key, existing);
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.total), 0);

    return NextResponse.json({
      fromDate,
      toDate,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
      bySupplier: Array.from(bySupplier.values()).sort((a, b) => b.total - a.total),
      totalExpenses,
      expenseCount: expenses.length,
      expenses: expenses.map((e) => ({
        id: e.id,
        expenseNumber: e.expenseNumber,
        status: e.status,
        expenseDate: e.expenseDate,
        description: e.description,
        total: Number(e.total),
        supplier: e.supplier?.name || null,
      })),
    });
  } catch (error) {
    console.error("Failed to generate expense report:", error);
    return NextResponse.json(
      { error: "Failed to generate expense report" },
      { status: 500 }
    );
  }
}
