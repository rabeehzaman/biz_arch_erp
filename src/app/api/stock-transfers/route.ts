import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateAutoNumber } from "@/lib/accounting/auto-number";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        const where: any = { organizationId: session.user.organizationId };
        if (status) where.status = status;

        const transfers = await prisma.stockTransfer.findMany({
            where,
            include: {
                sourceBranch: { select: { id: true, name: true } },
                sourceWarehouse: { select: { id: true, name: true } },
                destinationBranch: { select: { id: true, name: true } },
                destinationWarehouse: { select: { id: true, name: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(transfers);
    } catch (error) {
        console.error("Failed to fetch stock transfers:", error);
        return NextResponse.json({ error: "Failed to fetch stock transfers" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            sourceBranchId, sourceWarehouseId,
            destinationBranchId, destinationWarehouseId,
            transferDate, notes, items,
        } = body;

        if (!sourceWarehouseId || !destinationWarehouseId || !items?.length) {
            return NextResponse.json(
                { error: "Source warehouse, destination warehouse, and at least one item are required" },
                { status: 400 }
            );
        }

        if (sourceWarehouseId === destinationWarehouseId) {
            return NextResponse.json(
                { error: "Source and destination warehouse must be different" },
                { status: 400 }
            );
        }

        const organizationId = session.user.organizationId;

        // Verify warehouses belong to org and get their branches
        const srcWarehouse = await prisma.warehouse.findFirst({
            where: { id: sourceWarehouseId, organizationId },
            select: { id: true, branchId: true },
        });
        const dstWarehouse = await prisma.warehouse.findFirst({
            where: { id: destinationWarehouseId, organizationId },
            select: { id: true, branchId: true },
        });

        if (!srcWarehouse || !dstWarehouse) {
            return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
        }

        const transfer = await prisma.$transaction(async (tx) => {
            const transferNumber = await generateAutoNumber(
                tx.stockTransfer,
                "transferNumber",
                "ST",
                organizationId
            );

            return tx.stockTransfer.create({
                data: {
                    transferNumber,
                    organizationId,
                    sourceBranchId: sourceBranchId || srcWarehouse.branchId,
                    sourceWarehouseId,
                    destinationBranchId: destinationBranchId || dstWarehouse.branchId,
                    destinationWarehouseId,
                    status: "DRAFT",
                    transferDate: transferDate ? new Date(transferDate) : new Date(),
                    notes: notes || null,
                    items: {
                        create: items.map((item: any) => ({
                            organizationId,
                            productId: item.productId,
                            quantity: item.quantity,
                            unitCost: item.unitCost || 0,
                            notes: item.notes || null,
                        })),
                    },
                },
                include: {
                    sourceBranch: { select: { id: true, name: true } },
                    sourceWarehouse: { select: { id: true, name: true } },
                    destinationBranch: { select: { id: true, name: true } },
                    destinationWarehouse: { select: { id: true, name: true } },
                    items: {
                        include: { product: { select: { id: true, name: true } } },
                    },
                },
            });
        });

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        console.error("Failed to create stock transfer:", error);
        return NextResponse.json({ error: "Failed to create stock transfer" }, { status: 500 });
    }
}
