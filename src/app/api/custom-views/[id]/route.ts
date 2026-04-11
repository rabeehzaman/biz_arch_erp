import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// PUT /api/custom-views/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId(session);
  const userId = session.user.id!;
  const { id } = await params;
  const body = await request.json();
  const { name, filters, sortField, sortDirection, isDefault } = body;

  // Verify ownership
  const existing = await prisma.customView.findFirst({
    where: { id, organizationId: orgId, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "View not found" }, { status: 404 });
  }

  // If setting as default, unset any existing default for this module
  if (isDefault) {
    await prisma.customView.updateMany({
      where: { organizationId: orgId, userId, module: existing.module, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const view = await prisma.customView.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(filters !== undefined && { filters }),
      ...(sortField !== undefined && { sortField }),
      ...(sortDirection !== undefined && { sortDirection }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });

  return NextResponse.json(view);
}

// DELETE /api/custom-views/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId(session);
  const userId = session.user.id!;
  const { id } = await params;

  // Verify ownership
  const existing = await prisma.customView.findFirst({
    where: { id, organizationId: orgId, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "View not found" }, { status: 404 });
  }

  await prisma.customView.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
