import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = getOrgId(session);

        const tables = await prisma.restaurantTable.findMany({
            where: { organizationId, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
        });

        return NextResponse.json(tables);
    } catch (error) {
        console.error("Failed to fetch restaurant tables:", error);
        return NextResponse.json(
            { error: "Failed to fetch tables" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (session.user.role !== "admin" && session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const organizationId = getOrgId(session);
        const body = await request.json();
        const { number, name, capacity, floor, section } = body;

        if (!number || !name) {
            return NextResponse.json(
                { error: "Table number and name are required" },
                { status: 400 }
            );
        }

        if (typeof number !== "number" || number < 1) {
            return NextResponse.json(
                { error: "Table number must be a positive integer" },
                { status: 400 }
            );
        }

        if (typeof capacity !== "number" || capacity < 1) {
            return NextResponse.json(
                { error: "Capacity must be a positive integer" },
                { status: 400 }
            );
        }

        // Check uniqueness of table number within org
        const existing = await prisma.restaurantTable.findUnique({
            where: {
                organizationId_number: { organizationId, number },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: `Table number ${number} already exists` },
                { status: 409 }
            );
        }

        // Get max sortOrder to auto-set
        const maxSortOrder = await prisma.restaurantTable.aggregate({
            where: { organizationId },
            _max: { sortOrder: true },
        });

        const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;

        const table = await prisma.restaurantTable.create({
            data: {
                organizationId,
                number,
                name,
                capacity,
                floor: floor || null,
                section: section || null,
                sortOrder: nextSortOrder,
            },
        });

        return NextResponse.json(table, { status: 201 });
    } catch (error) {
        console.error("Failed to create restaurant table:", error);
        return NextResponse.json(
            { error: "Failed to create table" },
            { status: 500 }
        );
    }
}
