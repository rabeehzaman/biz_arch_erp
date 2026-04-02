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

  const priceList = await prisma.priceList.findFirst({ where: { id, organizationId } });
  if (!priceList) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.priceListItem.findMany({
    where: { priceListId: id },
    include: { product: { select: { id: true, name: true, sku: true, price: true } } },
    orderBy: { product: { name: "asc" } },
  });

  return NextResponse.json(items);
}

export async function POST(
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

  const priceList = await prisma.priceList.findFirst({ where: { id, organizationId } });
  if (!priceList) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  // Bulk add: add all org products with a percentage offset
  if (body.bulk) {
    const existingItems = await prisma.priceListItem.findMany({
      where: { priceListId: id },
      select: { productId: true },
    });
    const existingIds = new Set(existingItems.map((i) => i.productId));

    const products = await prisma.product.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    const newProducts = products.filter((p) => !existingIds.has(p.id));
    if (newProducts.length === 0) {
      return NextResponse.json({ message: "No new products to add", count: 0 });
    }

    await prisma.priceListItem.createMany({
      data: newProducts.map((p) => ({
        priceListId: id,
        productId: p.id,
        overrideType: body.overrideType ?? "PERCENTAGE",
        fixedPrice: body.overrideType === "FIXED" ? body.fixedPrice : null,
        percentOffset: body.overrideType === "FIXED" ? null : (body.percentOffset ?? 0),
      })),
    });

    return NextResponse.json({ message: "Bulk items added", count: newProducts.length }, { status: 201 });
  }

  // Single or array of items
  const items = Array.isArray(body) ? body : [body];

  const created = [];
  for (const item of items) {
    if (!item.productId) continue;
    try {
      const record = await prisma.priceListItem.create({
        data: {
          priceListId: id,
          productId: item.productId,
          overrideType: item.overrideType ?? "FIXED",
          fixedPrice: item.overrideType === "PERCENTAGE" ? null : (item.fixedPrice ?? null),
          percentOffset: item.overrideType === "PERCENTAGE" ? (item.percentOffset ?? 0) : null,
        },
        include: { product: { select: { id: true, name: true, sku: true, price: true } } },
      });
      created.push(record);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        // Duplicate — skip silently
        continue;
      }
      throw e;
    }
  }

  return NextResponse.json(created, { status: 201 });
}
