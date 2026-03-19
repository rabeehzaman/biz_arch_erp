import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

const PURITY_PERCENTAGES: Record<string, number> = {
  K24: 99.9,
  K22: 91.67,
  K21: 87.5,
  K18: 75.0,
  K14: 58.33,
  K9: 37.5,
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
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date parameters are required" },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    // INFLOW 1: Jewellery items created in period (new stock received)
    const newItems = await prisma.jewelleryItem.findMany({
      where: {
        organizationId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        purity: true,
        metalType: true,
        fineWeight: true,
      },
    });

    // Aggregate new items by purity
    const newItemsByPurity = new Map<
      string,
      { purity: string; metalType: string; fineWeight: number; itemCount: number }
    >();
    for (const item of newItems) {
      const key = `${item.metalType}_${item.purity}`;
      const existing = newItemsByPurity.get(key);
      if (existing) {
        existing.fineWeight += Number(item.fineWeight);
        existing.itemCount += 1;
      } else {
        newItemsByPurity.set(key, {
          purity: item.purity,
          metalType: item.metalType,
          fineWeight: Number(item.fineWeight),
          itemCount: 1,
        });
      }
    }

    // INFLOW 2: Old gold purchases in period
    const oldGoldPurchases = await prisma.oldGoldPurchase.findMany({
      where: {
        organizationId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        weight: true,
        purityPercentage: true,
        testedPurity: true,
      },
    });

    // Aggregate old gold by tested purity
    const oldGoldByPurity = new Map<
      string,
      { purity: string; fineWeight: number; purchaseCount: number }
    >();
    for (const purchase of oldGoldPurchases) {
      const fineWeight =
        (Number(purchase.weight) * Number(purchase.purityPercentage)) / 100;
      const key = purchase.testedPurity;
      const existing = oldGoldByPurity.get(key);
      if (existing) {
        existing.fineWeight += fineWeight;
        existing.purchaseCount += 1;
      } else {
        oldGoldByPurity.set(key, {
          purity: purchase.testedPurity,
          fineWeight,
          purchaseCount: 1,
        });
      }
    }

    // OUTFLOW 1: Items sold in period (status changed to SOLD)
    // We look for items with status SOLD and updatedAt in the period
    const soldItems = await prisma.jewelleryItem.findMany({
      where: {
        organizationId,
        status: "SOLD",
        updatedAt: { gte: fromDate, lte: toDate },
      },
      select: {
        purity: true,
        metalType: true,
        fineWeight: true,
      },
    });

    const soldByPurity = new Map<
      string,
      { purity: string; metalType: string; fineWeight: number; itemCount: number }
    >();
    for (const item of soldItems) {
      const key = `${item.metalType}_${item.purity}`;
      const existing = soldByPurity.get(key);
      if (existing) {
        existing.fineWeight += Number(item.fineWeight);
        existing.itemCount += 1;
      } else {
        soldByPurity.set(key, {
          purity: item.purity,
          metalType: item.metalType,
          fineWeight: Number(item.fineWeight),
          itemCount: 1,
        });
      }
    }

    // OUTFLOW 2: Karigar issues in period
    const karigarIssues = await prisma.karigarTransaction.findMany({
      where: {
        organizationId,
        type: "ISSUE",
        date: { gte: fromDate, lte: toDate },
      },
      select: {
        purity: true,
        fineWeight: true,
      },
    });

    const issuesByPurity = new Map<
      string,
      { purity: string; fineWeight: number; transactionCount: number }
    >();
    for (const txn of karigarIssues) {
      const key = txn.purity;
      const existing = issuesByPurity.get(key);
      if (existing) {
        existing.fineWeight += Number(txn.fineWeight);
        existing.transactionCount += 1;
      } else {
        issuesByPurity.set(key, {
          purity: txn.purity,
          fineWeight: Number(txn.fineWeight),
          transactionCount: 1,
        });
      }
    }

    // RETURNS: Karigar returns in period
    const karigarReturns = await prisma.karigarTransaction.findMany({
      where: {
        organizationId,
        type: "RETURN",
        date: { gte: fromDate, lte: toDate },
      },
      select: {
        purity: true,
        fineWeight: true,
      },
    });

    const returnsByPurity = new Map<
      string,
      { purity: string; fineWeight: number; transactionCount: number }
    >();
    for (const txn of karigarReturns) {
      const key = txn.purity;
      const existing = returnsByPurity.get(key);
      if (existing) {
        existing.fineWeight += Number(txn.fineWeight);
        existing.transactionCount += 1;
      } else {
        returnsByPurity.set(key, {
          purity: txn.purity,
          fineWeight: Number(txn.fineWeight),
          transactionCount: 1,
        });
      }
    }

    // Build inflows array
    const inflows: Array<{
      source: string;
      purity: string;
      metalType?: string;
      fineWeight: number;
      count: number;
    }> = [];

    for (const group of newItemsByPurity.values()) {
      inflows.push({
        source: "NEW_STOCK",
        purity: group.purity,
        metalType: group.metalType,
        fineWeight: Math.round(group.fineWeight * 1000) / 1000,
        count: group.itemCount,
      });
    }

    for (const group of oldGoldByPurity.values()) {
      inflows.push({
        source: "OLD_GOLD_PURCHASE",
        purity: group.purity,
        fineWeight: Math.round(group.fineWeight * 1000) / 1000,
        count: group.purchaseCount,
      });
    }

    for (const group of returnsByPurity.values()) {
      inflows.push({
        source: "KARIGAR_RETURN",
        purity: group.purity,
        fineWeight: Math.round(group.fineWeight * 1000) / 1000,
        count: group.transactionCount,
      });
    }

    // Build outflows array
    const outflows: Array<{
      source: string;
      purity: string;
      metalType?: string;
      fineWeight: number;
      count: number;
    }> = [];

    for (const group of soldByPurity.values()) {
      outflows.push({
        source: "SOLD",
        purity: group.purity,
        metalType: group.metalType,
        fineWeight: Math.round(group.fineWeight * 1000) / 1000,
        count: group.itemCount,
      });
    }

    for (const group of issuesByPurity.values()) {
      outflows.push({
        source: "KARIGAR_ISSUE",
        purity: group.purity,
        fineWeight: Math.round(group.fineWeight * 1000) / 1000,
        count: group.transactionCount,
      });
    }

    // Calculate net movement
    const totalInflow = inflows.reduce((sum, i) => sum + i.fineWeight, 0);
    const totalOutflow = outflows.reduce((sum, o) => sum + o.fineWeight, 0);
    const netMovement = Math.round((totalInflow - totalOutflow) * 1000) / 1000;

    return NextResponse.json({
      period: {
        from: fromDate.toISOString().split("T")[0],
        to: to,
      },
      inflows,
      outflows,
      summary: {
        totalInflow: Math.round(totalInflow * 1000) / 1000,
        totalOutflow: Math.round(totalOutflow * 1000) / 1000,
        netMovement,
      },
    });
  } catch (error) {
    console.error("Failed to generate gold movement report:", error);
    return NextResponse.json(
      { error: "Failed to generate gold movement report" },
      { status: 500 }
    );
  }
}
