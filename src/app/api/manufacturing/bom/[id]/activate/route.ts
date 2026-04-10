import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { updateBOMCostCache } from "@/lib/manufacturing/cost-rollup";

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

    const bom = await prisma.billOfMaterials.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!bom) {
      return NextResponse.json({ error: "BOM not found" }, { status: 404 });
    }

    if (bom.status === "ACTIVE") {
      return NextResponse.json({ error: "BOM is already active" }, { status: 400 });
    }

    if (bom.status === "ARCHIVED") {
      return NextResponse.json({ error: "Archived BOMs cannot be activated. Create a new version." }, { status: 400 });
    }

    if (bom.items.length === 0) {
      return NextResponse.json({ error: "BOM must have at least one component to activate" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Deactivate any existing active default BOM for same product
      await tx.billOfMaterials.updateMany({
        where: {
          organizationId,
          productId: bom.productId,
          status: "ACTIVE",
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });

      // Activate this BOM
      await tx.billOfMaterials.update({
        where: { id },
        data: { status: "ACTIVE", isDefault: true },
      });
    });

    // Update cached cost (non-blocking)
    updateBOMCostCache(id, organizationId).catch(() => {});

    const updated = await prisma.billOfMaterials.findUnique({
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to activate BOM:", error);
    return NextResponse.json({ error: "Failed to activate BOM" }, { status: 500 });
  }
}
