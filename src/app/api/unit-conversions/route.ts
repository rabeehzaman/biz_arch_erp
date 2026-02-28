import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

export async function GET(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const toUnitId = searchParams.get("toUnitId");

        const where: any = {
            organizationId: session.user.organizationId,
        };

        if (toUnitId) {
            where.toUnitId = toUnitId;
        }

        const conversions = await prisma.unitConversion.findMany({
            where,
            include: {
                fromUnit: true,
                toUnit: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json(conversions);
    } catch (error) {
        console.error("Failed to fetch unit conversions:", error);
        return NextResponse.json(
            { error: "Failed to fetch unit conversions" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await req.json();
        const { fromUnitId, toUnitId, conversionFactor } = json;

        if (!fromUnitId || !toUnitId || conversionFactor === undefined || conversionFactor === null || conversionFactor === "") {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (fromUnitId === toUnitId) {
            return NextResponse.json(
                { error: "From and To units must be different" },
                { status: 400 }
            );
        }

        if (Number(conversionFactor) <= 0) {
            return NextResponse.json(
                { error: "Conversion factor must be greater than 0" },
                { status: 400 }
            );
        }

        const existingConversion = await prisma.unitConversion.findFirst({
            where: {
                organizationId: session.user.organizationId,
                fromUnitId,
                toUnitId
            }
        });

        if (existingConversion) {
            return NextResponse.json(
                { error: "A conversion rule already exists for these units" },
                { status: 400 }
            );
        }

        const conversion = await prisma.unitConversion.create({
            data: {
                organizationId: session.user.organizationId,
                fromUnitId,
                toUnitId,
                conversionFactor: new Decimal(conversionFactor),
            },
            include: {
                fromUnit: true,
                toUnit: true,
            }
        });

        return NextResponse.json(conversion, { status: 201 });
    } catch (error) {
        console.error("Failed to create unit conversion:", error);
        return NextResponse.json(
            { error: "Failed to create unit conversion" },
            { status: 500 }
        );
    }
}
