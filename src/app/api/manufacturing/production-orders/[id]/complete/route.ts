import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { completeProductionSchema } from "@/lib/validations/manufacturing";
import { completeProductionOrder } from "@/lib/manufacturing/production";

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

    const body = await request.json();
    const parsed = completeProductionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return completeProductionOrder(
        id,
        parsed.data.completionQuantity,
        parsed.data.scrapQuantity,
        tx,
        organizationId
      );
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete production order";
    console.error("Production completion error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
