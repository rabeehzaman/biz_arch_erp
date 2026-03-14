import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/client";
import { consumeStockFIFO, restoreStockFromConsumptions } from "@/lib/inventory/fifo";

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
        const transfer = await prisma.stockTransfer.findFirst({
            where: { id, organizationId: session.user.organizationId },
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

        if (!transfer) {
            return NextResponse.json({ error: "Stock transfer not found" }, { status: 404 });
        }

        return NextResponse.json(transfer);
    } catch (error) {
        console.error("Failed to fetch stock transfer:", error);
        return NextResponse.json({ error: "Failed to fetch stock transfer" }, { status: 500 });
    }
}

// PUT — edit a transfer (DRAFT/APPROVED: simple replace; COMPLETED: undo + redo FIFO)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { sourceWarehouseId, destinationWarehouseId, transferDate, notes, items } = body;

        const transfer = await prisma.stockTransfer.findFirst({
            where: { id, organizationId },
            include: { items: { include: { product: { select: { name: true } } } } },
        });

        if (!transfer) {
            return NextResponse.json({ error: "Stock transfer not found" }, { status: 404 });
        }

        if (!["DRAFT", "APPROVED", "COMPLETED"].includes(transfer.status)) {
            return NextResponse.json(
                { error: "Only DRAFT, APPROVED, or COMPLETED transfers can be edited" },
                { status: 400 }
            );
        }

        if (!sourceWarehouseId || !destinationWarehouseId) {
            return NextResponse.json({ error: "Source and destination warehouses are required" }, { status: 400 });
        }

        if (sourceWarehouseId === destinationWarehouseId) {
            return NextResponse.json({ error: "Source and destination warehouses must be different" }, { status: 400 });
        }

        const validItems: Array<{ productId: string; quantity: number; notes?: string }> =
            Array.isArray(items) ? items.filter((i: any) => i.productId && Number(i.quantity) > 0) : [];

        if (validItems.length === 0) {
            return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
        }

        // Look up branch IDs from warehouses
        const [srcWarehouse, dstWarehouse] = await Promise.all([
            prisma.warehouse.findUnique({ where: { id: sourceWarehouseId }, select: { branchId: true } }),
            prisma.warehouse.findUnique({ where: { id: destinationWarehouseId }, select: { branchId: true } }),
        ]);

        if (!srcWarehouse || !dstWarehouse) {
            return NextResponse.json({ error: "Invalid warehouse selection" }, { status: 400 });
        }

        const parsedDate = transferDate ? new Date(transferDate) : transfer.transferDate;

        if (transfer.status === "COMPLETED") {
            // For COMPLETED transfers: undo the original FIFO + dest lots, then re-apply with new values

            // Guard: check destination lots haven't been partially consumed
            for (const item of transfer.items) {
                const destLots = await prisma.stockLot.findMany({
                    where: {
                        stockTransferId: id,
                        warehouseId: transfer.destinationWarehouseId,
                        productId: item.productId,
                        sourceType: "STOCK_TRANSFER",
                    },
                });
                const totalRemaining = destLots.reduce(
                    (sum, lot) => sum.add(lot.remainingQuantity), new Decimal(0)
                );
                if (totalRemaining.lt(new Decimal(item.quantity))) {
                    return NextResponse.json(
                        { error: `Cannot edit: stock for "${item.product.name}" in the destination warehouse has already been consumed` },
                        { status: 400 }
                    );
                }
            }

            const updated = await prisma.$transaction(async (tx) => {
                // 1. Undo destination lots from original transfer
                await tx.stockLot.updateMany({
                    where: { stockTransferId: id, warehouseId: transfer.destinationWarehouseId, sourceType: "STOCK_TRANSFER" },
                    data: { remainingQuantity: 0, initialQuantity: 0 },
                });

                // 2. Restore source warehouse stock from original FIFO consumptions
                for (const item of transfer.items) {
                    await restoreStockFromConsumptions(item.id, tx, "STOCK_TRANSFER");
                }

                // 3. Delete old items
                await tx.stockTransferItem.deleteMany({ where: { stockTransferId: id } });

                // 4. Update transfer header
                await tx.stockTransfer.update({
                    where: { id },
                    data: {
                        sourceWarehouseId,
                        destinationWarehouseId,
                        sourceBranchId: srcWarehouse.branchId,
                        destinationBranchId: dstWarehouse.branchId,
                        transferDate: parsedDate,
                        notes: notes || null,
                    },
                });

                // 5. Create new items with fresh FIFO consumption
                for (const item of validItems) {
                    const newItem = await tx.stockTransferItem.create({
                        data: {
                            productId: item.productId,
                            quantity: new Decimal(item.quantity),
                            unitCost: new Decimal(0),
                            organizationId,
                            stockTransferId: id,
                            notes: item.notes || null,
                        },
                    });

                    const fifoResult = await consumeStockFIFO(
                        item.productId,
                        new Decimal(item.quantity),
                        newItem.id,
                        parsedDate,
                        tx,
                        organizationId,
                        sourceWarehouseId,
                        "STOCK_TRANSFER"
                    );

                    const qty = new Decimal(item.quantity);
                    const unitCost = qty.gt(0) ? fifoResult.totalCOGS.div(qty) : new Decimal(0);

                    await tx.stockTransferItem.update({
                        where: { id: newItem.id },
                        data: { unitCost },
                    });

                    // 6. Create destination lot
                    await tx.stockLot.create({
                        data: {
                            productId: item.productId,
                            organizationId,
                            sourceType: "STOCK_TRANSFER",
                            stockTransferId: id,
                            warehouseId: destinationWarehouseId,
                            lotDate: parsedDate,
                            unitCost,
                            initialQuantity: qty,
                            remainingQuantity: qty,
                        },
                    });
                }

                return tx.stockTransfer.findUniqueOrThrow({ where: { id } });
            }, { timeout: 30000 });

            return NextResponse.json(updated);
        }

        // DRAFT / APPROVED — no stock has moved, simple replace
        const updated = await prisma.$transaction(async (tx) => {
            await tx.stockTransferItem.deleteMany({ where: { stockTransferId: id } });

            return tx.stockTransfer.update({
                where: { id },
                data: {
                    sourceWarehouseId,
                    destinationWarehouseId,
                    sourceBranchId: srcWarehouse.branchId,
                    destinationBranchId: dstWarehouse.branchId,
                    transferDate: parsedDate,
                    notes: notes || null,
                    items: {
                        create: validItems.map((item) => ({
                            productId: item.productId,
                            quantity: new Decimal(item.quantity),
                            unitCost: new Decimal(0),
                            organizationId,
                            notes: item.notes || null,
                        })),
                    },
                },
            });
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update stock transfer:", error);
        return NextResponse.json({ error: "Failed to update stock transfer" }, { status: 500 });
    }
}

