import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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

        const table = await prisma.restaurantTable.findFirst({
            where: { id, organizationId },
        });

        if (!table) {
            return NextResponse.json(
                { error: "Table not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(table);
    } catch (error) {
        console.error("Failed to fetch restaurant table:", error);
        return NextResponse.json(
            { error: "Failed to fetch table" },
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
        if (session.user.role !== "admin" && session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const organizationId = getOrgId(session);
        const { id } = await params;
        const body = await request.json();
        const { name, capacity, floor, section, isActive, sortOrder } = body;

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

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (capacity !== undefined) updateData.capacity = capacity;
        if (floor !== undefined) updateData.floor = floor || null;
        if (section !== undefined) updateData.section = section || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

        const table = await prisma.restaurantTable.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(table);
    } catch (error) {
        console.error("Failed to update restaurant table:", error);
        return NextResponse.json(
            { error: "Failed to update table" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (session.user.role !== "admin" && session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const organizationId = getOrgId(session);
        const { id } = await params;

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

        // Soft delete
        await prisma.restaurantTable.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete restaurant table:", error);
        return NextResponse.json(
            { error: "Failed to delete table" },
            { status: 500 }
        );
    }
}
