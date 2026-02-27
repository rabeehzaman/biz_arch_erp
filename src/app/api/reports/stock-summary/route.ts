import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const organizationId = getOrgId(session);

        const { searchParams } = new URL(request.url);
        const warehouseId = searchParams.get("warehouseId") || undefined;
        const branchId = searchParams.get("branchId") || undefined;
        const lowStockOnly = searchParams.get("lowStockOnly") === "true";

        // Build lot filter
        const lotWhere: any = {
            organizationId,
            remainingQuantity: { gt: 0 },
        };
        if (warehouseId) lotWhere.warehouseId = warehouseId;
        if (branchId) lotWhere.warehouse = { branchId };

        const stockLots = await prisma.stockLot.findMany({
            where: lotWhere,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        unit: { select: { id: true, name: true, code: true } },
                    },
                },
                warehouse: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        branch: { select: { id: true, name: true, code: true } },
                    },
                },
            },
            orderBy: [{ productId: "asc" }],
        });

        // Group by product+warehouse
        type StockRow = {
            productId: string;
            productName: string;
            sku: string | null;
            unit: { id: string; name: string; code: string } | null;
            warehouseId: string | null;
            warehouseName: string | null;
            branchName: string | null;
            totalQuantity: number;
            totalValue: number;
            avgCost: number;
            lotCount: number;
        };

        const grouped = new Map<string, StockRow>();

        for (const lot of stockLots) {
            const key = `${lot.productId}|${lot.warehouseId ?? "null"}`;
            const existing = grouped.get(key);
            const lotQty = Number(lot.remainingQuantity);
            const lotCost = Number(lot.unitCost);
            const lotValue = lotQty * lotCost;

            if (existing) {
                existing.totalQuantity += lotQty;
                existing.totalValue += lotValue;
                existing.avgCost = existing.totalQuantity > 0 ? existing.totalValue / existing.totalQuantity : 0;
                existing.lotCount++;
            } else {
                grouped.set(key, {
                    productId: lot.productId,
                    productName: lot.product.name,
                    sku: lot.product.sku,
                    unit: lot.product.unit,
                    warehouseId: lot.warehouseId,
                    warehouseName: lot.warehouse?.name ?? null,
                    branchName: lot.warehouse?.branch?.name ?? null,
                    totalQuantity: lotQty,
                    totalValue: lotValue,
                    avgCost: lotCost,
                    lotCount: 1,
                });
            }
        }

        const rows = Array.from(grouped.values()).sort((a, b) =>
            a.productName.localeCompare(b.productName)
        );

        // Also fetch all warehouses and branches for filter dropdowns on the client
        const warehouses = await prisma.warehouse.findMany({
            where: { organizationId, isActive: true },
            include: { branch: { select: { id: true, name: true, code: true } } },
            orderBy: { name: "asc" },
        });

        const branches = await prisma.branch.findMany({
            where: { organizationId, isActive: true },
            orderBy: { name: "asc" },
        });

        // Summary
        const totalItems = rows.length;
        const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);

        return NextResponse.json({
            rows,
            summary: { totalItems, totalValue },
            warehouses,
            branches,
        });
    } catch (error) {
        console.error("Failed to fetch stock summary:", error);
        return NextResponse.json({ error: "Failed to fetch stock summary" }, { status: 500 });
    }
}
