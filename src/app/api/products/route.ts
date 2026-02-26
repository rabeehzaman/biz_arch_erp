import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const excludeServices = searchParams.get("excludeServices") === "true";

    const products = await prisma.product.findMany({
      where: {
        organizationId,
        ...(excludeServices ? { isService: false } : {})
      },
      include: {
        unit: true,
        stockLots: {
          where: {
            remainingQuantity: { gt: 0 },
          },
          select: {
            remainingQuantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate available stock for each product
    const productsWithStock = products.map((product) => {
      const availableStock = product.stockLots.reduce(
        (sum, lot) => sum + Number(lot.remainingQuantity),
        0
      );
      return {
        ...product,
        availableStock,
      };
    });

    return NextResponse.json(productsWithStock);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { name, description, price, unitId, sku, barcode, isService, gstRate, hsnCode } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit is required" },
        { status: 400 }
      );
    }

    const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
    if (gstRate !== undefined && gstRate !== null && !VALID_GST_RATES.includes(Number(gstRate))) {
      return NextResponse.json(
        { error: `Invalid GST rate: ${gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        organizationId,
        name,
        description: description || null,
        price,
        unitId,
        sku: sku || null,
        barcode: barcode || null,
        isService: isService ?? false,
        hsnCode: hsnCode || null,
        gstRate: gstRate ?? 0,
      },
      include: {
        unit: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
