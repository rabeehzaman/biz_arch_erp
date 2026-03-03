import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recalculateFromDate } from "@/lib/inventory/fifo";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;

        const org = await prisma.organization.findUnique({
            where: { id },
        });

        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // Get all products for the org
        const products = await prisma.product.findMany({
            where: { organizationId: id },
            select: { id: true },
        });

        let totalRecalculated = 0;

        for (const product of products) {
            await prisma.$transaction(async (tx) => {
                await recalculateFromDate(
                    product.id,
                    new Date(0), // Calculate from the beginning of time
                    tx,
                    "superadmin_forced_recalculation",
                    session.user?.id,
                    id
                );
            }, { timeout: 30000 });
            totalRecalculated++;
        }

        return NextResponse.json({
            message: "FIFO Recalculation complete",
            productsProcessed: totalRecalculated
        });
    } catch (error) {
        console.error("Failed to recalculate FIFO:", error);
        return NextResponse.json(
            { error: "Failed to recalculate FIFO. Please check server logs." },
            { status: 500 }
        );
    }
}
