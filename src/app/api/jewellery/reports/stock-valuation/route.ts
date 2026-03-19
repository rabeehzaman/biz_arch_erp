import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

const PURITY_MULTIPLIERS: Record<string, number> = {
  K24: 1.0,
  K22: 22 / 24,
  K21: 21 / 24,
  K18: 18 / 24,
  K14: 14 / 24,
  K9: 9 / 24,
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json(
        { error: "Jewellery module is not enabled" },
        { status: 403 }
      );
    }

    const organizationId = getOrgId(session);

    // Fetch all in-stock items with stone details
    const items = await prisma.jewelleryItem.findMany({
      where: {
        organizationId,
        status: "IN_STOCK",
      },
      select: {
        id: true,
        purity: true,
        metalType: true,
        netWeight: true,
        fineWeight: true,
        stoneValue: true,
        isConsignment: true,
      },
    });

    // Fetch today's gold rates (or most recent)
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    let rates = await prisma.goldRate.findMany({
      where: {
        organizationId,
        date: { gte: todayStart, lt: todayEnd },
      },
    });

    let rateDate = todayStart.toISOString().split("T")[0];

    // Fallback to most recent rates if none today
    if (rates.length === 0) {
      const mostRecentRate = await prisma.goldRate.findFirst({
        where: { organizationId },
        orderBy: { date: "desc" },
        select: { date: true },
      });

      if (mostRecentRate) {
        const recentStart = new Date(mostRecentRate.date);
        recentStart.setUTCHours(0, 0, 0, 0);
        const recentEnd = new Date(recentStart.getTime() + 24 * 60 * 60 * 1000);

        rates = await prisma.goldRate.findMany({
          where: {
            organizationId,
            date: { gte: recentStart, lt: recentEnd },
          },
        });

        rateDate = recentStart.toISOString().split("T")[0];
      }
    }

    // Build a rate lookup: "GOLD_K22" -> sellRate
    const rateMap = new Map<string, number>();
    for (const rate of rates) {
      const key = `${rate.metalType}_${rate.purity}`;
      rateMap.set(key, Number(rate.sellRate));
    }

    // Group items by purity + metalType
    const groupMap = new Map<
      string,
      {
        purity: string;
        metalType: string;
        itemCount: number;
        totalNetWeight: number;
        totalFineWeight: number;
        totalStoneValue: number;
        ownedCount: number;
        consignmentCount: number;
        ownedFineWeight: number;
        consignmentFineWeight: number;
        ownedStoneValue: number;
        consignmentStoneValue: number;
      }
    >();

    for (const item of items) {
      const key = `${item.metalType}_${item.purity}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          purity: item.purity,
          metalType: item.metalType,
          itemCount: 0,
          totalNetWeight: 0,
          totalFineWeight: 0,
          totalStoneValue: 0,
          ownedCount: 0,
          consignmentCount: 0,
          ownedFineWeight: 0,
          consignmentFineWeight: 0,
          ownedStoneValue: 0,
          consignmentStoneValue: 0,
        };
        groupMap.set(key, group);
      }

      const netWeight = Number(item.netWeight);
      const fineWeight = Number(item.fineWeight);
      const stoneValue = Number(item.stoneValue);

      group.itemCount += 1;
      group.totalNetWeight += netWeight;
      group.totalFineWeight += fineWeight;
      group.totalStoneValue += stoneValue;

      if (item.isConsignment) {
        group.consignmentCount += 1;
        group.consignmentFineWeight += fineWeight;
        group.consignmentStoneValue += stoneValue;
      } else {
        group.ownedCount += 1;
        group.ownedFineWeight += fineWeight;
        group.ownedStoneValue += stoneValue;
      }
    }

    // Build response groups with market value calculations
    let totalItems = 0;
    let totalFineWeight = 0;
    let totalMarketValue = 0;
    let ownedValue = 0;
    let consignmentValue = 0;

    const groups = Array.from(groupMap.values()).map((group) => {
      const rateKey = `${group.metalType}_${group.purity}`;
      const sellRate = rateMap.get(rateKey) ?? 0;

      // marketValue = totalNetWeight * sellRate + totalStoneValue
      const marketValue =
        Math.round(
          (group.totalNetWeight * sellRate + group.totalStoneValue) * 100
        ) / 100;

      const ownedMarketValue =
        Math.round(
          (group.ownedFineWeight *
            (sellRate / (PURITY_MULTIPLIERS[group.purity] ?? 1)) *
            (PURITY_MULTIPLIERS[group.purity] ?? 1) +
            group.ownedStoneValue) *
            100
        ) / 100;

      // For owned items: use their net weight proportion
      const ownedNetWeight =
        group.ownedCount > 0
          ? (group.totalNetWeight * group.ownedCount) / group.itemCount
          : 0;
      const consignmentNetWeight = group.totalNetWeight - ownedNetWeight;

      const ownedMV =
        Math.round(
          (ownedNetWeight * sellRate + group.ownedStoneValue) * 100
        ) / 100;
      const consignmentMV =
        Math.round(
          (consignmentNetWeight * sellRate + group.consignmentStoneValue) * 100
        ) / 100;

      totalItems += group.itemCount;
      totalFineWeight += group.totalFineWeight;
      totalMarketValue += marketValue;
      ownedValue += ownedMV;
      consignmentValue += consignmentMV;

      return {
        purity: group.purity,
        metalType: group.metalType,
        itemCount: group.itemCount,
        totalNetWeight: Math.round(group.totalNetWeight * 1000) / 1000,
        totalFineWeight: Math.round(group.totalFineWeight * 1000) / 1000,
        rate: sellRate,
        marketValue,
        stoneValue: Math.round(group.totalStoneValue * 100) / 100,
      };
    });

    // Sort groups by metalType then purity
    groups.sort((a, b) => {
      if (a.metalType !== b.metalType) return a.metalType.localeCompare(b.metalType);
      return a.purity.localeCompare(b.purity);
    });

    return NextResponse.json({
      groups,
      totals: {
        totalItems,
        totalFineWeight: Math.round(totalFineWeight * 1000) / 1000,
        totalMarketValue: Math.round(totalMarketValue * 100) / 100,
        ownedValue: Math.round(ownedValue * 100) / 100,
        consignmentValue: Math.round(consignmentValue * 100) / 100,
      },
      rateDate,
    });
  } catch (error) {
    console.error("Failed to generate stock valuation report:", error);
    return NextResponse.json(
      { error: "Failed to generate stock valuation report" },
      { status: 500 }
    );
  }
}
