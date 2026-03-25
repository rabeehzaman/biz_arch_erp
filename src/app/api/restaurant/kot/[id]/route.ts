import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export async function GET(
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

        const kot = await prisma.kOTOrder.findFirst({
            where: { id, organizationId },
            include: {
                items: true,
                table: true,
            },
        });

        if (!kot) {
            return NextResponse.json(
                { error: "KOT order not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(kot);
    } catch (error) {
        console.error("Failed to fetch KOT order:", error);
        return NextResponse.json(
            { error: "Failed to fetch KOT order" },
            { status: 500 }
        );
    }
}

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
        const { status } = body;

        if (!status || !VALID_STATUSES.includes(status)) {
            return NextResponse.json(
                { error: "Invalid status. Must be one of: PENDING, IN_PROGRESS, COMPLETED, CANCELLED" },
                { status: 400 }
            );
        }

        // Verify KOT belongs to org
        const existing = await prisma.kOTOrder.findFirst({
            where: { id, organizationId },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "KOT order not found" },
                { status: 404 }
            );
        }

        const updateData: Record<string, unknown> = { status };

        if (status === "COMPLETED") {
            updateData.completedAt = new Date();
        } else if (status === "CANCELLED") {
            updateData.cancelledAt = new Date();
        }

        const kot = await prisma.kOTOrder.update({
            where: { id },
            data: updateData,
            include: {
                items: true,
                table: true,
            },
        });

        return NextResponse.json(kot);
    } catch (error) {
        console.error("Failed to update KOT order:", error);
        return NextResponse.json(
            { error: "Failed to update KOT order" },
            { status: 500 }
        );
    }
}
