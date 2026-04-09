import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

/**
 * POST /api/pos/open-orders/[id]/adopt
 *
 * Previously transferred sessionId (ownership) from one device to another.
 * Now returns the order state without transferring ownership — multi-device
 * collaboration is handled via Socket.IO rooms instead.
 *
 * Kept as a read-only endpoint for backward compatibility with older clients.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    // Find the order (no ownership transfer needed)
    const order = await prisma.pOSOpenOrder.findFirst({
      where: { id, organizationId },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to read open order for adopt:", error);
    return NextResponse.json(
      { error: "Failed to read open order" },
      { status: 500 }
    );
  }
}
