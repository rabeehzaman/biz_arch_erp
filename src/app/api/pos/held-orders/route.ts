import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;

    // Find the user's open POS session
    const posSession = await prisma.pOSSession.findFirst({
      where: {
        organizationId,
        userId,
        status: "OPEN",
      },
    });

    if (!posSession) {
      return NextResponse.json([]);
    }

    const heldOrders = await prisma.pOSHeldOrder.findMany({
      where: {
        organizationId,
        sessionId: posSession.id,
      },
      orderBy: { heldAt: "desc" },
      include: {
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json(heldOrders);
  } catch (error) {
    console.error("Failed to fetch held orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch held orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    const body = await request.json();
    const { customerId, customerName, items, subtotal, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    if (subtotal === undefined || subtotal === null) {
      return NextResponse.json(
        { error: "Subtotal is required" },
        { status: 400 }
      );
    }

    // Find the user's open POS session
    const posSession = await prisma.pOSSession.findFirst({
      where: {
        organizationId,
        userId,
        status: "OPEN",
      },
    });

    if (!posSession) {
      return NextResponse.json(
        { error: "No open POS session found. Please start a session first." },
        { status: 400 }
      );
    }

    const heldOrder = await prisma.pOSHeldOrder.create({
      data: {
        organizationId,
        sessionId: posSession.id,
        customerId: customerId || null,
        customerName: customerName || null,
        items,
        subtotal,
        notes: notes || null,
      },
      include: {
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json(heldOrder, { status: 201 });
  } catch (error) {
    console.error("Failed to create held order:", error);
    return NextResponse.json(
      { error: "Failed to create held order" },
      { status: 500 }
    );
  }
}
