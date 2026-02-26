import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const { id } = resolvedParams;

        const json = await req.json();
        const { conversionFactor } = json;

        if (!conversionFactor || Number(conversionFactor) <= 0) {
            return NextResponse.json(
                { error: "Valid conversion factor is required" },
                { status: 400 }
            );
        }

        // Verify it exists and belongs to organization
        const existing = await prisma.unitConversion.findUnique({
            where: { id },
        });

        if (!existing || existing.organizationId !== session.user.organizationId) {
            return NextResponse.json(
                { error: "Unit conversion not found" },
                { status: 404 }
            );
        }

        const conversion = await prisma.unitConversion.update({
            where: { id },
            data: {
                conversionFactor: new Decimal(conversionFactor),
            },
            include: {
                fromUnit: true,
                toUnit: true,
            }
        });

        return NextResponse.json(conversion);
    } catch (error) {
        console.error("Failed to update unit conversion:", error);
        return NextResponse.json(
            { error: "Failed to update unit conversion" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const { id } = resolvedParams;

        // Verify it exists and belongs to organization
        const existing = await prisma.unitConversion.findUnique({
            where: { id },
        });

        if (!existing || existing.organizationId !== session.user.organizationId) {
            return NextResponse.json(
                { error: "Unit conversion not found" },
                { status: 404 }
            );
        }

        await prisma.unitConversion.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete unit conversion:", error);
        return NextResponse.json(
            { error: "Failed to delete unit conversion" },
            { status: 500 }
        );
    }
}
