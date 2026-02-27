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
        const branch = await prisma.branch.findFirst({
            where: { id, organizationId: session.user.organizationId },
            include: {
                warehouses: {
                    include: { _count: { select: { stockLots: true } } },
                    orderBy: { createdAt: "asc" },
                },
                _count: { select: { warehouses: true, invoices: true, purchaseInvoices: true } },
            },
        });

        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        return NextResponse.json(branch);
    } catch (error) {
        console.error("Failed to fetch branch:", error);
        return NextResponse.json({ error: "Failed to fetch branch" }, { status: 500 });
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
        const { name, code, address, city, state, phone, isActive } = body;

        const organizationId = session.user.organizationId;

        // Check existence
        const existing = await prisma.branch.findFirst({
            where: { id, organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        // Check code uniqueness if changing
        if (code && code !== existing.code) {
            const duplicate = await prisma.branch.findFirst({
                where: { organizationId, code, id: { not: id } },
            });
            if (duplicate) {
                return NextResponse.json({ error: "A branch with this code already exists" }, { status: 409 });
            }
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (code !== undefined) updateData.code = code.toUpperCase();
        if (address !== undefined) updateData.address = address || null;
        if (city !== undefined) updateData.city = city || null;
        if (state !== undefined) updateData.state = state || null;
        if (phone !== undefined) updateData.phone = phone || null;
        if (isActive !== undefined) updateData.isActive = isActive;

        const branch = await prisma.branch.update({
            where: { id },
            data: updateData,
            include: {
                _count: { select: { warehouses: true } },
            },
        });

        return NextResponse.json(branch);
    } catch (error) {
        console.error("Failed to update branch:", error);
        return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
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

        // Check for active warehouses or associated documents
        const branch = await prisma.branch.findFirst({
            where: { id, organizationId },
            include: {
                _count: {
                    select: { warehouses: true, invoices: true, purchaseInvoices: true },
                },
            },
        });

        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        if (branch._count.invoices > 0 || branch._count.purchaseInvoices > 0) {
            return NextResponse.json(
                { error: "Cannot delete branch with associated documents. Deactivate it instead." },
                { status: 400 }
            );
        }

        // Delete warehouses first if any (only if they have no associated data)
        if (branch._count.warehouses > 0) {
            const warehousesWithData = await prisma.warehouse.findMany({
                where: { branchId: id },
                include: { _count: { select: { stockLots: true } } },
            });
            const hasData = warehousesWithData.some((w) => w._count.stockLots > 0);
            if (hasData) {
                return NextResponse.json(
                    { error: "Cannot delete branch with warehouses that contain stock. Deactivate it instead." },
                    { status: 400 }
                );
            }
            await prisma.userWarehouseAccess.deleteMany({
                where: { branchId: id },
            });
            await prisma.warehouse.deleteMany({
                where: { branchId: id },
            });
        }

        await prisma.branch.delete({ where: { id } });

        return NextResponse.json({ message: "Branch deleted" });
    } catch (error) {
        console.error("Failed to delete branch:", error);
        return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
    }
}
