import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const access = await prisma.userWarehouseAccess.findMany({
            where: { organizationId: session.user.organizationId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                branch: { select: { id: true, name: true, code: true } },
                warehouse: { select: { id: true, name: true, code: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(access);
    } catch (error) {
        console.error("Failed to fetch user warehouse access:", error);
        return NextResponse.json({ error: "Failed to fetch user warehouse access" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["admin", "superadmin"].includes(session.user.role || "")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { userId, warehouseId, isDefault } = body;

        if (!userId || !warehouseId) {
            return NextResponse.json({ error: "userId and warehouseId are required" }, { status: 400 });
        }

        const organizationId = session.user.organizationId;

        // Verify warehouse belongs to org and get branchId
        const warehouse = await prisma.warehouse.findFirst({
            where: { id: warehouseId, organizationId },
            select: { id: true, branchId: true },
        });
        if (!warehouse) {
            return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
        }

        // Verify user belongs to org
        const user = await prisma.user.findFirst({
            where: { id: userId, organizationId },
        });
        if (!user) {
            return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
        }

        // If setting as default, unset existing default for this user
        if (isDefault) {
            await prisma.userWarehouseAccess.updateMany({
                where: { userId, organizationId, isDefault: true },
                data: { isDefault: false },
            });
        }

        const access = await prisma.userWarehouseAccess.upsert({
            where: { userId_warehouseId: { userId, warehouseId } },
            create: {
                userId,
                branchId: warehouse.branchId,
                warehouseId,
                isDefault: isDefault || false,
                organizationId,
            },
            update: {
                isDefault: isDefault || false,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                branch: { select: { id: true, name: true, code: true } },
                warehouse: { select: { id: true, name: true, code: true } },
            },
        });

        return NextResponse.json(access, { status: 201 });
    } catch (error) {
        console.error("Failed to create user warehouse access:", error);
        return NextResponse.json({ error: "Failed to create user warehouse access" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["admin", "superadmin"].includes(session.user.role || "")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Access ID is required" }, { status: 400 });
        }

        const access = await prisma.userWarehouseAccess.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });

        if (!access) {
            return NextResponse.json({ error: "Access not found" }, { status: 404 });
        }

        await prisma.userWarehouseAccess.delete({ where: { id } });

        return NextResponse.json({ message: "Access removed" });
    } catch (error) {
        console.error("Failed to delete user warehouse access:", error);
        return NextResponse.json({ error: "Failed to delete user warehouse access" }, { status: 500 });
    }
}
