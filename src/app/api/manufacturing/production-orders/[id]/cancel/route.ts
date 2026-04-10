import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { cancelProductionOrder } from "@/lib/manufacturing/production";

export async function POST(
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

    await prisma.$transaction(async (tx) => {
      await cancelProductionOrder(id, tx, organizationId);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel production order";
    console.error("Production cancellation error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
