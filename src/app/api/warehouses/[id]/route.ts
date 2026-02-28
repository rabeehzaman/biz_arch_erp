import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const warehouse = await prisma.warehouse.findFirst({
            where: { id, organizationId: session.user.organizationId },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                _count: { select: { stockLots: true, invoices: true, purchaseInvoices: true, posSessions: true } },
            },
        });

        if (!warehouse) {
            return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
        }

        return NextResponse.json(warehouse);
    } catch (error) {
        console.error("Failed to fetch warehouse:", error);
        return NextResponse.json({ error: "Failed to fetch warehouse" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["admin", "superadmin"].includes(session.user.role || "")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, code, branchId, address, isActive } = body;

        const organizationId = session.user.organizationId;

        const existing = await prisma.warehouse.findFirst({
            where: { id, organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
        }

        // If changing branch, verify it belongs to org
        if (branchId && branchId !== existing.branchId) {
            const branch = await prisma.branch.findFirst({
                where: { id: branchId, organizationId },
            });
            if (!branch) {
                return NextResponse.json({ error: "Branch not found" }, { status: 404 });
            }
        }

        // Check code uniqueness if changing (normalize to uppercase before comparing)
        if (code && code.toUpperCase() !== existing.code) {
            const duplicate = await prisma.warehouse.findFirst({
                where: { organizationId, code: code.toUpperCase(), id: { not: id } },
            });
            if (duplicate) {
                return NextResponse.json({ error: "A warehouse with this code already exists" }, { status: 409 });
            }
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (code !== undefined) updateData.code = code.toUpperCase();
        if (branchId !== undefined) updateData.branchId = branchId;
        if (address !== undefined) updateData.address = address || null;
        if (isActive !== undefined) updateData.isActive = isActive;

        const warehouse = await prisma.warehouse.update({
            where: { id },
            data: updateData,
            include: {
                branch: { select: { id: true, name: true, code: true } },
                _count: { select: { stockLots: true } },
            },
        });

        return NextResponse.json(warehouse);
    } catch (error) {
        console.error("Failed to update warehouse:", error);
        return NextResponse.json({ error: "Failed to update warehouse" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["admin", "superadmin"].includes(session.user.role || "")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const organizationId = session.user.organizationId;

        const warehouse = await prisma.warehouse.findFirst({
            where: { id, organizationId },
            include: {
                _count: { select: { stockLots: true, invoices: true, purchaseInvoices: true } },
            },
        });

        if (!warehouse) {
            return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
        }

        if (warehouse._count.stockLots > 0 || warehouse._count.invoices > 0 || warehouse._count.purchaseInvoices > 0) {
            return NextResponse.json(
                { error: "Cannot delete warehouse with associated data. Deactivate it instead." },
                { status: 400 }
            );
        }

        // Remove user access entries first
        await prisma.userWarehouseAccess.deleteMany({
            where: { warehouseId: id },
        });

        await prisma.warehouse.delete({ where: { id } });

        return NextResponse.json({ message: "Warehouse deleted" });
    } catch (error) {
        console.error("Failed to delete warehouse:", error);
        return NextResponse.json({ error: "Failed to delete warehouse" }, { status: 500 });
    }
}
