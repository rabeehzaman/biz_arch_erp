import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { broadcastTableStatus } from "@/lib/pos/broadcast-table-status";

const VALID_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"] as const;

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = getOrgId(session);
        const { id } = await params;
        const body = await request.json();
        const { status, guestCount } = body;

        if (!status || !VALID_STATUSES.includes(status)) {
            return NextResponse.json(
                { error: "Invalid status. Must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING" },
                { status: 400 }
            );
        }

        // Verify table belongs to org
        const existing = await prisma.restaurantTable.findFirst({
            where: { id, organizationId },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "Table not found" },
                { status: 404 }
            );
        }

        const updateData: Record<string, unknown> = { status };

        if (status === "AVAILABLE") {
            // Clear guest count when freeing the table
            updateData.guestCount = null;
            updateData.currentOrderId = null;
        } else if (guestCount !== undefined) {
            updateData.guestCount = guestCount;
        }

        const table = await prisma.restaurantTable.update({
            where: { id },
            data: updateData,
        });

        // Broadcast table status change to all connected POS devices
        broadcastTableStatus(organizationId, id, status as "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING").catch(() => {});

        return NextResponse.json(table);
    } catch (error) {
        console.error("Failed to update table status:", error);
        return NextResponse.json(
            { error: "Failed to update table status" },
            { status: 500 }
        );
    }
}
