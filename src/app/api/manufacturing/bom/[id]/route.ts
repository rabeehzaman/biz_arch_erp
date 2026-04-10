import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { updateBOMSchema } from "@/lib/validations/manufacturing";
import { validateNoCycle } from "@/lib/manufacturing/bom-validation";

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

    const bom = await prisma.billOfMaterials.findFirst({
      where: { id, organizationId },
      include: {
        product: { select: { id: true, name: true, sku: true, price: true, cost: true } },
        unit: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, cost: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { productionOrders: true } },
      },
    });

    if (!bom) {
      return NextResponse.json({ error: "BOM not found" }, { status: 404 });
    }

    return NextResponse.json(bom);
  } catch (error) {
    console.error("Failed to fetch BOM:", error);
    return NextResponse.json({ error: "Failed to fetch BOM" }, { status: 500 });
  }
}

export async function PUT(
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

    const existing = await prisma.billOfMaterials.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { productionOrders: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "BOM not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT BOMs can be edited. Create a new version instead." },
        { status: 400 }
      );
    }

    if (existing._count.productionOrders > 0) {
      return NextResponse.json(
        { error: "BOM is referenced by production orders and cannot be edited" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = updateBOMSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Circular reference detection if items changed
    if (data.items && data.items.length > 0) {
      const componentIds = data.items.map((i) => i.productId);
      try {
        await validateNoCycle(organizationId, existing.productId, componentIds);
      } catch (err) {
        return NextResponse.json(
          { error: (err as Error).message },
          { status: 400 }
        );
      }
    }

    const bom = await prisma.$transaction(async (tx) => {
      // Update BOM header
      const updated = await tx.billOfMaterials.update({
        where: { id },
        data: {
          name: data.name,
          bomType: data.bomType,
          outputQuantity: data.outputQuantity,
          autoConsumeOnSale: data.autoConsumeOnSale,
          consumptionPolicy: data.consumptionPolicy,
          processLossPercent: data.processLossPercent,
          unitId: data.unitId ?? undefined,
          notes: data.notes ?? undefined,
        },
      });

      // Replace items if provided
      if (data.items && data.items.length > 0) {
        await tx.bOMItem.deleteMany({ where: { bomId: id } });
        await tx.bOMItem.createMany({
          data: data.items.map((item, index) => ({
            bomId: id,
            organizationId,
            productId: item.productId,
            quantity: item.quantity,
            unitId: item.unitId ?? null,
            wastagePercent: item.wastagePercent ?? 0,
            issueMethod: item.issueMethod ?? "BACKFLUSH",
            isPhantom: item.isPhantom ?? false,
            sortOrder: item.sortOrder ?? index,
            notes: item.notes ?? null,
          })),
        });
      }

      return tx.billOfMaterials.findUnique({
        where: { id },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    });

    return NextResponse.json(bom);
  } catch (error) {
    console.error("Failed to update BOM:", error);
    return NextResponse.json({ error: "Failed to update BOM" }, { status: 500 });
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

    const existing = await prisma.billOfMaterials.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { productionOrders: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "BOM not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT BOMs can be deleted. Archive it instead." },
        { status: 400 }
      );
    }

    if (existing._count.productionOrders > 0) {
      return NextResponse.json(
        { error: "BOM is referenced by production orders and cannot be deleted" },
        { status: 400 }
      );
    }

    await prisma.billOfMaterials.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete BOM:", error);
    return NextResponse.json({ error: "Failed to delete BOM" }, { status: 500 });
  }
}
