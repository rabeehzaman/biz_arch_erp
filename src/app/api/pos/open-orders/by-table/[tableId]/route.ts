import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { tableId } = await params;

    // Find open orders for this table, then filter out stale empty ones
    const orders = await prisma.pOSOpenOrder.findMany({
      where: {
        organizationId,
        tableId,
        session: { status: "OPEN" },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Only return orders that have items or KOT data — skip abandoned empty orders
    const order = orders.find((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const kotIds = Array.isArray(o.kotOrderIds) ? o.kotOrderIds : [];
      return items.length > 0 || kotIds.length > 0;
    }) || null;

    return NextResponse.json({ order: order || null });
  } catch (error) {
    console.error("Failed to lookup order by table:", error);
    return NextResponse.json(
      { error: "Failed to lookup order by table" },
      { status: 500 }
    );
  }
}
