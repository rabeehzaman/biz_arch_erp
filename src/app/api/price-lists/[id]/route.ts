import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, checkSubscriptionForApi } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import prisma from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const { id } = await params;

  const priceList = await prisma.priceList.findFirst({
    where: { id, organizationId },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true, price: true } } },
        orderBy: { product: { name: "asc" } },
      },
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!priceList) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(priceList);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.priceList.findFirst({ where: { id, organizationId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.defaultDiscountPercent !== undefined) data.defaultDiscountPercent = body.defaultDiscountPercent;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  try {
    const updated = await prisma.priceList.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "A price list with this name already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const { id } = await params;

  const existing = await prisma.priceList.findFirst({ where: { id, organizationId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.priceList.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
