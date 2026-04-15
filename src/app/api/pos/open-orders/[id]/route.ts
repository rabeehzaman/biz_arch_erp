import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// Recently deleted order IDs — prevents stale in-flight PUTs from resurrecting
// orders after checkout/close.  Entries expire after 30 seconds.
const recentlyDeleted = new Map<string, number>();
function markDeleted(id: string) {
  recentlyDeleted.set(id, Date.now());
  // Prune old entries
  if (recentlyDeleted.size > 200) {
    const cutoff = Date.now() - 30_000;
    for (const [key, ts] of recentlyDeleted) {
      if (ts < cutoff) recentlyDeleted.delete(key);
    }
  }
}
function wasRecentlyDeleted(id: string): boolean {
  const ts = recentlyDeleted.get(id);
  if (!ts) return false;
  if (Date.now() - ts > 30_000) { recentlyDeleted.delete(id); return false; }
  return true;
}

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

    // Check if this order already exists in DB
    const existing = await prisma.pOSOpenOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, sessionId: true },
    });

    if (existing) {
      // Update existing order
      const result = await prisma.pOSOpenOrder.update({
        where: { id },
        data: {
          ...data,
          version: { increment: 1 },
        },
        select: { id: true, version: true, orderNumber: true },
      });
      return NextResponse.json(result);
    }

    // Stale save for an order that was just deleted (checkout/close) — ignore
    if (wasRecentlyDeleted(id)) {
      return NextResponse.json({ id, version: 0, orderNumber: 0 });
    }

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

    // Only consume an order number when the order has items or a table
    // Prevents wasting numbers on empty/abandoned tabs
    let orderNumber = 0;
    if (data.items.length > 0 || data.tableId) {
      const updated = await prisma.pOSSession.update({
        where: { id: posSession.id },
        data: { orderCounter: { increment: 1 } },
        select: { orderCounter: true },
      });
      orderNumber = updated.orderCounter;
    }

    // Use create (not upsert) — if a concurrent DELETE just removed this order,
    // the create will fail with a unique constraint error rather than silently
    // resurrecting the deleted order.
    try {
      const result = await prisma.pOSOpenOrder.create({
        data: {
          id,
          organizationId,
          sessionId: posSession.id,
          ...data,
          orderNumber,
          version: 0,
        },
        select: { id: true, version: true, orderNumber: true },
      });
      return NextResponse.json(result);
    } catch (err: unknown) {
      // If the order was just re-checked-in by a concurrent request, update instead
      if ((err as { code?: string })?.code === "P2002") {
        const result = await prisma.pOSOpenOrder.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
          select: { id: true, version: true, orderNumber: true },
        });
        return NextResponse.json(result);
      }
      throw err;
    }
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
    markDeleted(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete open order:", error);
    return NextResponse.json(
      { error: "Failed to delete open order" },
      { status: 500 }
    );
  }
}
