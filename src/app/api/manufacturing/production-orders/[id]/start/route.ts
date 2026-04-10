import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";

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

    const order = await prisma.productionOrder.findFirst({
      where: { id, organizationId },
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    if (order.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: `Cannot start: order is ${order.status}. Confirm it first.` },
        { status: 400 }
      );
    }

    const updated = await prisma.productionOrder.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      include: {
        product: { select: { id: true, name: true } },
        bom: { select: { id: true, name: true, version: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to start production order:", error);
    return NextResponse.json({ error: "Failed to start production order" }, { status: 500 });
  }
}
