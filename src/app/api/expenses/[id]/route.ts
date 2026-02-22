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

    const expense = await prisma.expense.findFirst({
      where: { id, organizationId },
      include: {
        supplier: { select: { id: true, name: true } },
        cashBankAccount: { select: { id: true, name: true } },
        journalEntry: {
          include: {
            lines: {
              include: { account: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to fetch expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();

    const existing = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft expenses can be edited" },
        { status: 400 }
      );
    }

    const { supplierId, expenseDate, description, items, taxRate, notes } = body;

    const subtotal = items
      ? items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0)
      : Number(existing.subtotal);
    const rate = taxRate !== undefined ? taxRate : Number(existing.taxRate);
    const taxAmount = (subtotal * rate) / 100;
    const total = subtotal + taxAmount;

    const expense = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      }

      return tx.expense.update({
        where: { id, organizationId },
        data: {
          ...(supplierId !== undefined && { supplierId: supplierId || null }),
          ...(expenseDate && { expenseDate: new Date(expenseDate) }),
          ...(description !== undefined && { description }),
          ...(notes !== undefined && { notes }),
          subtotal,
          taxRate: rate,
          taxAmount,
          total,
          ...(items && {
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
          }),
        },
        include: {
          items: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      });
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to update expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existing = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft expenses can be deleted" },
        { status: 400 }
      );
    }

    await prisma.expense.delete({ where: { id, organizationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
