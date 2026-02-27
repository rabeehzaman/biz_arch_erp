import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");

        const where: any = { organizationId: session.user.organizationId };
        if (branchId) where.branchId = branchId;

        const warehouses = await prisma.warehouse.findMany({
            where,
            include: {
                branch: { select: { id: true, name: true, code: true } },
                _count: { select: { stockLots: true, posSessions: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(warehouses);
    } catch (error) {
        console.error("Failed to fetch warehouses:", error);
        return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
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
        const { name, code, branchId, address } = body;

        if (!name || !code || !branchId) {
            return NextResponse.json({ error: "Name, code, and branchId are required" }, { status: 400 });
        }

        const organizationId = session.user.organizationId;

        // Verify branch belongs to org
        const branch = await prisma.branch.findFirst({
            where: { id: branchId, organizationId },
        });
        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        // Check code uniqueness
        const existing = await prisma.warehouse.findFirst({
            where: { organizationId, code },
        });
        if (existing) {
            return NextResponse.json({ error: "A warehouse with this code already exists" }, { status: 409 });
        }

        const warehouse = await prisma.warehouse.create({
            data: {
                organizationId,
                branchId,
                name,
                code: code.toUpperCase(),
                address: address || null,
            },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                _count: { select: { stockLots: true } },
            },
        });

        return NextResponse.json(warehouse, { status: 201 });
    } catch (error) {
        console.error("Failed to create warehouse:", error);
        return NextResponse.json({ error: "Failed to create warehouse" }, { status: 500 });
    }
}
