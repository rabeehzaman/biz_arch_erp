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
    });

    if (!posSession) {
      return NextResponse.json([]);
    }

    const openOrders = await prisma.pOSOpenOrder.findMany({
      where: { organizationId, sessionId: posSession.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(openOrders);
  } catch (error) {
    console.error("Failed to fetch open orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch open orders" },
      { status: 500 }
    );
  }
}
