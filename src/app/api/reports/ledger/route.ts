import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getLedgerData } from "@/lib/reports/ledger";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as
      | "ACCOUNT"
      | "CUSTOMER"
      | "SUPPLIER";
    const id = searchParams.get("id");
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing type or id" },
        { status: 400 }
      );
    }

    const data = await getLedgerData(organizationId, type, id, fromDate, toDate);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch ledger transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch ledger transactions" },
      { status: 500 }
    );
  }
}
