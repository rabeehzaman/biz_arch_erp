import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateAutoNumber } from "@/lib/accounting/auto-number";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const expenses = await prisma.expense.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        cashBankAccount: { select: { id: true, name: true } },
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { supplierId, expenseDate, description, items, taxRate, notes } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one expense item is required" },
        { status: 400 }
      );
    }

    const expenseNumber = await generateAutoNumber(
      prisma.expense as never,
      "expenseNumber",
      "EXP",
      organizationId
    );

    const subtotal = items.reduce(
      (sum: number, item: { amount: number }) => sum + item.amount,
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        supplierId: supplierId || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        description: description || null,
        subtotal,
        taxRate: taxRate || 0,
        taxAmount,
        total,
        notes: notes || null,
        organizationId,
        items: {
          create: items.map(
            (item: { accountId: string; description: string; amount: number }) => ({
              accountId: item.accountId,
              description: item.description,
              amount: item.amount,
              organizationId,
            })
          ),
        },
      },
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
        supplier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
