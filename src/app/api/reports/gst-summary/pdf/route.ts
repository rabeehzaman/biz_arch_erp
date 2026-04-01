import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { GSTSummaryPDF } from "@/components/pdf/gst-summary-pdf";
import { createElement } from "react";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const fromDateParam =
      searchParams.get("from") ||
      new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDateParam =
      searchParams.get("to") || new Date().toISOString();
    const lang = (searchParams.get("lang") === "ar" ? "ar" : "en") as "en" | "ar";
    const branchId = searchParams.get("branchId") || undefined;

    const fromDate = new Date(fromDateParam);
    const toDate = new Date(toDateParam);
    toDate.setHours(23, 59, 59, 999);

    // Reuse the same GST aggregation logic from the existing gst-summary route
    const [salesAgg, salesReturnsAgg, purchasesAgg, purchaseReturnsAgg, organization] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: {
            organizationId,
            issueDate: { gte: fromDate, lte: toDate },
            ...(branchId ? { branchId } : {}),
          },
          _sum: {
            subtotal: true,
            totalCgst: true,
            totalSgst: true,
            totalIgst: true,
          },
        }),
        prisma.creditNote.aggregate({
          where: {
            organizationId,
            issueDate: { gte: fromDate, lte: toDate },
            ...(branchId ? { branchId } : {}),
          },
          _sum: {
            subtotal: true,
            totalCgst: true,
            totalSgst: true,
            totalIgst: true,
          },
        }),
        prisma.purchaseInvoice.aggregate({
          where: {
            organizationId,
            invoiceDate: { gte: fromDate, lte: toDate },
            status: { not: "DRAFT" },
            ...(branchId ? { branchId } : {}),
          },
          _sum: {
            subtotal: true,
            totalCgst: true,
            totalSgst: true,
            totalIgst: true,
          },
        }),
        prisma.debitNote.aggregate({
          where: {
            organizationId,
            issueDate: { gte: fromDate, lte: toDate },
            ...(branchId ? { branchId } : {}),
          },
          _sum: {
            subtotal: true,
            totalCgst: true,
            totalSgst: true,
            totalIgst: true,
          },
        }),
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            name: true,
            arabicName: true,
            brandColor: true,
            currency: true,
          },
        }),
      ]);

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const getVal = (agg: any, field: string) =>
      Number(agg?._sum?.[field] || 0);

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
      taxableAmount:
        purchases.taxableAmount - purchaseReturns.taxableAmount,
      cgst: purchases.cgst - purchaseReturns.cgst,
      sgst: purchases.sgst - purchaseReturns.sgst,
      igst: purchases.igst - purchaseReturns.igst,
    };

    const totalLiability = {
      cgst: netOutputGST.cgst - netInputGST.cgst,
      sgst: netOutputGST.sgst - netInputGST.sgst,
      igst: netOutputGST.igst - netInputGST.igst,
    };

    const data = {
      sales,
      salesReturns,
      purchases,
      purchaseReturns,
      netOutputGST,
      netInputGST,
      totalLiability,
    };

    const from = fromDate.toISOString().split("T")[0];
    const to = toDate.toISOString().split("T")[0];

    const pdfBuffer = await renderToBuffer(
      createElement(GSTSummaryPDF, {
        organization,
        data,
        fromDate: from,
        toDate: to,
        lang,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gst-summary-${from}-to-${to}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate GST summary PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate GST summary PDF" },
      { status: 500 }
    );
  }
}
