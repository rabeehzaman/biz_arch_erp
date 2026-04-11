import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// GET /api/custom-views?module=invoices
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId(session);
  const userId = session.user.id!;
  const module = new URL(request.url).searchParams.get("module");

  if (!module) {
    return NextResponse.json({ error: "module is required" }, { status: 400 });
  }

  const views = await prisma.customView.findMany({
    where: { organizationId: orgId, userId, module },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(views);
}

// POST /api/custom-views
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId(session);
  const userId = session.user.id!;
  const body = await request.json();
  const { name, module, filters, sortField, sortDirection, isDefault } = body;

  if (!name || !module) {
    return NextResponse.json({ error: "name and module are required" }, { status: 400 });
  }

  // If setting as default, unset any existing default for this module
  if (isDefault) {
    await prisma.customView.updateMany({
      where: { organizationId: orgId, userId, module, isDefault: true },
      data: { isDefault: false },
    });
  }

  const view = await prisma.customView.create({
    data: {
      name,
      module,
      filters: filters || {},
      sortField: sortField || null,
      sortDirection: sortDirection || null,
      isDefault: isDefault || false,
      userId,
      organizationId: orgId,
    },
  });

  return NextResponse.json(view, { status: 201 });
}
