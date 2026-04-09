import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import { resolveProductPrices } from "@/lib/price-list/resolve-price";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    // Check org settings (Saudi VAT + price list enabled)
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { saudiEInvoiceEnabled: true, isPriceListEnabled: true },
    });
    const isSaudi = org?.saudiEInvoiceEnabled || false;

    const products = await prisma.product.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true } },
        unit: { select: { code: true, name: true } },
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
          where: { isActive: true },
          select: { id: true, name: true, price: true, barcode: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
        bundleItems: {
          include: {
            componentProduct: {
              select: {
                id: true,
                name: true,
                unit: { select: { code: true, name: true } },
              },
            },
          },
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
            category: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate stock quantities in a single SQL query instead of fetching all lot rows
    const allProductIds = new Set<string>();
    for (const p of products) {
      allProductIds.add(p.id);
      if (p.isBundle) {
        for (const bi of p.bundleItems) {
          allProductIds.add(bi.componentProductId);
        }
      }
    }
    const stockAggregation: { productId: string; stock: number }[] =
      allProductIds.size > 0
        ? await prisma.$queryRawUnsafe(
            `SELECT "productId", SUM("remainingQuantity")::float as stock
             FROM "stock_lots"
             WHERE "productId" = ANY($1) AND "remainingQuantity" > 0
             GROUP BY "productId"`,
            [...allProductIds]
          )
        : [];
    const stockMap = new Map(stockAggregation.map(r => [r.productId, r.stock]));

    // Resolve price list prices if enabled
    // Fetch the assignment fresh from DB instead of relying on the JWT-cached value,
    // so changes take effect without requiring the user to re-login.
    let resolvedPrices: Map<string, { price: number; basePrice: number; source: string }> | null = null;
    if (org?.isPriceListEnabled) {
      const assignment = await prisma.priceListAssignment.findUnique({
        where: { userId: session.user.id },
        select: { priceListId: true },
      });
      const userPriceListId = assignment?.priceListId ?? null;
      if (userPriceListId) {
        const mapped = products.map((p) => ({
          id: p.id,
          price: p.price,
          hasJewelleryItem: !!p.jewelleryItem,
        }));
        resolvedPrices = await resolveProductPrices(mapped, {
          userId: session.user.id,
          userPriceListId,
          organizationId,
        });
      }
    }

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl || null,
      sku: p.sku,
      barcode: p.barcode,
      price: resolvedPrices && resolvedPrices.get(p.id)?.source !== "base"
        ? resolvedPrices.get(p.id)!.price
        : p.price,
      gstRate: isSaudi ? SAUDI_VAT_RATE : (Number(p.gstRate) || 0),
      hsnCode: p.hsnCode || null,
      categoryId: p.categoryId,
      category: p.category,
      unit: p.unit,
      isService: p.isService,
      isBundle: p.isBundle,
      weighMachineCode: p.weighMachineCode || null,
      stockQuantity: p.isBundle
        ? null // Bundles don't have their own stock
        : (stockMap.get(p.id) ?? 0),
      bundleItems: p.isBundle
        ? p.bundleItems.map((bi) => ({
          componentProductId: bi.componentProductId,
          componentName: bi.componentProduct.name,
          componentUnit: bi.componentProduct.unit,
          quantity: Number(bi.quantity),
          componentStock: stockMap.get(bi.componentProductId) ?? 0,
        }))
        : [],
      unitConversions: (p.unitConversions || []).map((uc) => ({
        id: uc.id,
        unitId: uc.unitId,
        unit: uc.unit,
        conversionFactor: Number(uc.conversionFactor),
        barcode: uc.barcode,
        price: uc.price != null ? Number(uc.price) : null,
        isDefaultUnit: uc.isDefaultUnit,
      })),
      modifiers: p.modifiers || [],
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        name: v.name,
        price: Number(v.price),
        barcode: v.barcode,
      })),
      jewelleryItem: p.jewelleryItem ? {
        id: p.jewelleryItem.id,
        tagNumber: p.jewelleryItem.tagNumber,
        huidNumber: p.jewelleryItem.huidNumber,
        metalType: p.jewelleryItem.metalType,
        purity: p.jewelleryItem.purity,
        grossWeight: Number(p.jewelleryItem.grossWeight),
        stoneWeight: Number(p.jewelleryItem.stoneWeight),
        netWeight: Number(p.jewelleryItem.netWeight),
        fineWeight: Number(p.jewelleryItem.fineWeight),
        makingChargeType: p.jewelleryItem.makingChargeType,
        makingChargeValue: Number(p.jewelleryItem.makingChargeValue),
        wastagePercent: Number(p.jewelleryItem.wastagePercent),
        stoneValue: Number(p.jewelleryItem.stoneValue),
        costPrice: Number(p.jewelleryItem.costPrice),
        status: p.jewelleryItem.status,
        categoryName: p.jewelleryItem.category?.name || null,
      } : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch POS products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

