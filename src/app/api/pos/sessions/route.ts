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

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId };
    if (status) {
      where.status = status;
    }

    const sessions = await prisma.pOSSession.findMany({
      where,
      orderBy: { openedAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
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
    const { openingCash = 0, branchId, warehouseId } = body;

    // Wrap in transaction to prevent race conditions (duplicate sessions/numbers)
    const posSession = await prisma.$transaction(async (tx) => {
      // Validate branch exists and belongs to org (if provided)
      if (branchId) {
        const branch = await tx.branch.findFirst({
          where: { id: branchId, organizationId },
        });
        if (!branch) {
          throw new Error("INVALID_BRANCH");
        }
      }

      // Validate warehouse exists and belongs to org (if provided)
      if (warehouseId) {
        const warehouse = await tx.warehouse.findFirst({
          where: { id: warehouseId, organizationId },
        });
        if (!warehouse) {
          throw new Error("INVALID_WAREHOUSE");
        }
      }

      // Check if there's already an open session for this branch+warehouse
      const existingOpen = await tx.pOSSession.findFirst({
        where: {
          organizationId,
          status: "OPEN",
          branchId: branchId || null,
          warehouseId: warehouseId || null,
        },
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
          branchId: branchId || null,
          warehouseId: warehouseId || null,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
          warehouse: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    });

    return NextResponse.json(posSession, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BRANCH") {
      return NextResponse.json(
        { error: "Invalid branch selected." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "INVALID_WAREHOUSE") {
      return NextResponse.json(
        { error: "Invalid warehouse selected." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "ALREADY_OPEN") {
      return NextResponse.json(
        { error: "There is already an open POS session for this register. Please close it first or continue selling." },
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
