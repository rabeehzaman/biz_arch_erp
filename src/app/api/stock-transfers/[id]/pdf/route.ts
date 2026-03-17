import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { StockTransferPDF } from "@/components/pdf/stock-transfer-pdf";
import { StockTransferArabicPDF } from "@/components/pdf/stock-transfer-pdf-arabic";

const sanitizeFilenamePart = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const dispositionType = searchParams.get("download") === "0" ? "inline" : "attachment";

    const [organization, pdfFormatSetting, hideCostSetting, transfer] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          arabicName: true,
          brandColor: true,
          currency: true,
        },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "transfer_pdf_format" },
        select: { value: true },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "transfer_pdf_hide_cost" },
        select: { value: true },
      }),
      prisma.stockTransfer.findFirst({
        where: { id, organizationId },
        include: {
          sourceBranch: { select: { name: true } },
          sourceWarehouse: { select: { name: true } },
          destinationBranch: { select: { name: true } },
          destinationWarehouse: { select: { name: true } },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  arabicName: true,
                  sku: true,
                },
              },
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    if (!transfer) {
      return NextResponse.json(
        { error: "Stock transfer not found" },
        { status: 404 }
      );
    }

    const useArabic = pdfFormatSetting?.value === "ARABIC";
    const hideCost = hideCostSetting?.value === "true";
    const PDFComponent = useArabic ? StockTransferArabicPDF : StockTransferPDF;

    const pdfProps = {
      organization: {
        name: organization?.name || transfer.organization.name,
        arabicName: organization?.arabicName ?? null,
        brandColor: organization?.brandColor ?? null,
        currency: organization?.currency || "INR",
      },
      hideCost,
      transfer: {
        transferNumber: transfer.transferNumber,
        status: transfer.status,
        transferDate: transfer.transferDate,
        notes: transfer.notes,
        createdAt: transfer.createdAt,
        approvedAt: transfer.approvedAt,
        shippedAt: transfer.shippedAt,
        completedAt: transfer.completedAt,
        cancelledAt: transfer.cancelledAt,
        reversedAt: transfer.reversedAt,
        sourceBranch: transfer.sourceBranch,
        sourceWarehouse: transfer.sourceWarehouse,
        destinationBranch: transfer.destinationBranch,
        destinationWarehouse: transfer.destinationWarehouse,
        items: transfer.items.map((item) => ({
          id: item.id,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          notes: item.notes,
          product: {
            name: item.product.name,
            arabicName: item.product.arabicName,
            sku: item.product.sku,
          },
        })),
      },
    };

    const pdfBuffer = await renderToBuffer(
      createElement(PDFComponent, pdfProps) as any
    );

    const filename = `stock-transfer-${sanitizeFilenamePart(transfer.transferNumber)}-${format(
      new Date(transfer.transferDate),
      "yyyy-MM-dd"
    )}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate stock transfer PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
