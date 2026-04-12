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

    const openOrders = await prisma.pOSOpenOrder.findMany({
      where: { organizationId, session: { status: "OPEN" } },
      orderBy: { createdAt: "asc" },
    });

    // Filter out stale empty orders — no items, no KOT, AND no table assigned.
    // Orders with a table but no items yet are valid (just selected, about to add items).
    const activeOrders = openOrders.filter((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const kotIds = Array.isArray(o.kotOrderIds) ? o.kotOrderIds : [];
      return items.length > 0 || kotIds.length > 0 || !!o.tableId;
    });

    // Clean up truly stale orders: no items, no KOT, no table
    const staleOrders = openOrders.filter((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const kotIds = Array.isArray(o.kotOrderIds) ? o.kotOrderIds : [];
      return items.length === 0 && kotIds.length === 0 && !o.tableId;
    });
    if (staleOrders.length > 0) {
      const staleIds = staleOrders.map((o) => o.id);
      const staleTableIds = staleOrders.filter((o) => o.tableId).map((o) => o.tableId!);
      // Delete stale orders and free their tables
      prisma.pOSOpenOrder.deleteMany({ where: { id: { in: staleIds } } })
        .then(() => {
          if (staleTableIds.length > 0) {
            return prisma.restaurantTable.updateMany({
              where: { id: { in: staleTableIds }, organizationId, status: "OCCUPIED" },
              data: { status: "AVAILABLE", guestCount: null, currentOrderId: null },
            });
          }
        })
        .catch(() => {}); // fire-and-forget cleanup
    }

    return NextResponse.json(activeOrders);
  } catch (error) {
    console.error("Failed to fetch open orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch open orders" },
      { status: 500 }
    );
  }
}
