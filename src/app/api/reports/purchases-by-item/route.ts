import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getPurchasesByItemData } from "@/lib/reports/purchases-by-item";

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
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const toDate =
      searchParams.get("toDate") || new Date().toISOString().split("T")[0];

    const data = await getPurchasesByItemData(organizationId, fromDate, toDate);

    return NextResponse.json({
      fromDate,
      toDate,
      ...data,
    });
  } catch (error) {
    console.error("Failed to generate purchases by item report:", error);
    return NextResponse.json(
      { error: "Failed to generate purchases by item report" },
      { status: 500 }
    );
  }
}
