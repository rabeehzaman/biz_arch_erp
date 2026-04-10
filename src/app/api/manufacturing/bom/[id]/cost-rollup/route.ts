import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { calculateBOMCostRollup } from "@/lib/manufacturing/cost-rollup";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isManufacturingModuleEnabled(session)) {
      return NextResponse.json({ error: "Manufacturing module not enabled" }, { status: 403 });
    }
    const organizationId = getOrgId(session);
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouseId");

    const result = await calculateBOMCostRollup(id, organizationId, warehouseId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate cost rollup";
    console.error("Cost rollup error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
