import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";
import { createBOMSchema } from "@/lib/validations/manufacturing";
import { validateNoCycle } from "@/lib/manufacturing/bom-validation";
import { updateBOMCostCache } from "@/lib/manufacturing/cost-rollup";

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
    const productId = searchParams.get("productId");
    const bomType = searchParams.get("bomType");

    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (bomType) where.bomType = bomType;

    const boms = await prisma.billOfMaterials.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        unit: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { productionOrders: true } },
      },
    });

    return NextResponse.json(boms);
  } catch (error) {
    console.error("Failed to fetch BOMs:", error);
    return NextResponse.json({ error: "Failed to fetch BOMs" }, { status: 500 });
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
    const parsed = createBOMSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Validate product exists and belongs to org
    const product = await prisma.product.findFirst({
      where: { id: data.productId, organizationId },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Circular reference detection
    const componentIds = data.items.map((i) => i.productId);
    try {
      await validateNoCycle(organizationId, data.productId, componentIds);
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 }
      );
    }

    // Determine next version number
    const latestBom = await prisma.billOfMaterials.findFirst({
      where: { organizationId, productId: data.productId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latestBom?.version ?? 0) + 1;

    const bom = await prisma.billOfMaterials.create({
      data: {
        organizationId,
        productId: data.productId,
        name: data.name,
        version: nextVersion,
        bomType: data.bomType,
        outputQuantity: data.outputQuantity,
        autoConsumeOnSale: data.autoConsumeOnSale,
        consumptionPolicy: data.consumptionPolicy,
        processLossPercent: data.processLossPercent,
        unitId: data.unitId ?? null,
        notes: data.notes ?? null,
        items: {
          create: data.items.map((item, index) => ({
            organizationId,
            productId: item.productId,
            quantity: item.quantity,
            unitId: item.unitId ?? null,
            wastagePercent: item.wastagePercent,
            issueMethod: item.issueMethod,
            isPhantom: item.isPhantom,
            sortOrder: item.sortOrder ?? index,
            notes: item.notes ?? null,
          })),
        },
      },
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

    return NextResponse.json(bom, { status: 201 });
  } catch (error) {
    console.error("Failed to create BOM:", error);
    return NextResponse.json({ error: "Failed to create BOM" }, { status: 500 });
  }
}
