import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const branches = await prisma.branch.findMany({
            where: { organizationId: session.user.organizationId },
            include: {
                _count: { select: { warehouses: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(branches);
    } catch (error) {
        console.error("Failed to fetch branches:", error);
        return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
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
        const { name, code, address, city, state, phone } = body;

        if (!name || !code) {
            return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
        }

        const organizationId = session.user.organizationId;
        const normalizedCode = code.toUpperCase();

        // Check code uniqueness (compare uppercase to catch case variants)
        const existing = await prisma.branch.findFirst({
            where: { organizationId, code: normalizedCode },
        });
        if (existing) {
            return NextResponse.json({ error: "A branch with this code already exists" }, { status: 409 });
        }

        const branch = await prisma.branch.create({
            data: {
                organizationId,
                name,
                code: normalizedCode,
                address: address || null,
                city: city || null,
                state: state || null,
                phone: phone || null,
            },
            include: {
                _count: { select: { warehouses: true } },
            },
        });

        return NextResponse.json(branch, { status: 201 });
    } catch (error) {
        console.error("Failed to create branch:", error);
        return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
    }
}
