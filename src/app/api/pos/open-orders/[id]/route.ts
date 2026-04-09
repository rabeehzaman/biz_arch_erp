import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { posEventBus } from "@/lib/pos-event-bus";
import { publishOrderDeleted, publishOrderUpdate } from "@/lib/pos/ably-server";

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
      broadcast,
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

    // Check if this is a new order (needs server-assigned orderNumber)
    const existing = await prisma.pOSOpenOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true },
    });

    let orderNumber = existing?.orderNumber ?? 0;

    if (!existing) {
      // Atomically increment session counter and assign order number
      const updated = await prisma.pOSSession.update({
        where: { id: posSession.id },
        data: { orderCounter: { increment: 1 } },
        select: { orderCounter: true },
      });
      orderNumber = updated.orderCounter;
    }

    const result = await prisma.pOSOpenOrder.upsert({
      where: { id },
      create: {
        id,
        organizationId,
        sessionId: posSession.id,
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

    // Notify other POS devices via SSE (legacy — tab list refresh)
    posEventBus.emit(organizationId, JSON.stringify({ type: "order-updated", id: result.id }));

    // Broadcast via Ably only on KOT saves (broadcast: true), not draft saves
    if (broadcast) {
      await publishOrderUpdate(organizationId, result.id, [], result.version, "api", {
        items: data.items,
        label: data.label,
        orderType: data.orderType,
        isReturnMode: data.isReturnMode,
        customerId: data.customerId,
        customerName: data.customerName,
        tableId: data.tableId,
        tableNumber: data.tableNumber,
        tableName: data.tableName,
        tableSection: data.tableSection,
        tableCapacity: data.tableCapacity,
        heldOrderId: data.heldOrderId,
        kotSentQuantities: data.kotSentQuantities,
        kotOrderIds: data.kotOrderIds,
      });
    }

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

    // Notify other POS devices via SSE (legacy) and Ably
    posEventBus.emit(organizationId, JSON.stringify({ type: "order-deleted", id }));
    await publishOrderDeleted(organizationId, id, "api");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete open order:", error);
    return NextResponse.json(
      { error: "Failed to delete open order" },
      { status: 500 }
    );
  }
}
