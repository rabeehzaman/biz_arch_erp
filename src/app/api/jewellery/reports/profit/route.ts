import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Date range filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    // Get all jewellery sale invoices in the period
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        isJewellerySale: true,
        ...(from || to ? { issueDate: dateFilter } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          where: { jewelleryItemId: { not: null } },
          select: {
            id: true,
            jewelleryItemId: true,
            unitPrice: true,
            quantity: true,
            total: true,
            costOfGoodsSold: true,
            goldRate: true,
            purity: true,
            metalType: true,
            grossWeight: true,
            netWeight: true,
            fineWeight: true,
            wastagePercent: true,
            makingChargeType: true,
            makingChargeValue: true,
            stoneValue: true,
            tagNumber: true,
            huidNumber: true,
          },
        },
      },
      orderBy: { issueDate: "desc" },
    });

    // Calculate per-item and per-invoice profitability
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalMetalRevenue = 0;
    let totalMakingRevenue = 0;
    let totalStoneRevenue = 0;
    let totalGrossWeight = 0;
    let totalFineWeight = 0;
    let itemCount = 0;

    const invoiceBreakdowns = invoices.map((inv) => {
      let invRevenue = 0;
      let invCOGS = 0;
      let invMetalRevenue = 0;
      let invMakingRevenue = 0;
      let invStoneRevenue = 0;

      const itemDetails = inv.items.map((item) => {
        const sellPrice = Number(item.unitPrice) * Number(item.quantity);
        const costPrice = Number(item.costOfGoodsSold);
        const profit = sellPrice - costPrice;
        const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

        // Reconstruct pricing split from stored fields
        const nw = Number(item.netWeight || 0);
        const gr = Number(item.goldRate || 0);
        const wp = Number(item.wastagePercent || 0);
        const sv = Number(item.stoneValue || 0);
        const mcv = Number(item.makingChargeValue || 0);
        const mct = item.makingChargeType as string;

        const goldValue = nw * gr;
        const wastageValue = nw * (wp / 100) * gr;
        let makingCharges = 0;
        if (mct === "PER_GRAM") makingCharges = mcv * nw;
        else if (mct === "PERCENTAGE") makingCharges = goldValue * (mcv / 100);
        else if (mct === "FIXED") makingCharges = mcv;

        const metalRev = goldValue + wastageValue;
        const makingRev = makingCharges;

        invRevenue += sellPrice;
        invCOGS += costPrice;
        invMetalRevenue += metalRev;
        invMakingRevenue += makingRev;
        invStoneRevenue += sv;
        totalGrossWeight += Number(item.grossWeight || 0);
        totalFineWeight += Number(item.fineWeight || 0);
        itemCount++;

        return {
          tagNumber: item.tagNumber,
          huidNumber: item.huidNumber,
          purity: item.purity,
          metalType: item.metalType,
          grossWeight: Number(item.grossWeight || 0),
          fineWeight: Number(item.fineWeight || 0),
          goldRate: gr,
          sellPrice: round2(sellPrice),
          costPrice: round2(costPrice),
          profit: round2(profit),
          marginPercent: round2(margin),
          metalRevenue: round2(metalRev),
          makingRevenue: round2(makingRev),
          stoneRevenue: round2(sv),
        };
      });

      totalRevenue += invRevenue;
      totalCOGS += invCOGS;
      totalMetalRevenue += invMetalRevenue;
      totalMakingRevenue += invMakingRevenue;
      totalStoneRevenue += invStoneRevenue;

      const invProfit = invRevenue - invCOGS;

      return {
        invoiceNumber: inv.invoiceNumber,
        date: inv.issueDate,
        customerName: inv.customer?.name || "Walk-in",
        itemCount: itemDetails.length,
        revenue: round2(invRevenue),
        cogs: round2(invCOGS),
        profit: round2(invProfit),
        marginPercent: invRevenue > 0 ? round2((invProfit / invRevenue) * 100) : 0,
        items: itemDetails,
      };
    });

    const totalProfit = totalRevenue - totalCOGS;
    const metalCOGS = totalCOGS > 0 && totalRevenue > 0
      ? round2(totalCOGS * (totalMetalRevenue / (totalMetalRevenue + totalMakingRevenue + totalStoneRevenue || 1)))
      : 0;
    const makingCOGS = totalCOGS - metalCOGS;

    return NextResponse.json({
      period: { from: from || null, to: to || null },
      summary: {
        invoiceCount: invoices.length,
        itemCount,
        totalGrossWeight: round2(totalGrossWeight),
        totalFineWeight: round2(totalFineWeight),
        totalRevenue: round2(totalRevenue),
        totalCOGS: round2(totalCOGS),
        totalProfit: round2(totalProfit),
        overallMargin: totalRevenue > 0 ? round2((totalProfit / totalRevenue) * 100) : 0,
      },
      marginSplit: {
        metalRevenue: round2(totalMetalRevenue),
        metalCOGS: round2(metalCOGS),
        metalProfit: round2(totalMetalRevenue - metalCOGS),
        metalMargin: totalMetalRevenue > 0 ? round2(((totalMetalRevenue - metalCOGS) / totalMetalRevenue) * 100) : 0,
        makingRevenue: round2(totalMakingRevenue),
        makingCOGS: round2(makingCOGS),
        makingProfit: round2(totalMakingRevenue - makingCOGS),
        makingMargin: totalMakingRevenue > 0 ? round2(((totalMakingRevenue - makingCOGS) / totalMakingRevenue) * 100) : 0,
        stoneRevenue: round2(totalStoneRevenue),
      },
      invoices: invoiceBreakdowns,
    });
  } catch (error) {
    console.error("Failed to generate profit report:", error);
    return NextResponse.json({ error: "Failed to generate profit report" }, { status: 500 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
