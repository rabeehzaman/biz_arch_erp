import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { createProductionOrderSchema } from "@/lib/validations/manufacturing";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { toMidnightUTC } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isManufacturingModuleEnabled(session)) {
      return NextResponse.json({ error: "Manufacturing module not enabled" }, { status: 403 });
    }
    const organizationId = getOrgId(session);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;

    const orders = await prisma.productionOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        bom: { select: { id: true, name: true, version: true, bomType: true } },
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        outputWarehouse: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Failed to fetch production orders:", error);
    return NextResponse.json({ error: "Failed to fetch production orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isManufacturingModuleEnabled(session)) {
      return NextResponse.json({ error: "Manufacturing module not enabled" }, { status: 403 });
    }
    const organizationId = getOrgId(session);

    const body = await request.json();
    const parsed = createProductionOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Validate BOM exists, is active, and belongs to org
    const bom = await prisma.billOfMaterials.findFirst({
      where: { id: data.bomId, organizationId, status: "ACTIVE" },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!bom) {
      return NextResponse.json({ error: "Active BOM not found" }, { status: 404 });
    }

    // Generate auto-number
    const productionNumber = await generateAutoNumber(
      prisma.productionOrder as never,
      "productionNumber",
      "MFG",
      organizationId
    );

    // Create production order with items derived from BOM
    const bomOutputQty = Number(bom.outputQuantity);
    const plannedQty = data.plannedQuantity;

    const order = await prisma.productionOrder.create({
      data: {
        productionNumber,
        organizationId,
        bomId: bom.id,
        productId: bom.productId,
        plannedQuantity: plannedQty,
        plannedDate: data.plannedDate ? toMidnightUTC(new Date(data.plannedDate)) : null,
        sourceWarehouseId: data.sourceWarehouseId ?? null,
        outputWarehouseId: data.outputWarehouseId ?? null,
        notes: data.notes ?? null,
        items: {
          create: bom.items.map((bomItem) => ({
            organizationId,
            productId: bomItem.productId,
            requiredQuantity: (Number(bomItem.quantity) / bomOutputQty) * plannedQty * (1 + Number(bomItem.wastagePercent) / 100),
            issueMethod: bomItem.issueMethod,
            unitId: bomItem.unitId,
          })),
        },
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        bom: { select: { id: true, name: true, version: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        outputWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Failed to create production order:", error);
    return NextResponse.json({ error: "Failed to create production order" }, { status: 500 });
  }
}
