import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getCashBankBookData } from "@/lib/reports/cash-bank-book";

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
    const accountId = searchParams.get("accountId") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    const data = await getCashBankBookData(
      organizationId,
      "CASH",
      fromDate,
      toDate,
      accountId,
      branchId
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to generate cash book:", error);
    return NextResponse.json(
      { error: "Failed to generate cash book report" },
      { status: 500 }
    );
  }
}
