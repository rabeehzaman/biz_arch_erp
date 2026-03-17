import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getCustomerBalancesData } from "@/lib/reports/customer-balances";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const data = await getCustomerBalancesData(organizationId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching customer balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer balances" },
      { status: 500 }
    );
  }
}
