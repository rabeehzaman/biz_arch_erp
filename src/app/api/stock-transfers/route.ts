import { NextRequest, NextResponse } from "next/server";
import { StockTransferStatus } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { Decimal } from "@prisma/client/runtime/client";
import { calculateFIFOConsumption, consumeStockFIFO } from "@/lib/inventory/fifo";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        const where: { organizationId: string; status?: StockTransferStatus } = {
            organizationId: session.user.organizationId,
        };
        if (status && Object.values(StockTransferStatus).includes(status as StockTransferStatus)) {
            where.status = status as StockTransferStatus;
        }

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
        const rawItems = Array.isArray(body.items)
            ? body.items as Array<{ productId?: string; quantity?: number; notes?: string | null }>
            : [];
        const {
            sourceBranchId, sourceWarehouseId,
            destinationBranchId, destinationWarehouseId,
            transferDate, notes,
        } = body;

        if (!sourceWarehouseId || !destinationWarehouseId || rawItems.length === 0) {
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

        const normalizedItems = rawItems
            .map((item) => ({
                productId: item.productId,
                quantity: Number(item.quantity),
                notes: item.notes || null,
            }))
            .filter(
                (
                    item
                ): item is { productId: string; quantity: number; notes: string | null } =>
                    Boolean(item.productId) && item.quantity > 0
            );

        if (normalizedItems.length === 0) {
            return NextResponse.json(
                { error: "Add at least one valid item with quantity greater than zero" },
                { status: 400 }
            );
        }

        const organizationId = session.user.organizationId;
        const parsedTransferDate = transferDate ? new Date(transferDate) : new Date();

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
            for (const item of normalizedItems) {
                const stockPreview = await calculateFIFOConsumption(
                    item.productId,
                    item.quantity,
                    parsedTransferDate,
                    tx,
                    sourceWarehouseId
                );

                if (stockPreview.insufficientStock) {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { name: true },
                    });

                    const error = new Error(
                        `Insufficient stock for "${product?.name || item.productId}" in the selected source warehouse. Available: ${stockPreview.availableQuantity.toFixed(2)}, requested: ${item.quantity.toFixed(2)}.`
                    ) as Error & { status?: number };
                    error.status = 400;
                    throw error;
                }
            }

            const transferNumber = await generateAutoNumber(
                tx.stockTransfer,
                "transferNumber",
                "ST",
                organizationId
            );

            const transfer = await tx.stockTransfer.create({
                data: {
                    transferNumber,
                    organizationId,
                    sourceBranchId: sourceBranchId || srcWarehouse.branchId,
                    sourceWarehouseId,
                    destinationBranchId: destinationBranchId || dstWarehouse.branchId,
                    destinationWarehouseId,
                    status: "COMPLETED",
                    transferDate: parsedTransferDate,
                    completedAt: new Date(),
                    notes: notes || null,
                    items: {
                        create: normalizedItems.map((item: { productId: string; quantity: number; notes: string | null }) => ({
                            organizationId,
                            productId: item.productId,
                            quantity: item.quantity,
                            unitCost: 0,
                            notes: item.notes,
                        })),
                    },
                },
                include: {
                    items: true,
                },
            });

            for (const item of transfer.items) {
                const fifoResult = await consumeStockFIFO(
                    item.productId,
                    item.quantity,
                    item.id,
                    parsedTransferDate,
                    tx,
                    organizationId,
                    sourceWarehouseId,
                    "STOCK_TRANSFER"
                );

                const quantity = new Decimal(item.quantity);
                const unitCost = quantity.gt(0)
                    ? fifoResult.totalCOGS.div(quantity)
                    : new Decimal(0);

                await tx.stockTransferItem.update({
                    where: { id: item.id },
                    data: { unitCost },
                });

                await tx.stockLot.create({
                    data: {
                        productId: item.productId,
                        organizationId,
                        sourceType: "STOCK_TRANSFER",
                        stockTransferId: transfer.id,
                        warehouseId: destinationWarehouseId,
                        lotDate: parsedTransferDate,
                        unitCost,
                        initialQuantity: item.quantity,
                        remainingQuantity: item.quantity,
                    },
                });
            }

            return tx.stockTransfer.findUniqueOrThrow({
                where: { id: transfer.id },
                include: {
                    sourceBranch: { select: { id: true, name: true } },
                    sourceWarehouse: { select: { id: true, name: true } },
                    destinationBranch: { select: { id: true, name: true } },
                    destinationWarehouse: { select: { id: true, name: true } },
                    items: {
                        include: { product: { select: { id: true, name: true, sku: true } } },
                    },
                },
            });
        }, { timeout: 30000 });

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        console.error("Failed to create stock transfer:", error);
        const status = typeof error === "object" && error && "status" in error
            ? Number((error as { status?: number }).status) || 500
            : 500;
        const message = error instanceof Error
            ? error.message
            : "Failed to create stock transfer";
        return NextResponse.json({ error: message }, { status });
    }
}
