import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, checkSubscriptionForApi } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import prisma from "@/lib/prisma";

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
  if (!priceList) return NextResponse.json({ error: "Price list not found" }, { status: 404 });

  const body = await request.json();
  const { userId, customerId } = body;

  if (!userId && !customerId) {
    return NextResponse.json({ error: "userId or customerId is required" }, { status: 400 });
  }

  // Upsert: replace any existing assignment for this user/customer
  if (userId) {
    const existing = await prisma.priceListAssignment.findUnique({ where: { userId } });
    if (existing) {
      await prisma.priceListAssignment.update({
        where: { userId },
        data: { priceListId: id },
      });
    } else {
      await prisma.priceListAssignment.create({
        data: { priceListId: id, userId, organizationId },
      });
    }
    return NextResponse.json({ success: true, type: "user", userId });
  }

  if (customerId) {
    const existing = await prisma.priceListAssignment.findUnique({ where: { customerId } });
    if (existing) {
      await prisma.priceListAssignment.update({
        where: { customerId },
        data: { priceListId: id },
      });
    } else {
      await prisma.priceListAssignment.create({
        data: { priceListId: id, customerId, organizationId },
      });
    }
    return NextResponse.json({ success: true, type: "customer", customerId });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(
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
  const { userId, customerId } = body;

  if (userId) {
    await prisma.priceListAssignment.deleteMany({ where: { userId, priceListId: id } });
  } else if (customerId) {
    await prisma.priceListAssignment.deleteMany({ where: { customerId, priceListId: id } });
  }

  return NextResponse.json({ success: true });
}
