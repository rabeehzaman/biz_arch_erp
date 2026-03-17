import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getProfitLossData } from "@/lib/reports/profit-loss";

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
