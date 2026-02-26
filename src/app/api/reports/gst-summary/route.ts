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
        const fromDateParam = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString();
        const toDateParam = searchParams.get("to") || new Date().toISOString();

        const fromDate = new Date(fromDateParam);
        const toDate = new Date(toDateParam);
        toDate.setHours(23, 59, 59, 999);

        // 1. Sales (Invoices)
        const salesAgg = await prisma.invoice.aggregate({
            where: {
                organizationId,
                issueDate: { gte: fromDate, lte: toDate },
            },
            _sum: { subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true },
        });

        // 2. Sales Returns (Credit Notes)
        const salesReturnsAgg = await prisma.creditNote.aggregate({
            where: {
                organizationId,
                issueDate: { gte: fromDate, lte: toDate },
            },
            _sum: { subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true },
        });

        // 3. Purchases (Purchase Invoices)
        const purchasesAgg = await prisma.purchaseInvoice.aggregate({
            where: {
                organizationId,
                invoiceDate: { gte: fromDate, lte: toDate },
                status: { not: "DRAFT" },
            },
            _sum: { subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true },
        });

        // 4. Purchase Returns (Debit Notes)
        const purchaseReturnsAgg = await prisma.debitNote.aggregate({
            where: {
                organizationId,
                issueDate: { gte: fromDate, lte: toDate },
            },
            _sum: { subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true },
        });

        // Helper to safely get sum values
        const getVal = (agg: any, field: string) => Number(agg?._sum?.[field] || 0);

        const sales = {
            taxableAmount: getVal(salesAgg, "subtotal"),
            cgst: getVal(salesAgg, "totalCgst"),
            sgst: getVal(salesAgg, "totalSgst"),
            igst: getVal(salesAgg, "totalIgst"),
        };

        const salesReturns = {
            taxableAmount: getVal(salesReturnsAgg, "subtotal"),
            cgst: getVal(salesReturnsAgg, "totalCgst"),
            sgst: getVal(salesReturnsAgg, "totalSgst"),
            igst: getVal(salesReturnsAgg, "totalIgst"),
        };

        const purchases = {
            taxableAmount: getVal(purchasesAgg, "subtotal"),
            cgst: getVal(purchasesAgg, "totalCgst"),
            sgst: getVal(purchasesAgg, "totalSgst"),
            igst: getVal(purchasesAgg, "totalIgst"),
        };

        const purchaseReturns = {
            taxableAmount: getVal(purchaseReturnsAgg, "subtotal"),
            cgst: getVal(purchaseReturnsAgg, "totalCgst"),
            sgst: getVal(purchaseReturnsAgg, "totalSgst"),
            igst: getVal(purchaseReturnsAgg, "totalIgst"),
        };

        const netOutputGST = {
            taxableAmount: sales.taxableAmount - salesReturns.taxableAmount,
            cgst: sales.cgst - salesReturns.cgst,
            sgst: sales.sgst - salesReturns.sgst,
            igst: sales.igst - salesReturns.igst,
        };

        const netInputGST = {
            taxableAmount: purchases.taxableAmount - purchaseReturns.taxableAmount,
            cgst: purchases.cgst - purchaseReturns.cgst,
            sgst: purchases.sgst - purchaseReturns.cgst,
            igst: purchases.igst - purchaseReturns.igst,
        };

        const totalLiability = {
            cgst: netOutputGST.cgst - netInputGST.cgst,
            sgst: netOutputGST.sgst - netInputGST.sgst,
            igst: netOutputGST.igst - netInputGST.igst,
        };

        return NextResponse.json({
            fromDate,
            toDate,
            sales,
            salesReturns,
            purchases,
            purchaseReturns,
            netOutputGST,
            netInputGST,
            totalLiability,
        });
    } catch (error) {
        console.error("Failed to generate GST summary:", error);
        return NextResponse.json(
            { error: "Failed to generate GST summary" },
            { status: 500 }
        );
    }
}
