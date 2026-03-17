import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getSupplierBalancesData } from "@/lib/reports/supplier-balances";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const data = await getSupplierBalancesData(organizationId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching supplier balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier balances" },
      { status: 500 }
    );
  }
}
