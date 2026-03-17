import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getBalanceSheetData } from "@/lib/reports/balance-sheet";

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

    const data = await getBalanceSheetData(organizationId, asOfDate);

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
