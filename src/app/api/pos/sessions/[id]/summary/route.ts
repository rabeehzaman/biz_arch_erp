import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getPOSSessionReportData } from "@/lib/pos/session-summary";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const reportData = await getPOSSessionReportData(organizationId, id);
    if (!reportData) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...reportData,
      topProducts: reportData.soldProducts.slice(0, 10),
    });
  } catch (error) {
    console.error("Failed to fetch POS session summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS session summary" },
      { status: 500 }
    );
  }
}
