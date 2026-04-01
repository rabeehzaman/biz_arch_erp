import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { getBalanceSheetData } from "@/lib/reports/balance-sheet";
import { getBalanceSheetGoldContext } from "@/lib/jewellery/report-gold-context";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const asOfDate =
      searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];
    const branchId = searchParams.get("branchId") || undefined;

    const data = await getBalanceSheetData(organizationId, asOfDate, branchId);

    // Enrich with gold weight data for jewellery orgs
    if (isJewelleryModuleEnabled(session)) {
      const book1460 = data.assets.find((a) => a.account.code === "1460")?.balance ?? 0;
      const book1465 = data.assets.find((a) => a.account.code === "1465")?.balance ?? 0;

      const goldCtx = await getBalanceSheetGoldContext(organizationId, asOfDate, {
        account1460: book1460,
        account1465: book1465,
      });

      for (const row of data.assets) {
        const annotation = goldCtx.accountAnnotations[row.account.code];
        if (annotation) row.goldAnnotation = annotation;
      }
      data.goldPosition = goldCtx.goldPosition;
    }

    return NextResponse.json({
      asOfDate,
      ...data,
    });
  } catch (error) {
    console.error("Failed to generate balance sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate balance sheet" },
      { status: 500 }
    );
  }
}
