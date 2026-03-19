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

    // Fetch org wastage tolerance setting
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        jewelleryKarigarWastageTolerance: true,
      },
    });

    const wastageTolerance = Number(org?.jewelleryKarigarWastageTolerance ?? 3);

    // Fetch karigars
    const karigarWhere: Record<string, unknown> = {
      organizationId,
      isActive: true,
    };
    if (karigarId) {
      karigarWhere.id = karigarId;
    }

    const karigars = await prisma.karigar.findMany({
      where: karigarWhere,
      select: {
        id: true,
        name: true,
        phone: true,
        specialization: true,
        goldIssuedWeight: true,
        goldReturnedWeight: true,
        scrapReturnedWeight: true,
        wastageAllowancePercent: true,
      },
    });

    if (karigarId && karigars.length === 0) {
      return NextResponse.json(
        { error: "Karigar not found" },
        { status: 404 }
      );
    }

    // Fetch all transactions for these karigars in bulk
    const karigarIds = karigars.map((k) => k.id);

    const transactions = await prisma.karigarTransaction.findMany({
      where: {
        organizationId,
        karigarId: { in: karigarIds },
      },
      select: {
        karigarId: true,
        type: true,
        weight: true,
        purity: true,
        fineWeight: true,
        date: true,
      },
      orderBy: { date: "desc" },
    });

    // Group transactions by karigar
    const txnByKarigar = new Map<
      string,
      Array<{
        type: string;
        weight: number;
        purity: string;
        fineWeight: number;
        date: Date;
      }>
    >();

    for (const txn of transactions) {
      const existing = txnByKarigar.get(txn.karigarId) ?? [];
      existing.push({
        type: txn.type,
        weight: Number(txn.weight),
        purity: txn.purity,
        fineWeight: Number(txn.fineWeight),
        date: txn.date,
      });
      txnByKarigar.set(txn.karigarId, existing);
    }

    // Build reconciliation for each karigar
    const reconciliations = karigars.map((karigar) => {
      const txns = txnByKarigar.get(karigar.id) ?? [];

      let totalIssued = 0;
      let totalReturned = 0;
      let totalScrap = 0;
      let totalWastage = 0;
      let issueCount = 0;
      let returnCount = 0;
      let scrapCount = 0;
      let wastageCount = 0;

      // Also track by purity for detailed breakdown
      const byPurity = new Map<
        string,
        { issued: number; returned: number; scrap: number; wastage: number }
      >();

      for (const txn of txns) {
        let purityGroup = byPurity.get(txn.purity);
        if (!purityGroup) {
          purityGroup = { issued: 0, returned: 0, scrap: 0, wastage: 0 };
          byPurity.set(txn.purity, purityGroup);
        }

        switch (txn.type) {
          case "ISSUE":
            totalIssued += txn.fineWeight;
            issueCount += 1;
            purityGroup.issued += txn.fineWeight;
            break;
          case "RETURN":
            totalReturned += txn.fineWeight;
            returnCount += 1;
            purityGroup.returned += txn.fineWeight;
            break;
          case "SCRAP":
            totalScrap += txn.fineWeight;
            scrapCount += 1;
            purityGroup.scrap += txn.fineWeight;
            break;
          case "WASTAGE":
            totalWastage += txn.fineWeight;
            wastageCount += 1;
            purityGroup.wastage += txn.fineWeight;
            break;
        }
      }

      // Balance = totalIssued - totalReturned - totalScrap - totalWastage
      const balance =
        Math.round((totalIssued - totalReturned - totalScrap - totalWastage) * 1000) /
        1000;

      // Wastage percentage = (totalWastage / totalIssued) * 100
      const wastagePercent =
        totalIssued > 0
          ? Math.round((totalWastage / totalIssued) * 10000) / 100
          : 0;

      // Use karigar's own allowance or the org default
      const karigarAllowance = Number(karigar.wastageAllowancePercent);
      const effectiveTolerance = karigarAllowance > 0 ? karigarAllowance : wastageTolerance;
      const wastageExceeded = wastagePercent > effectiveTolerance;

      // Build purity breakdown
      const purityBreakdown = Array.from(byPurity.entries())
        .map(([purity, data]) => ({
          purity,
          issued: Math.round(data.issued * 1000) / 1000,
          returned: Math.round(data.returned * 1000) / 1000,
          scrap: Math.round(data.scrap * 1000) / 1000,
          wastage: Math.round(data.wastage * 1000) / 1000,
          balance:
            Math.round(
              (data.issued - data.returned - data.scrap - data.wastage) * 1000
            ) / 1000,
        }))
        .sort((a, b) => a.purity.localeCompare(b.purity));

      return {
        karigarId: karigar.id,
        karigarName: karigar.name,
        phone: karigar.phone,
        specialization: karigar.specialization,
        summary: {
          totalIssued: Math.round(totalIssued * 1000) / 1000,
          totalReturned: Math.round(totalReturned * 1000) / 1000,
          totalScrap: Math.round(totalScrap * 1000) / 1000,
          totalWastage: Math.round(totalWastage * 1000) / 1000,
          balance,
          issueCount,
          returnCount,
          scrapCount,
          wastageCount,
        },
        wastagePercent,
        wastageTolerance: effectiveTolerance,
        wastageExceeded,
        purityBreakdown,
        lastTransactionDate: txns.length > 0 ? txns[0].date : null,
      };
    });

    // Sort: karigars with exceeded wastage first, then by balance descending
    reconciliations.sort((a, b) => {
      if (a.wastageExceeded !== b.wastageExceeded) {
        return a.wastageExceeded ? -1 : 1;
      }
      return b.summary.balance - a.summary.balance;
    });

    return NextResponse.json({
      reconciliations,
      orgWastageTolerance: wastageTolerance,
      karigarCount: reconciliations.length,
      alerts: reconciliations.filter((r) => r.wastageExceeded).length,
    });
  } catch (error) {
    console.error("Failed to generate karigar reconciliation report:", error);
    return NextResponse.json(
      { error: "Failed to generate karigar reconciliation report" },
      { status: 500 }
    );
  }
}
