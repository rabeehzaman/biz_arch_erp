import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const order = await prisma.pOSOpenOrder.findFirst({
      where: { id, organizationId },
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch open order:", error);
    return NextResponse.json(
      { error: "Failed to fetch open order" },
      { status: 500 },
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

    const {
      label, orderType, isReturnMode, items,
      customerId, customerName,
      tableId, tableNumber, tableName, tableSection, tableCapacity,
      heldOrderId, kotSentQuantities, kotOrderIds,
      preBillPrinted,
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
      preBillPrinted: preBillPrinted ?? false,
    };

    // Check if this is a new order (needs server-assigned orderNumber)
    const existing = await prisma.pOSOpenOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, sessionId: true },
    });

    let orderNumber = existing?.orderNumber ?? 0;
    let sessionIdForCreate = existing?.sessionId ?? "";

    if (!existing) {
      // New order — find any open session in the org for counter + assignment
      const posSession = await prisma.pOSSession.findFirst({
        where: { organizationId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });

      if (!posSession) {
        return NextResponse.json(
          { error: "No open POS session found" },
          { status: 400 }
        );
      }

      sessionIdForCreate = posSession.id;

      // Only consume an order number when the order has items or a table
      // Prevents wasting numbers on empty/abandoned tabs
      if (data.items.length > 0 || data.tableId) {
        const updated = await prisma.pOSSession.update({
          where: { id: posSession.id },
          data: { orderCounter: { increment: 1 } },
          select: { orderCounter: true },
        });
        orderNumber = updated.orderCounter;
      }
    }

    const result = await prisma.pOSOpenOrder.upsert({
      where: { id },
      create: {
        id,
        organizationId,
        sessionId: sessionIdForCreate,
        ...data,
        orderNumber,
        version: 0,
      },
      update: {
        ...data,
        version: { increment: 1 },
      },
      select: { id: true, version: true, orderNumber: true },
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
    const { id } = await params;

    const order = await prisma.pOSOpenOrder.findFirst({
      where: { id, organizationId },
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
