import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";

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

    const order = await prisma.productionOrder.findFirst({
      where: { id, organizationId },
      include: {
        product: { select: { id: true, name: true, sku: true, price: true, cost: true } },
        bom: {
          select: {
            id: true, name: true, version: true, bomType: true, outputQuantity: true,
            processLossPercent: true, totalMaterialCost: true,
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
        },
        consumptions: {
          include: {
            stockLot: { select: { id: true, lotDate: true, unitCost: true, sourceType: true } },
            productionOrderItem: {
              select: { product: { select: { name: true } } },
            },
          },
        },
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        outputWarehouse: { select: { id: true, name: true, code: true } },
        outputLots: {
          select: { id: true, lotDate: true, unitCost: true, initialQuantity: true, remainingQuantity: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch production order:", error);
    return NextResponse.json({ error: "Failed to fetch production order" }, { status: 500 });
  }
}

export async function DELETE(
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

    if (order.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT production orders can be deleted" },
        { status: 400 }
      );
    }

    await prisma.productionOrder.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete production order:", error);
    return NextResponse.json({ error: "Failed to delete production order" }, { status: 500 });
  }
}
