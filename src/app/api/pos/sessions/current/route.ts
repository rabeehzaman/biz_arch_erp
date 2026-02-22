import { NextResponse } from "next/server";
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

    const posSession = await prisma.pOSSession.findFirst({
      where: { organizationId, userId, status: "OPEN" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
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
