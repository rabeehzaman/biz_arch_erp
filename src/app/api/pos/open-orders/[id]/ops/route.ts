import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { applyOperations, dbRecordToState } from "@/lib/pos/apply-operations";
import { publishOrderUpdate } from "@/lib/pos/ably-server";
import type { OrderOperation, MutationResult } from "@/lib/pos/realtime-types";

/**
 * POST /api/pos/open-orders/[id]/ops
 *
 * Apply operations to an order with optimistic locking.
 * Publishes the result to Ably for real-time sync.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" } satisfies MutationResult,
        { status: 401 },
      );
    }

    const organizationId = getOrgId(session);
    const { id: orderId } = await params;
    const body = await request.json();
    const { ops, expectedVersion, deviceId } = body as {
      ops: OrderOperation[];
      expectedVersion: number;
      deviceId?: string;
    };

    if (!Array.isArray(ops) || ops.length === 0) {
      return NextResponse.json(
        { ok: false, reason: "ERROR", message: "No operations provided" } satisfies MutationResult,
        { status: 400 },
      );
    }

    // Read current state — or auto-create if this is a new tab
    let record = await prisma.pOSOpenOrder.findFirst({
      where: { id: orderId, organizationId },
    });

    if (!record) {
      // Order doesn't exist yet (new tab). Create it, then apply ops.
      const userId = session.user.id;
      const posSession = await prisma.pOSSession.findFirst({
        where: { organizationId, userId, status: "OPEN" },
      });

      if (!posSession) {
        return NextResponse.json(
          { ok: false, reason: "ERROR", message: "No open POS session" } satisfies MutationResult,
          { status: 400 },
        );
      }

      record = await prisma.pOSOpenOrder.create({
        data: {
          id: orderId,
          organizationId,
          sessionId: posSession.id,
          label: "Order",
          orderType: "DINE_IN",
          isReturnMode: false,
          items: [],
          kotSentQuantities: {},
          kotOrderIds: [],
          deviceId: deviceId || null,
          version: 0,
        },
      });
    }

    // Optimistic lock check (skip for freshly created orders where expectedVersion is 0)
    if (record.version !== expectedVersion && !(record.version === 0 && expectedVersion === 0)) {
      const result: MutationResult = {
        ok: false,
        reason: "VERSION_CONFLICT",
        currentVersion: record.version,
        currentState: dbRecordToState(record),
      };
      return NextResponse.json(result);
    }

    // Apply operations
    const currentState = dbRecordToState(record);
    const newState = applyOperations(currentState, ops);
    const newVersion = record.version + 1;

    // Write back
    try {
      await prisma.pOSOpenOrder.update({
        where: { id: orderId },
        data: {
          items: newState.items as any,
          label: newState.label,
          orderType: newState.orderType,
          isReturnMode: newState.isReturnMode,
          customerId: newState.customerId,
          customerName: newState.customerName,
          tableId: newState.tableId,
          tableNumber: newState.tableNumber,
          tableName: newState.tableName,
          tableSection: newState.tableSection,
          tableCapacity: newState.tableCapacity,
          heldOrderId: newState.heldOrderId,
          kotSentQuantities: newState.kotSentQuantities,
          kotOrderIds: newState.kotOrderIds,
          deviceId: deviceId || null,
          version: newVersion,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "P2025") {
        return NextResponse.json(
          { ok: false, reason: "NOT_FOUND" } satisfies MutationResult,
          { status: 404 },
        );
      }
      throw err;
    }

    // Broadcast to other devices via Ably
    await publishOrderUpdate(
      organizationId,
      orderId,
      ops,
      newVersion,
      deviceId || "api",
    );

    const result: MutationResult = { ok: true, version: newVersion };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to apply order operations:", error);
    return NextResponse.json(
      { ok: false, reason: "ERROR", message: "Internal server error" } satisfies MutationResult,
      { status: 500 },
    );
  }
}
