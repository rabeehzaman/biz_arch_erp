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

interface AgeBracket {
  label: string;
  minDays: number;
  maxDays: number | null;
}

const DEFAULT_BRACKETS: AgeBracket[] = [
  { label: "0-30 days", minDays: 0, maxDays: 30 },
  { label: "31-90 days", minDays: 31, maxDays: 90 },
  { label: "91-180 days", minDays: 91, maxDays: 180 },
  { label: "180+ days", minDays: 181, maxDays: null },
];

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

    // Fetch org aging alert setting
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        jewelleryAgingAlertDays: true,
      },
    });

    const agingAlertDays = org?.jewelleryAgingAlertDays ?? 180;

    // Fetch all in-stock items
    const items = await prisma.jewelleryItem.findMany({
      where: {
        organizationId,
        status: "IN_STOCK",
      },
      select: {
        id: true,
        tagNumber: true,
        purity: true,
        metalType: true,
        netWeight: true,
        fineWeight: true,
        stoneValue: true,
        categoryId: true,
        category: {
          select: { name: true },
        },
        createdAt: true,
      },
    });

    // Fetch today's gold rates (or most recent) for market value estimation
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

    if (rates.length === 0) {
      const mostRecentRate = await prisma.goldRate.findFirst({
        where: { organizationId },
        orderBy: { date: "desc" },
        select: { date: true },
      });

      if (mostRecentRate) {
        const recentStart = new Date(mostRecentRate.date);
        recentStart.setUTCHours(0, 0, 0, 0);
        const recentEnd = new Date(
          recentStart.getTime() + 24 * 60 * 60 * 1000
        );

        rates = await prisma.goldRate.findMany({
          where: {
            organizationId,
            date: { gte: recentStart, lt: recentEnd },
          },
        });
      }
    }

    // Build rate lookup
    const rateMap = new Map<string, number>();
    for (const rate of rates) {
      const key = `${rate.metalType}_${rate.purity}`;
      rateMap.set(key, Number(rate.sellRate));
    }

    // Calculate age in days for each item and assign to brackets
    const bracketData = DEFAULT_BRACKETS.map((bracket) => ({
      ...bracket,
      itemCount: 0,
      totalFineWeight: 0,
      marketValue: 0,
    }));

    // Items that exceed the aging alert threshold
    const agingItems: Array<{
      id: string;
      tagNumber: string;
      categoryName: string | null;
      purity: string;
      metalType: string;
      fineWeight: number;
      ageDays: number;
      estimatedValue: number;
    }> = [];

    for (const item of items) {
      const ageDays = Math.floor(
        (now.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const netWeight = Number(item.netWeight);
      const fineWeight = Number(item.fineWeight);
      const stoneValue = Number(item.stoneValue);
      const rateKey = `${item.metalType}_${item.purity}`;
      const sellRate = rateMap.get(rateKey) ?? 0;
      const estimatedValue =
        Math.round((netWeight * sellRate + stoneValue) * 100) / 100;

      // Place into the correct bracket
      for (const bracket of bracketData) {
        const inRange =
          ageDays >= bracket.minDays &&
          (bracket.maxDays === null || ageDays <= bracket.maxDays);

        if (inRange) {
          bracket.itemCount += 1;
          bracket.totalFineWeight += fineWeight;
          bracket.marketValue += estimatedValue;
          break;
        }
      }

      // Check if item exceeds aging alert threshold
      if (ageDays >= agingAlertDays) {
        agingItems.push({
          id: item.id,
          tagNumber: item.tagNumber,
          categoryName: item.category?.name ?? null,
          purity: item.purity,
          metalType: item.metalType,
          fineWeight: Math.round(fineWeight * 1000) / 1000,
          ageDays,
          estimatedValue,
        });
      }
    }

    // Round bracket values
    const brackets = bracketData.map((bracket) => ({
      label: bracket.label,
      minDays: bracket.minDays,
      maxDays: bracket.maxDays,
      itemCount: bracket.itemCount,
      totalFineWeight: Math.round(bracket.totalFineWeight * 1000) / 1000,
      marketValue: Math.round(bracket.marketValue * 100) / 100,
    }));

    // Sort aging items by age descending (oldest first)
    agingItems.sort((a, b) => b.ageDays - a.ageDays);

    return NextResponse.json({
      brackets,
      agingAlertDays,
      agingItems,
      summary: {
        totalItems: items.length,
        agingItemCount: agingItems.length,
        agingPercentage:
          items.length > 0
            ? Math.round((agingItems.length / items.length) * 10000) / 100
            : 0,
      },
    });
  } catch (error) {
    console.error("Failed to generate inventory aging report:", error);
    return NextResponse.json(
      { error: "Failed to generate inventory aging report" },
      { status: 500 }
    );
  }
}
