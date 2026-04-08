import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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
    const userId = session.user.id;
    const { id } = await params;

    // Find the caller's open POS session
    const posSession = await prisma.pOSSession.findFirst({
      where: { organizationId, userId, status: "OPEN" },
    });

    if (!posSession) {
      return NextResponse.json(
        { error: "No open POS session found" },
        { status: 400 }
      );
    }

    // Find the order to adopt
    const order = await prisma.pOSOpenOrder.findFirst({
      where: { id, organizationId },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Already belongs to this session — nothing to do
    if (order.sessionId === posSession.id) {
      return NextResponse.json(order);
    }

    // Transfer the order to the caller's session
    const updated = await prisma.pOSOpenOrder.update({
      where: { id },
      data: {
        sessionId: posSession.id,
        version: { increment: 1 },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to adopt open order:", error);
    return NextResponse.json(
      { error: "Failed to adopt open order" },
      { status: 500 }
    );
  }
}
