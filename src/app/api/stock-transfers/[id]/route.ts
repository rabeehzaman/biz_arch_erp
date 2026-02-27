import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/client";

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
                    // Deduct stock from source warehouse
                    for (const item of transfer.items) {
                        const lots = await tx.stockLot.findMany({
                            where: {
                                productId: item.productId,
                                warehouseId: transfer.sourceWarehouseId,
                                remainingQuantity: { gt: 0 },
                            },
                            orderBy: { lotDate: "asc" },
                        });

                        let remaining = new Decimal(item.quantity);
                        for (const lot of lots) {
                            if (remaining.lte(0)) break;
                            const deduct = Decimal.min(lot.remainingQuantity, remaining);
                            await tx.stockLot.update({
                                where: { id: lot.id },
                                data: { remainingQuantity: { decrement: deduct } },
                            });
                            remaining = remaining.sub(deduct);
                        }
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
                    // If IN_TRANSIT, restore source warehouse stock
                    if (transfer.status === "IN_TRANSIT") {
                        for (const item of transfer.items) {
                            await tx.stockLot.create({
                                data: {
                                    productId: item.productId,
                                    organizationId,
                                    sourceType: "STOCK_TRANSFER",
                                    stockTransferId: id,
                                    warehouseId: transfer.sourceWarehouseId,
                                    lotDate: new Date(),
                                    unitCost: item.unitCost,
                                    initialQuantity: item.quantity,
                                    remainingQuantity: item.quantity,
                                },
                            });
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
                            where: { stockTransferId: id, warehouseId: transfer.destinationWarehouseId, productId: item.productId },
                            data: { remainingQuantity: 0 },
                        });

                        // Restore source lots
                        await tx.stockLot.create({
                            data: {
                                productId: item.productId,
                                organizationId,
                                sourceType: "STOCK_TRANSFER",
                                stockTransferId: id,
                                warehouseId: transfer.sourceWarehouseId,
                                lotDate: new Date(),
                                unitCost: item.unitCost,
                                initialQuantity: item.quantity,
                                remainingQuantity: item.quantity,
                            },
                        });
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
