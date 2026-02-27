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

        // Fetch all active branches
        const branches = await prisma.branch.findMany({
            where: { organizationId, isActive: true },
            orderBy: { name: "asc" },
        });

        // Fetch invoice revenue by branch (for multi-branch)
        const invoicesByBranch = await prisma.invoice.groupBy({
            by: ["branchId"],
            where: { organizationId, issueDate: dateFilter },
            _sum: { subtotal: true, total: true, amountPaid: true, balanceDue: true },
            _count: { id: true },
        });

        // Fetch purchase costs by branch
        const purchasesByBranch = await prisma.purchaseInvoice.groupBy({
            by: ["branchId"],
            where: { organizationId, invoiceDate: dateFilter },
            _sum: { subtotal: true, total: true },
            _count: { id: true },
        });

        // Fetch COGS from invoice items per branch (via invoice join)
        const cogsPerBranch: Record<string, number> = {};
        const invoicesWithCOGS = await prisma.invoice.findMany({
            where: { organizationId, issueDate: dateFilter },
            select: {
                branchId: true,
                items: { select: { costOfGoodsSold: true } },
            },
        });
        for (const inv of invoicesWithCOGS) {
            const key = inv.branchId ?? "null";
            const cogs = inv.items.reduce((s, item) => s + Number(item.costOfGoodsSold || 0), 0);
            cogsPerBranch[key] = (cogsPerBranch[key] || 0) + cogs;
        }

        // Build branch map
        const branchMap = new Map(branches.map((b) => [b.id, b]));

        // Merge invoice and purchase data by branchId
        const allBranchIds = new Set([
            ...invoicesByBranch.map((r) => r.branchId ?? "null"),
            ...purchasesByBranch.map((r) => r.branchId ?? "null"),
        ]);

        const rows = Array.from(allBranchIds).map((branchId) => {
            const branch = branchId !== "null" ? branchMap.get(branchId) : null;
            const invRow = invoicesByBranch.find((r) => (r.branchId ?? "null") === branchId);
            const purRow = purchasesByBranch.find((r) => (r.branchId ?? "null") === branchId);
            const cogs = cogsPerBranch[branchId] || 0;

            const revenue = Number(invRow?._sum?.subtotal || 0);
            const totalInvoiced = Number(invRow?._sum?.total || 0);
            const collected = Number(invRow?._sum?.amountPaid || 0);
            const outstanding = Number(invRow?._sum?.balanceDue || 0);
            const purchases = Number(purRow?._sum?.total || 0);
            const grossProfit = revenue - cogs;
            const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

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
            };
        });

        // Sort: named branches first (alphabetical), then Unassigned
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
