import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function POST(
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

        // Update printedAt timestamp
        const kot = await prisma.kOTOrder.update({
            where: { id },
            data: { printedAt: new Date() },
            include: {
                items: true,
                table: true,
            },
        });

        return NextResponse.json(kot);
    } catch (error) {
        console.error("Failed to reprint KOT order:", error);
        return NextResponse.json(
            { error: "Failed to reprint KOT order" },
            { status: 500 }
        );
    }
}
