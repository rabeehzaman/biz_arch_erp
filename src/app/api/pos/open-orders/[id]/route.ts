import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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
    const userId = session.user.id;
    const { id } = await params;
    const body = await request.json();

    const posSession = await prisma.pOSSession.findFirst({
      where: { organizationId, userId, status: "OPEN" },
    });

    if (!posSession) {
      return NextResponse.json(
        { error: "No open POS session found" },
        { status: 400 }
      );
    }

    const {
      label, orderType, isReturnMode, items,
      customerId, customerName,
      tableId, tableNumber, tableName, tableSection, tableCapacity,
      heldOrderId, kotSentQuantities, kotOrderIds,
    } = body;

    const data = {
      label: label || "Order",
      orderType: orderType || "DINE_IN",
      isReturnMode: isReturnMode || false,
      items: items ?? [],
      customerId: customerId || null,
      customerName: customerName || null,
      tableId: tableId || null,
      tableNumber: tableNumber ?? null,
      tableName: tableName || null,
      tableSection: tableSection || null,
      tableCapacity: tableCapacity ?? null,
      heldOrderId: heldOrderId || null,
      kotSentQuantities: kotSentQuantities ?? {},
      kotOrderIds: kotOrderIds ?? [],
    };

    const result = await prisma.pOSOpenOrder.upsert({
      where: { id },
      create: {
        id,
        organizationId,
        sessionId: posSession.id,
        ...data,
        version: 0,
      },
      update: {
        ...data,
        version: { increment: 1 },
      },
      select: { id: true, version: true },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to save open order:", error);
    return NextResponse.json(
      { error: "Failed to save open order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    const { id } = await params;

    const posSession = await prisma.pOSSession.findFirst({
      where: { organizationId, userId, status: "OPEN" },
    });

    const order = await prisma.pOSOpenOrder.findFirst({
      where: {
        id,
        organizationId,
        ...(posSession ? { sessionId: posSession.id } : {}),
      },
    });

    if (!order) {
      return NextResponse.json({ success: true }); // idempotent
    }

    await prisma.pOSOpenOrder.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete open order:", error);
    return NextResponse.json(
      { error: "Failed to delete open order" },
      { status: 500 }
    );
  }
}
