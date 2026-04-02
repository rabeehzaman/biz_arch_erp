import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, checkSubscriptionForApi } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const { id, itemId } = await params;

  // Verify price list belongs to org
  const priceList = await prisma.priceList.findFirst({ where: { id, organizationId } });
  if (!priceList) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.overrideType !== undefined) {
    data.overrideType = body.overrideType;
    if (body.overrideType === "FIXED") {
      data.fixedPrice = body.fixedPrice ?? null;
      data.percentOffset = null;
    } else {
      data.percentOffset = body.percentOffset ?? 0;
      data.fixedPrice = null;
    }
  } else {
    if (body.fixedPrice !== undefined) data.fixedPrice = body.fixedPrice;
    if (body.percentOffset !== undefined) data.percentOffset = body.percentOffset;
  }

  const updated = await prisma.priceListItem.update({
    where: { id: itemId },
    data,
    include: { product: { select: { id: true, name: true, sku: true, price: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const { id, itemId } = await params;

  const priceList = await prisma.priceList.findFirst({ where: { id, organizationId } });
  if (!priceList) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.priceListItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
