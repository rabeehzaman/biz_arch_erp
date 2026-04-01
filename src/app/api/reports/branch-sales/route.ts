import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getBranchSalesData } from "@/lib/reports/branch-sales";

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
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0];
    const toDate =
      searchParams.get("toDate") || new Date().toISOString().split("T")[0];

    const branchId = searchParams.get("branchId") || undefined;
    const data = await getBranchSalesData(organizationId, fromDate, toDate, branchId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to generate branch sales report:", error);
    return NextResponse.json(
      { error: "Failed to generate branch sales report" },
      { status: 500 }
    );
  }
}
