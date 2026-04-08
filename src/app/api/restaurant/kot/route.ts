import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { Decimal } from "@prisma/client/runtime/client";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = getOrgId(session);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const tableId = searchParams.get("tableId");
        const date = searchParams.get("date");
        const posSessionId = searchParams.get("posSessionId");

        const where: Record<string, unknown> = { organizationId };

        if (status) {
            where.status = status;
        }
        if (tableId) {
            where.tableId = tableId;
        }
        if (posSessionId) {
            where.posSessionId = posSessionId;
        }
        if (date) {
            // Filter by date (YYYY-MM-DD)
            const startOfDay = new Date(`${date}T00:00:00.000Z`);
            const endOfDay = new Date(`${date}T23:59:59.999Z`);
            where.createdAt = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }

        const kots = await prisma.kOTOrder.findMany({
            where,
            include: {
                items: true,
                table: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        return NextResponse.json(kots);
    } catch (error) {
        console.error("Failed to fetch KOT orders:", error);
        return NextResponse.json(
            { error: "Failed to fetch KOT orders" },
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

        const organizationId = getOrgId(session);
        const body = await request.json();
        const {
            tableId,
            posSessionId,
            kotType,
            orderType,
            serverName,
            specialInstructions,
            guestCount,
            items,
        } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "At least one item is required" },
                { status: 400 }
            );
        }

        // Validate each item has a name and quantity
        for (const item of items) {
            if (!item.name || typeof item.name !== "string") {
                return NextResponse.json(
                    { error: "Each item must have a name" },
                    { status: 400 }
                );
            }
            if (item.quantity === undefined || item.quantity <= 0) {
                return NextResponse.json(
                    { error: "Each item must have a positive quantity" },
                    { status: 400 }
                );
            }
        }

        // Generate KOT number
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const prefix = `KOT-${dateStr}`;

        const lastKOT = await prisma.kOTOrder.findFirst({
            where: { kotNumber: { startsWith: prefix }, organizationId },
            orderBy: { kotNumber: "desc" },
        });

        let seq = 1;
        if (lastKOT) {
            const last = parseInt(lastKOT.kotNumber.split("-").pop() || "0");
            seq = last + 1;
        }
        const kotNumber = `${prefix}-${seq.toString().padStart(3, "0")}`;

        // Create KOT and items in a transaction
        const kot = await prisma.$transaction(async (tx) => {
            const kotOrder = await tx.kOTOrder.create({
                data: {
                    kotNumber,
                    organizationId,
                    tableId: tableId || null,
                    posSessionId: posSessionId || null,
                    kotType: kotType || "STANDARD",
                    orderType: orderType || "DINE_IN",
                    status: "PENDING",
                    serverName: serverName || null,
                    specialInstructions: specialInstructions || null,
                    guestCount: guestCount || null,
                    createdById: session.user.id,
                    printedAt: new Date(),
                },
            });

            const itemsData = items.map(
                (item: {
                    productId?: string;
                    name: string;
                    nameAr?: string;
                    variantName?: string;
                    quantity: number;
                    modifiers?: string[];
                    notes?: string;
                    isNew?: boolean;
                }) => ({
                    kotOrderId: kotOrder.id,
                    productId: item.productId || undefined,
                    name: item.name,
                    nameAr: item.nameAr || undefined,
                    variantName: item.variantName || undefined,
                    quantity: new Decimal(item.quantity),
                    modifiers: item.modifiers ?? undefined,
                    notes: item.notes || undefined,
                    isNew: item.isNew !== undefined ? item.isNew : true,
                })
            );

            for (const itemData of itemsData) {
                await tx.kOTOrderItem.create({ data: itemData });
            }

            // Return the full KOT with items
            return tx.kOTOrder.findUnique({
                where: { id: kotOrder.id },
                include: {
                    items: true,
                    table: true,
                },
            });
        });

        return NextResponse.json(kot, { status: 201 });
    } catch (error) {
        console.error("Failed to create KOT order:", error);
        return NextResponse.json(
            { error: "Failed to create KOT order" },
            { status: 500 }
        );
    }
}
