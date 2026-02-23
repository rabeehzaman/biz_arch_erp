import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

// Generate session number inside a transaction: POS-YYYYMMDD-XXX
async function generateSessionNumber(organizationId: string, tx: Tx) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `POS-${dateStr}`;

  const lastSession = await tx.pOSSession.findFirst({
    where: { sessionNumber: { startsWith: prefix }, organizationId },
    orderBy: { sessionNumber: "desc" },
  });

  let sequence = 1;
  if (lastSession) {
    const lastSequence = parseInt(lastSession.sessionNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const sessions = await prisma.pOSSession.findMany({
      where: { organizationId },
      orderBy: { openedAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { invoices: true, heldOrders: true },
        },
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to fetch POS sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS sessions" },
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
    if (!userId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    const body = await request.json();
    const { openingCash = 0 } = body;

    // Wrap in transaction to prevent race conditions (duplicate sessions/numbers)
    const posSession = await prisma.$transaction(async (tx) => {
      // Check if user already has an open session
      const existingOpen = await tx.pOSSession.findFirst({
        where: { organizationId, userId, status: "OPEN" },
      });

      if (existingOpen) {
        throw new Error("ALREADY_OPEN");
      }

      const sessionNumber = await generateSessionNumber(organizationId, tx);

      return tx.pOSSession.create({
        data: {
          organizationId,
          sessionNumber,
          userId,
          status: "OPEN",
          openingCash,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    return NextResponse.json(posSession, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_OPEN") {
      return NextResponse.json(
        { error: "You already have an open POS session. Please close it before opening a new one." },
        { status: 400 }
      );
    }
    console.error("Failed to create POS session:", error);
    return NextResponse.json(
      { error: "Failed to create POS session" },
      { status: 500 }
    );
  }
}
