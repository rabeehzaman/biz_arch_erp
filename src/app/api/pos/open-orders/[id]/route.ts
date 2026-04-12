import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { posEventBus } from "@/lib/pos-event-bus";
import { publishOrderDeleted, publishOrderUpdate } from "@/lib/pos/ably-server";
import { getIO } from "@/lib/pos/socket-io-server";

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
      preBillPrinted, broadcast, deviceId,
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

    // When Socket.IO is active (deviceId present), don't increment version on
    // HTTP persist — Socket.IO order:mutate owns the version counter.
    // This prevents version conflicts between the two write paths.
    const shouldIncrementVersion = !deviceId;

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
        ...(shouldIncrementVersion ? { version: { increment: 1 } } : {}),
      },
      select: { id: true, version: true, orderNumber: true },
    });

    // Notify other POS devices via SSE (legacy — tab list refresh)
    posEventBus.emit(organizationId, JSON.stringify({ type: "order-updated", id: result.id }));

    // Socket.IO: broadcast order:created when a new order is first persisted
    // so other devices see it immediately (not waiting for 30s SWR poll)
    if (!existing) {
      const io = getIO();
      if (io) {
        io.to(`org:${organizationId}`).emit("order:created", {
          orderId: result.id,
          deviceId: deviceId || "api",
        });
      }
    }

    // Broadcast via Ably only on KOT saves (broadcast: true), not draft saves
    if (broadcast) {
      await publishOrderUpdate(organizationId, result.id, [], result.version, deviceId || "api", {
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
        preBillPrinted: data.preBillPrinted,
      });
    }

    // Socket.IO broadcast on KOT saves (broadcast: true) — uses server.mjs rooms
    // which properly exclude the sender via socket.to(room).emit()
    if (broadcast) {
      const io = getIO();
      if (io) {
        const senderDeviceId = deviceId || "api";
        const state = {
          items: data.items, label: data.label, orderType: data.orderType,
          isReturnMode: data.isReturnMode, customerId: data.customerId,
          customerName: data.customerName, tableId: data.tableId,
          tableNumber: data.tableNumber, tableName: data.tableName,
          tableSection: data.tableSection, tableCapacity: data.tableCapacity,
          heldOrderId: data.heldOrderId, kotSentQuantities: data.kotSentQuantities,
          kotOrderIds: data.kotOrderIds, preBillPrinted: data.preBillPrinted,
        };
        const orderRoom = `org:${organizationId}:order:${result.id}`;
        io.to(orderRoom).emit("order:updated", {
          orderId: result.id, ops: [], version: result.version,
          deviceId: senderDeviceId, state,
        });
        io.to(`org:${organizationId}`).emit("order:updated", {
          orderId: result.id, ops: [], version: result.version,
          deviceId: senderDeviceId,
        });
      }
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
    const { id } = await params;

    const order = await prisma.pOSOpenOrder.findFirst({
      where: { id, organizationId },
    });

    if (!order) {
      return NextResponse.json({ success: true }); // idempotent
    }

    await prisma.pOSOpenOrder.delete({ where: { id } });

    // Notify other POS devices via SSE (legacy) and Ably
    posEventBus.emit(organizationId, JSON.stringify({ type: "order-deleted", id }));
    await publishOrderDeleted(organizationId, id, "api");

    // Socket.IO broadcast
    const io = getIO();
    if (io) {
      const orderRoom = `org:${organizationId}:order:${id}`;
      io.to(orderRoom).emit("order:deleted", { orderId: id, deviceId: "api" });
      io.to(`org:${organizationId}`).emit("order:deleted", { orderId: id, deviceId: "api" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete open order:", error);
    return NextResponse.json(
      { error: "Failed to delete open order" },
      { status: 500 }
    );
  }
}
