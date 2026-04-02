import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, checkSubscriptionForApi } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);

  const priceLists = await prisma.priceList.findMany({
    where: { organizationId },
    include: {
      _count: { select: { items: true, assignments: true } },
      assignments: {
        include: {
          user: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(priceLists);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const body = await request.json();
  const { name, description, defaultDiscountPercent, isActive } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const priceList = await prisma.priceList.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        defaultDiscountPercent: defaultDiscountPercent ?? 0,
        isActive: isActive ?? true,
        organizationId,
      },
    });
    return NextResponse.json(priceList, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "A price list with this name already exists" }, { status: 409 });
    }
    throw e;
  }
}
