import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any;

    if (sessionId) {
      // Look up specific session by ID (must be OPEN + org match)
      where = { id: sessionId, organizationId, status: "OPEN" };
    } else {
      // Fall back to finding by userId
      where = { organizationId, userId, status: "OPEN" };
    }

    const posSession = await prisma.pOSSession.findFirst({
      where,
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

    if (!posSession) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session: posSession });
  } catch (error) {
    console.error("Failed to fetch current POS session:", error);
    return NextResponse.json(
      { error: "Failed to fetch current POS session" },
      { status: 500 }
    );
  }
}
