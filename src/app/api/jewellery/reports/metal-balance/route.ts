import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

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
    const karigarId = searchParams.get("karigarId");
    const metalType = searchParams.get("metalType");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build filter
    const where: any = { organizationId };
    if (karigarId) where.karigarId = karigarId;
    if (metalType) where.metalType = metalType;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    // Aggregate by purity and direction
    const entries = await prisma.metalLedgerEntry.groupBy({
      by: ["metalType", "purity", "direction"],
      where,
      _sum: { fineWeight: true, grossWeight: true },
      _count: true,
    });

    // Build balance by purity
    const balanceMap = new Map<string, {
      metalType: string;
      purity: string;
      inflowFineWeight: number;
      outflowFineWeight: number;
      inflowGrossWeight: number;
      outflowGrossWeight: number;
      inflowCount: number;
      outflowCount: number;
    }>();

    for (const entry of entries) {
      const key = `${entry.metalType}_${entry.purity}`;
      if (!balanceMap.has(key)) {
        balanceMap.set(key, {
          metalType: entry.metalType,
          purity: entry.purity,
          inflowFineWeight: 0,
          outflowFineWeight: 0,
          inflowGrossWeight: 0,
          outflowGrossWeight: 0,
          inflowCount: 0,
          outflowCount: 0,
        });
      }
      const balance = balanceMap.get(key)!;
      if (entry.direction === "INFLOW") {
        balance.inflowFineWeight += Number(entry._sum.fineWeight || 0);
        balance.inflowGrossWeight += Number(entry._sum.grossWeight || 0);
        balance.inflowCount += entry._count;
      } else {
        balance.outflowFineWeight += Number(entry._sum.fineWeight || 0);
        balance.outflowGrossWeight += Number(entry._sum.grossWeight || 0);
        balance.outflowCount += entry._count;
      }
    }

    const balances = Array.from(balanceMap.values()).map((b) => ({
      ...b,
      balanceFineWeight: Math.round((b.inflowFineWeight - b.outflowFineWeight) * 1000) / 1000,
      balanceGrossWeight: Math.round((b.inflowGrossWeight - b.outflowGrossWeight) * 1000) / 1000,
    }));

    // Breakdown by source type
    const sourceBreakdown = await prisma.metalLedgerEntry.groupBy({
      by: ["sourceType", "direction"],
      where,
      _sum: { fineWeight: true },
      _count: true,
    });

    // Summary totals
    const totalInflow = balances.reduce((s, b) => s + b.inflowFineWeight, 0);
    const totalOutflow = balances.reduce((s, b) => s + b.outflowFineWeight, 0);

    // Karigar balances (if no specific karigar filter)
    let karigarBalances: any[] = [];
    if (!karigarId) {
      const karigarEntries = await prisma.metalLedgerEntry.groupBy({
        by: ["karigarId", "direction"],
        where: {
          organizationId,
          karigarId: { not: null },
          ...(from || to ? { date: where.date } : {}),
        },
        _sum: { fineWeight: true },
      });

      const karigarMap = new Map<string, { issued: number; returned: number }>();
      for (const e of karigarEntries) {
        if (!e.karigarId) continue;
        if (!karigarMap.has(e.karigarId)) karigarMap.set(e.karigarId, { issued: 0, returned: 0 });
        const kb = karigarMap.get(e.karigarId)!;
        if (e.direction === "OUTFLOW") kb.issued += Number(e._sum.fineWeight || 0);
        else kb.returned += Number(e._sum.fineWeight || 0);
      }

      if (karigarMap.size > 0) {
        const karigars = await prisma.karigar.findMany({
          where: { id: { in: Array.from(karigarMap.keys()) } },
          select: { id: true, name: true },
        });
        const nameMap = new Map(karigars.map((k) => [k.id, k.name]));

        karigarBalances = Array.from(karigarMap.entries()).map(([id, bal]) => ({
          karigarId: id,
          karigarName: nameMap.get(id) || "Unknown",
          issuedFineWeight: Math.round(bal.issued * 1000) / 1000,
          returnedFineWeight: Math.round(bal.returned * 1000) / 1000,
          balanceFineWeight: Math.round((bal.issued - bal.returned) * 1000) / 1000,
        })).sort((a, b) => b.balanceFineWeight - a.balanceFineWeight);
      }
    }

    return NextResponse.json({
      balances,
      sourceBreakdown: sourceBreakdown.map((s) => ({
        sourceType: s.sourceType,
        direction: s.direction,
        fineWeight: Number(s._sum.fineWeight || 0),
        count: s._count,
      })),
      summary: {
        totalInflowFineWeight: Math.round(totalInflow * 1000) / 1000,
        totalOutflowFineWeight: Math.round(totalOutflow * 1000) / 1000,
        netBalanceFineWeight: Math.round((totalInflow - totalOutflow) * 1000) / 1000,
      },
      karigarBalances,
    });
  } catch (error) {
    console.error("Failed to generate metal balance report:", error);
    return NextResponse.json(
      { error: "Failed to generate metal balance report" },
      { status: 500 }
    );
  }
}
