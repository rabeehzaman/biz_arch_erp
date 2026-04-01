import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getAPAgingData } from "@/lib/reports/ap-aging";

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

    const data = await getAPAgingData(organizationId, asOfDate, branchId);

    return NextResponse.json({
      asOfDate,
      suppliers: data.suppliers,
      totals: data.totals,
    });
  } catch (error) {
    console.error("Failed to generate AP aging report:", error);
    return NextResponse.json(
      { error: "Failed to generate AP aging report" },
      { status: 500 }
    );
  }
}