// PATCH — status transitions: approve, ship, complete, cancel, reverse
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action } = body;

        const organizationId = session.user.organizationId;

        const transfer = await prisma.stockTransfer.findFirst({
            where: { id, organizationId },
            include: {
                items: { include: { product: true } },
            },
        });

        if (!transfer) {
            return NextResponse.json({ error: "Stock transfer not found" }, { status: 404 });
        }

        const validTransitions: Record<string, string[]> = {
            DRAFT: ["approve", "cancel"],
            APPROVED: ["ship", "cancel"],
            IN_TRANSIT: ["complete", "cancel"],
            COMPLETED: ["reverse"],
        };

        const allowed = validTransitions[transfer.status] || [];
        if (!allowed.includes(action)) {
            return NextResponse.json(
                { error: `Cannot '${action}' a transfer in '${transfer.status}' status` },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            switch (action) {
                case "approve":
                    return tx.stockTransfer.update({
                        where: { id },
                        data: { status: "APPROVED", approvedAt: new Date() },
                    });

                case "ship":
                    // Deduct stock from source warehouse using fully compliant FIFO logic
                    for (const item of transfer.items) {
                        const fifoResult = await consumeStockFIFO(
                            item.productId,
                            item.quantity,
                            item.id,
                            transfer.transferDate,
                            tx,
                            organizationId,
                            transfer.sourceWarehouseId,
                            "STOCK_TRANSFER"
                        );

                        const newUnitCost = new Decimal(item.quantity).gt(0)
                            ? fifoResult.totalCOGS.div(new Decimal(item.quantity))
                            : new Decimal(0);

                        await tx.stockTransferItem.update({
                            where: { id: item.id },
                            data: { unitCost: newUnitCost }
                        });

                        // Local override in runtime object in case 'complete' runs in same execution context
                        item.unitCost = newUnitCost as any;
                    }

                    return tx.stockTransfer.update({
                        where: { id },
                        data: { status: "IN_TRANSIT", shippedAt: new Date() },
                    });

                case "complete":
                    // Add stock to destination warehouse
                    for (const item of transfer.items) {
                        await tx.stockLot.create({
                            data: {
                                productId: item.productId,
                                organizationId,
                                sourceType: "STOCK_TRANSFER",
                                stockTransferId: id,
                                warehouseId: transfer.destinationWarehouseId,
                                lotDate: new Date(),
                                unitCost: item.unitCost,
                                initialQuantity: item.quantity,
                                remainingQuantity: item.quantity,
                            },
                        });
                    }

                    return tx.stockTransfer.update({
                        where: { id },
                        data: { status: "COMPLETED", completedAt: new Date() },
                    });

                case "cancel":
                    // If IN_TRANSIT, restore source warehouse stock from exact previously consumed stock lots
                    if (transfer.status === "IN_TRANSIT") {
                        for (const item of transfer.items) {
                            await restoreStockFromConsumptions(item.id, tx, "STOCK_TRANSFER");
                        }
                    }

                    return tx.stockTransfer.update({
                        where: { id },
                        data: { status: "CANCELLED", cancelledAt: new Date() },
                    });

                case "reverse":
                    // Check destination lots haven't been consumed
                    for (const item of transfer.items) {
                        const destLots = await tx.stockLot.findMany({
                            where: {
                                stockTransferId: id,
                                warehouseId: transfer.destinationWarehouseId,
                                productId: item.productId,
                                sourceType: "STOCK_TRANSFER",
                            },
                        });
                        const totalRemaining = destLots.reduce(
                            (sum, lot) => sum.add(lot.remainingQuantity), new Decimal(0)
                        );
                        if (totalRemaining.lt(item.quantity)) {
                            return NextResponse.json(
                                { error: `Cannot reverse: some transferred stock for "${item.product.name}" has been consumed` },
                                { status: 400 }
                            );
                        }
                    }

                    // Remove destination lots and restore source
                    for (const item of transfer.items) {
                        // Zero out destination lots
                        await tx.stockLot.updateMany({
                            where: { stockTransferId: id, warehouseId: transfer.destinationWarehouseId, productId: item.productId, sourceType: "STOCK_TRANSFER" },
                            data: { remainingQuantity: 0 },
                        });

                        // Restore exact consumptions back to source original stock lots
                        await restoreStockFromConsumptions(item.id, tx, "STOCK_TRANSFER");
                    }

                    return tx.stockTransfer.update({
                        where: { id },
                        data: {
                            status: "REVERSED",
                            reversedAt: new Date(),
                            notes: (transfer.notes || "") + `\nReversed on ${new Date().toISOString().split("T")[0]}`,
                        },
                    });

                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        });

        // If result is a NextResponse (error case from reversal check), return it directly
        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to update stock transfer:", error);
        return NextResponse.json({ error: "Failed to update stock transfer" }, { status: 500 });
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

        const { id } = await params;

        const transfer = await prisma.stockTransfer.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });

        if (!transfer) {
            return NextResponse.json({ error: "Stock transfer not found" }, { status: 404 });
        }

        if (!["DRAFT", "APPROVED"].includes(transfer.status)) {
            return NextResponse.json(
                { error: "Only DRAFT and APPROVED transfers can be deleted" },
                { status: 400 }
            );
        }

        await prisma.stockTransferItem.deleteMany({ where: { stockTransferId: id } });
        await prisma.stockTransfer.delete({ where: { id } });

        return NextResponse.json({ message: "Stock transfer deleted" });
    } catch (error) {
        console.error("Failed to delete stock transfer:", error);
        return NextResponse.json({ error: "Failed to delete stock transfer" }, { status: 500 });
    }
}
