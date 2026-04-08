import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { OpeningStockPDF } from "@/components/pdf/opening-stock-pdf";
import type { Language } from "@/lib/i18n-translate";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const warehouseIdParam = searchParams.get("warehouseId");
    const userLang = (session.user as { language?: string }).language || "en";
    const lang: Language = (searchParams.get("lang") as Language) || (userLang as Language);

    // Build where clause
    const where: any = { organizationId };
    if (warehouseIdParam) {
      where.warehouseId = warehouseIdParam === "none" ? null : warehouseIdParam;
    }

    const [organization, openingStocks] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          arabicName: true,
          brandColor: true,
          currency: true,
        },
      }),
      prisma.openingStock.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        include: {
          product: {
            select: {
              name: true,
              arabicName: true,
              sku: true,
              unit: { select: { code: true } },
            },
          },
          stockLot: {
            select: { remainingQuantity: true },
          },
          warehouse: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    // Group by warehouse
    const groupMap = new Map<
      string,
      {
        warehouseName: string;
        items: any[];
        totalQuantity: number;
        totalValue: number;
      }
    >();

    for (const stock of openingStocks) {
      const key = stock.warehouseId || "__general__";
      const warehouseName = stock.warehouse?.name || (lang === "ar" ? "\u0639\u0627\u0645" : "General");
      const qty = Number(stock.quantity);
      const cost = Number(stock.unitCost);
      const totalValue = qty * cost;
      const remaining = stock.stockLot ? Number(stock.stockLot.remainingQuantity) : 0;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          warehouseName,
          items: [],
          totalQuantity: 0,
          totalValue: 0,
        });
      }

      const group = groupMap.get(key)!;
      group.items.push({
        productName: stock.product.name,
        arabicName: stock.product.arabicName,
        sku: stock.product.sku,
        quantity: qty,
        remaining,
        unitCost: cost,
        totalValue,
        stockDate: stock.stockDate.toISOString(),
        unitCode: stock.product.unit?.code || null,
      });
      group.totalQuantity += qty;
      group.totalValue += totalValue;
    }

    const groups = Array.from(groupMap.values());

    const grandTotals = {
      totalProducts: openingStocks.length,
      totalQuantity: groups.reduce((s, g) => s + g.totalQuantity, 0),
      totalValue: groups.reduce((s, g) => s + g.totalValue, 0),
    };

    const pdfBuffer = await renderToBuffer(
      createElement(OpeningStockPDF, {
        organization: {
          name: organization?.name || "",
          arabicName: organization?.arabicName ?? null,
          brandColor: organization?.brandColor ?? null,
          currency: organization?.currency || "INR",
        },
        groups,
        grandTotals,
        lang,
      }) as any
    );

    const filename = `opening-stock-report-${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate opening stock PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
