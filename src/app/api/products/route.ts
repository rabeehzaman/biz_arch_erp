import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isPriceListEnabled, getPriceListId, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { resolveProductPrices } from "@/lib/price-list/resolve-price";


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

    if (compact) {
      const products = await prisma.product.findMany({
        where: baseWhere,
        select: {
          id: true,
          name: true,
          arabicName: true,
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
            select: {
              id: true,
              componentProductId: true,
              quantity: true,
              componentProduct: {
                select: { id: true, name: true, price: true, cost: true, unit: { select: { id: true, code: true, name: true } } },
              },
            },
          },
          unitConversions: {
            select: {
              id: true,
              unitId: true,
              unit: { select: { id: true, name: true, code: true } },
              conversionFactor: true,
              barcode: true,
              price: true,
              isDefaultUnit: true,
            },
          },
          variants: {
            select: { id: true, name: true, price: true, barcode: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
          jewelleryItem: {
            select: {
              id: true,
              tagNumber: true,
              huidNumber: true,
              metalType: true,
              purity: true,
              grossWeight: true,
              stoneWeight: true,
              netWeight: true,
              fineWeight: true,
              makingChargeType: true,
              makingChargeValue: true,
              wastagePercent: true,
              stoneValue: true,
              costPrice: true,
              status: true,
              categoryId: true,
              category: { select: { name: true } },
            },
          },
          stockLots: stockLotsSelect,
        },
        orderBy: { createdAt: "desc" },
      });

      const productsWithStock = products.map((product) => ({
        ...product,
        availableStock: product.stockLots.reduce(
          (sum, lot) => sum + Number(lot.remainingQuantity),
          0
        ),
      }));

      // Apply price list resolution if enabled
      const userPriceListId = getPriceListId(session);
      if (isPriceListEnabled(session) && userPriceListId) {
        const mapped = productsWithStock.map((p) => ({
          id: p.id,
          price: p.price,
          hasJewelleryItem: !!p.jewelleryItem,
        }));
        const resolved = await resolveProductPrices(mapped, {
          userId: session.user.id,
          userPriceListId,
          organizationId,
        });
        const result = productsWithStock.map((p) => {
          const rp = resolved.get(p.id);
          if (rp && rp.source !== "base") {
            return { ...p, price: rp.price, basePrice: rp.basePrice };
          }
          return { ...p, basePrice: Number(p.price) };
        });
        return NextResponse.json(result);
      }

      return NextResponse.json(productsWithStock);
    }

    const { limit, offset, search } = parsePagination(request);

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
            { barcode: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : baseWhere;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
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
          unitConversions: {
            select: {
              id: true,
              unitId: true,
              unit: { select: { id: true, name: true, code: true } },
              conversionFactor: true,
              barcode: true,
              price: true,
              isDefaultUnit: true,
            },
          },
          variants: {
            select: { id: true, name: true, price: true, barcode: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);

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

    return paginatedResponse(productsWithStock, total, offset + products.length < total);
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
    const { name, description, price, cost, unitId, categoryId, sku, barcode, isService, isImeiTracked, gstRate, hsnCode, weighMachineCode, isBundle, bundleItems, unitConversions, variants, modifiers, arabicName, imageUrl } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    // Check for duplicate product name
    const existingByName = await prisma.product.findFirst({
      where: { organizationId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByName) {
      return NextResponse.json(
        { error: "A product with this name already exists." },
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
    if (!isSaudiEInvoiceEnabled(session) && gstRate !== undefined && gstRate !== null && !VALID_GST_RATES.includes(Number(gstRate))) {
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
          arabicName: arabicName || null,
          description: description || null,
          imageUrl: imageUrl || null,
          price,
          cost: cost ?? 0,
          unitId,
          categoryId: categoryId || null,
          sku: sku || null,
          barcode: barcode || null,
          isService: isService ?? false,
          isImeiTracked: isImeiTracked ?? false,
          isBundle: isBundle ?? false,
          modifiers: Array.isArray(modifiers) ? modifiers.filter(Boolean) : [],
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

      // Create unit conversions if provided
      if (Array.isArray(unitConversions) && unitConversions.length > 0) {
        for (const uc of unitConversions) {
          if (uc.unitId && uc.conversionFactor > 0) {
            await tx.productUnitConversion.create({
              data: {
                productId: newProduct.id,
                unitId: uc.unitId,
                conversionFactor: uc.conversionFactor,
                barcode: uc.barcode || null,
                price: uc.price != null ? uc.price : null,
                isDefaultUnit: uc.isDefaultUnit ?? false,
                organizationId,
              },
            });
          }
        }
      }

      // Create variants if provided
      if (Array.isArray(variants) && variants.length > 0) {
        for (const [idx, v] of variants.entries()) {
          if (v.name && v.price != null) {
            await tx.productVariant.create({
              data: {
                productId: newProduct.id,
                name: v.name,
                price: v.price,
                cost: v.cost ?? 0,
                barcode: v.barcode || null,
                sortOrder: idx,
                organizationId,
              },
            });
          }
        }
      }

      // Re-fetch with all relations included
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
          unitConversions: {
            select: {
              id: true,
              unitId: true,
              unit: { select: { id: true, name: true, code: true } },
              conversionFactor: true,
              barcode: true,
              price: true,
              isDefaultUnit: true,
            },
          },
          variants: {
            select: { id: true, name: true, price: true, barcode: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
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
