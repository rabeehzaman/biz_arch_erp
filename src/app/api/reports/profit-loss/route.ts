import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { getProfitLossData } from "@/lib/reports/profit-loss";
import { getProfitLossGoldContext } from "@/lib/jewellery/report-gold-context";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const fromDate =
      searchParams.get("fromDate") ||
      new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
    const toDate =
      searchParams.get("toDate") || new Date().toISOString().split("T")[0];

    const data = await getProfitLossData(organizationId, fromDate, toDate);

    // Enrich with gold weight data for jewellery orgs
    if (isJewelleryModuleEnabled(session)) {
      const goldCtx = await getProfitLossGoldContext(organizationId, fromDate, toDate);
      for (const row of [...data.revenue, ...data.expenses]) {
        const annotation = goldCtx.accountAnnotations[row.account.code];
        if (annotation) row.goldAnnotation = annotation;
      }
      data.goldMovement = goldCtx.goldMovement;
    }

    return NextResponse.json({
      fromDate,
      toDate,
      ...data,
    });
  } catch (error) {
    console.error("Failed to generate P&L:", error);
    return NextResponse.json(
      { error: "Failed to generate profit & loss" },
      { status: 500 }
    );
  }
}
