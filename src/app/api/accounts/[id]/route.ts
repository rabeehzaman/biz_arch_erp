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

    // System accounts cannot be deactivated
    if (existing.isSystem && isActive === false) {
      return NextResponse.json(
        { error: "System accounts cannot be deactivated" },
        { status: 400 }
      );
    }

    // Validate parentId if provided
    if (!existing.isSystem && parentId !== undefined && parentId) {
      // Verify parent belongs to same org
      const parentAccount = await prisma.account.findFirst({
        where: { id: parentId, organizationId },
      });
      if (!parentAccount) {
        return NextResponse.json(
          { error: "Parent account not found in this organization" },
          { status: 400 }
        );
      }
      // Verify parent has same accountType
      if (parentAccount.accountType !== existing.accountType) {
        return NextResponse.json(
          { error: `Parent account type (${parentAccount.accountType}) must match this account's type (${existing.accountType})` },
          { status: 400 }
        );
      }
      // Check for circular reference: walk up the parent chain from parentId
      let currentParentId: string | null = parentId;
      const visited = new Set<string>();
      while (currentParentId) {
        if (currentParentId === id) {
          return NextResponse.json(
            { error: "Cannot set parent: this would create a circular reference" },
            { status: 400 }
          );
        }
        if (visited.has(currentParentId)) break; // safety: avoid infinite loop
        visited.add(currentParentId);
        const parent = await prisma.account.findFirst({
          where: { id: currentParentId, organizationId },
          select: { parentId: true },
        });
        currentParentId = parent?.parentId || null;
      }
    }

    // System accounts can only change name, description
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined && !existing.isSystem) updateData.isActive = isActive;
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
