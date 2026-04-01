import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getGSTDetailData } from "@/lib/reports/gst-detail";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const fromDate =
      searchParams.get("from") ||
      new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
    const toDate =
      searchParams.get("to") || new Date().toISOString().split("T")[0];
    const branchId = searchParams.get("branchId") || undefined;

    const data = await getGSTDetailData(organizationId, fromDate, toDate, branchId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to generate GST detail report:", error);
    return NextResponse.json(
      { error: "Failed to generate GST detail report" },
      { status: 500 }
    );
  }
}
