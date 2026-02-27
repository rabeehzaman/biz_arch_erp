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
        const fromDate = searchParams.get("fromDate");
        const toDate = searchParams.get("toDate");

        const from = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
        const to = toDate ? new Date(toDate + "T23:59:59.999Z") : new Date();

        const dateFilter = { gte: from, lte: to };

        // Fetch all active branches and warehouses for lookup
        const [branches, warehouseList] = await Promise.all([
            prisma.branch.findMany({
                where: { organizationId, isActive: true },
                orderBy: { name: "asc" },
            }),
            prisma.warehouse.findMany({
                where: { organizationId },
                select: { id: true, name: true, code: true, branchId: true },
            }),
        ]);

        const branchMap = new Map(branches.map((b) => [b.id, b]));
        const warehouseMap = new Map(warehouseList.map((w) => [w.id, w]));

        // Fetch invoice revenue grouped by branch
        const invoicesByBranch = await prisma.invoice.groupBy({
            by: ["branchId"],
            where: { organizationId, issueDate: dateFilter },
            _sum: { subtotal: true, total: true, amountPaid: true, balanceDue: true },
            _count: { id: true },
        });

        // Fetch invoice revenue grouped by branch+warehouse (for drill-down)
        const invoicesByBranchWarehouse = await prisma.invoice.groupBy({
            by: ["branchId", "warehouseId"],
            where: { organizationId, issueDate: dateFilter },
            _sum: { subtotal: true, total: true, amountPaid: true, balanceDue: true },
            _count: { id: true },
        });

        // Fetch purchase costs by branch
        const purchasesByBranch = await prisma.purchaseInvoice.groupBy({
            by: ["branchId"],
            where: { organizationId, invoiceDate: dateFilter },
            _sum: { total: true },
        });

        // Fetch COGS per branch AND per branch+warehouse from invoice items
        const cogsPerKey: Record<string, number> = {};
        const invoicesWithCOGS = await prisma.invoice.findMany({
            where: { organizationId, issueDate: dateFilter },
            select: {
                branchId: true,
                warehouseId: true,
                items: { select: { costOfGoodsSold: true } },
            },
        });
        for (const inv of invoicesWithCOGS) {
            const bKey = inv.branchId ?? "null";
            const wKey = inv.warehouseId ?? "null";
            const cogs = inv.items.reduce((s, item) => s + Number(item.costOfGoodsSold || 0), 0);
            // Accumulate by branch
            cogsPerKey[bKey] = (cogsPerKey[bKey] || 0) + cogs;
            // Accumulate by branch+warehouse
            cogsPerKey[`${bKey}|${wKey}`] = (cogsPerKey[`${bKey}|${wKey}`] || 0) + cogs;
        }

        // Build branch rows
        const allBranchIds = new Set([
            ...invoicesByBranch.map((r) => r.branchId ?? "null"),
            ...purchasesByBranch.map((r) => r.branchId ?? "null"),
        ]);

        const rows = Array.from(allBranchIds).map((branchId) => {
            const branch = branchId !== "null" ? branchMap.get(branchId) : null;
            const invRow = invoicesByBranch.find((r) => (r.branchId ?? "null") === branchId);
            const purRow = purchasesByBranch.find((r) => (r.branchId ?? "null") === branchId);
            const cogs = cogsPerKey[branchId] || 0;

            const revenue = Number(invRow?._sum?.subtotal || 0);
            const totalInvoiced = Number(invRow?._sum?.total || 0);
            const collected = Number(invRow?._sum?.amountPaid || 0);
            const outstanding = Number(invRow?._sum?.balanceDue || 0);
            const purchases = Number(purRow?._sum?.total || 0);
            const grossProfit = revenue - cogs;
            const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

            // Per-warehouse drill-down for this branch
            const warehouseBreakdown = invoicesByBranchWarehouse
                .filter((r) => (r.branchId ?? "null") === branchId)
                .map((r) => {
                    const whId = r.warehouseId ?? "null";
                    const wh = r.warehouseId ? warehouseMap.get(r.warehouseId) : null;
                    const whCogs = cogsPerKey[`${branchId}|${whId}`] || 0;
                    const whRevenue = Number(r._sum?.subtotal || 0);
                    const whGrossProfit = whRevenue - whCogs;
                    return {
                        warehouseId: r.warehouseId,
                        warehouseName: wh?.name ?? "Unassigned",
                        warehouseCode: wh?.code ?? null,
                        invoiceCount: r._count?.id ?? 0,
                        revenue: whRevenue,
                        totalInvoiced: Number(r._sum?.total || 0),
                        collected: Number(r._sum?.amountPaid || 0),
                        outstanding: Number(r._sum?.balanceDue || 0),
                        cogs: whCogs,
                        grossProfit: whGrossProfit,
                        grossMargin: whRevenue > 0 ? (whGrossProfit / whRevenue) * 100 : 0,
                    };
                })
                .sort((a, b) => b.revenue - a.revenue);

            return {
                branchId: branchId !== "null" ? branchId : null,
                branchName: branch?.name ?? "Unassigned",
                branchCode: branch?.code ?? null,
                invoiceCount: invRow?._count?.id ?? 0,
                revenue,
                totalInvoiced,
                collected,
                outstanding,
                purchases,
                cogs,
                grossProfit,
                grossMargin,
                warehouses: warehouseBreakdown,
            };
        });

        // Sort: named branches alphabetically first, Unassigned last
        rows.sort((a, b) => {
            if (a.branchId === null) return 1;
            if (b.branchId === null) return -1;
            return a.branchName.localeCompare(b.branchName);
        });

        // Totals
        const totals = {
            invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
            revenue: rows.reduce((s, r) => s + r.revenue, 0),
            totalInvoiced: rows.reduce((s, r) => s + r.totalInvoiced, 0),
            collected: rows.reduce((s, r) => s + r.collected, 0),
            outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
            purchases: rows.reduce((s, r) => s + r.purchases, 0),
            cogs: rows.reduce((s, r) => s + r.cogs, 0),
            grossProfit: rows.reduce((s, r) => s + r.grossProfit, 0),
        };

        return NextResponse.json({ rows, totals, from: from.toISOString(), to: to.toISOString() });
    } catch (error) {
        console.error("Failed to fetch branch P&L:", error);
        return NextResponse.json({ error: "Failed to fetch branch P&L" }, { status: 500 });
    }
}
