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

    const account = await prisma.cashBankAccount.findFirst({
      where: { id, organizationId },
      include: {
        account: { select: { id: true, code: true, name: true } },
        transactions: {
          orderBy: { transactionDate: "desc" },
          take: 100,
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("Failed to fetch cash/bank account:", error);
    return NextResponse.json(
      { error: "Failed to fetch cash/bank account" },
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
    const { name, bankName, accountNumber, isDefault, isActive } = body;

    const existing = await prisma.cashBankAccount.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (isActive !== undefined) updateData.isActive = isActive;

    const account = await prisma.cashBankAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Failed to update cash/bank account:", error);
    return NextResponse.json(
      { error: "Failed to update cash/bank account" },
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

    const account = await prisma.cashBankAccount.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { transactions: true } } },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account._count.transactions > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with transactions" },
        { status: 400 }
      );
    }

    await prisma.cashBankAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete cash/bank account:", error);
    return NextResponse.json(
      { error: "Failed to delete cash/bank account" },
      { status: 500 }
    );
  }
}
