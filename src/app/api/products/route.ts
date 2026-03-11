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
    const warehouseId = searchParams.get("warehouseId");
    const compact = searchParams.get("compact") === "true";

    const baseWhere = {
      organizationId,
      ...(excludeServices ? { isService: false } : {}),
    };

    const stockLotsSelect = {
      where: {
        remainingQuantity: { gt: 0 },
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: {
        remainingQuantity: true,
      },
    };

    const products = compact
      ? await prisma.product.findMany({
        where: {
          ...baseWhere,
        },
        select: {
          id: true,
          name: true,
          price: true,
          cost: true,
          unitId: true,
          unit: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          sku: true,
          barcode: true,
          isService: true,
          isImeiTracked: true,
          gstRate: true,
          hsnCode: true,
          weighMachineCode: true,
          isBundle: true,
          bundleItems: {
            include: {
              componentProduct: {
                select: { id: true, name: true, price: true, cost: true, unit: { select: { id: true, code: true, name: true } } },
              },
            },
          },
          stockLots: stockLotsSelect,
        },
        orderBy: { createdAt: "desc" },
      })
      : await prisma.product.findMany({
        where: {
          ...baseWhere,
        },
        include: {
          unit: true,
          stockLots: stockLotsSelect,
          bundleItems: {
            include: {
              componentProduct: {
                select: { id: true, name: true, price: true, cost: true, unitId: true, unit: { select: { id: true, code: true, name: true } } },
              },
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
    const { name, description, price, cost, unitId, categoryId, sku, barcode, isService, isImeiTracked, gstRate, hsnCode, weighMachineCode, isBundle, bundleItems } = body;

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

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          organizationId,
          name,
          description: description || null,
          price,
          cost: cost ?? 0,
          unitId,
          categoryId: categoryId || null,
          sku: sku || null,
          barcode: barcode || null,
          isService: isService ?? false,
          isImeiTracked: isImeiTracked ?? false,
          isBundle: isBundle ?? false,
          weighMachineCode: weighMachineCode || null,
          hsnCode: hsnCode || null,
          gstRate: gstRate ?? 0,
        },
        include: {
          unit: true,
        },
      });

      // Create bundle items if this is a bundle product
      if (isBundle && Array.isArray(bundleItems) && bundleItems.length > 0) {
        for (const bi of bundleItems) {
          if (bi.componentProductId && bi.quantity > 0) {
            await tx.productBundleItem.create({
              data: {
                bundleProductId: newProduct.id,
                componentProductId: bi.componentProductId,
                quantity: bi.quantity,
                organizationId,
              },
            });
          }
        }
      }

      // Re-fetch with bundle items included
      const fullProduct = await tx.product.findUnique({
        where: { id: newProduct.id },
        include: {
          unit: true,
          bundleItems: {
            include: {
              componentProduct: {
                select: { id: true, name: true, price: true, cost: true, unit: { select: { id: true, code: true, name: true } } },
              },
            },
          },
        },
      });

      return fullProduct;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create product:", error);

    let errorMessage = "Failed to create product";
    let statusCode = 500;

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      statusCode = 400;
      errorMessage = "A product with this SKU or Barcode already exists.";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
