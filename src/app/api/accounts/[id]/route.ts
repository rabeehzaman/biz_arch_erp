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

    const account = await prisma.account.findFirst({
      where: { id, organizationId },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true }, orderBy: { code: "asc" } },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("Failed to fetch account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
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
    const { name, description, parentId, isActive } = body;

    const existing = await prisma.account.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // System accounts can only change name, description, isActive
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (!existing.isSystem && parentId !== undefined) {
      updateData.parentId = parentId || null;
    }

    const account = await prisma.account.update({
      where: { id, organizationId },
      data: updateData,
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Failed to update account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
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

    const account = await prisma.account.findFirst({
      where: { id, organizationId },
      include: {
        _count: { select: { children: true, journalEntryLines: true, expenseItems: true } },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.isSystem) {
      return NextResponse.json(
        { error: "System accounts cannot be deleted" },
        { status: 400 }
      );
    }

    if (account._count.children > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with child accounts" },
        { status: 400 }
      );
    }

    if (account._count.journalEntryLines > 0 || account._count.expenseItems > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with transactions" },
        { status: 400 }
      );
    }

    await prisma.account.delete({ where: { id, organizationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
