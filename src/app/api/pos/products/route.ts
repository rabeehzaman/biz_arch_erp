import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    // Check if org uses Saudi VAT
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { saudiEInvoiceEnabled: true },
    });
    const isSaudi = org?.saudiEInvoiceEnabled || false;

    const products = await prisma.product.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true } },
        unit: { select: { code: true, name: true } },
        stockLots: {
          where: { remainingQuantity: { gt: 0 } },
          select: { remainingQuantity: true },
        },
        bundleItems: {
          include: {
            componentProduct: {
              select: {
                id: true,
                name: true,
                unit: { select: { code: true, name: true } },
                stockLots: {
                  where: { remainingQuantity: { gt: 0 } },
                  select: { remainingQuantity: true },
                },
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

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: p.price,
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
        : p.stockLots.reduce(
          (sum, lot) => sum + Number(lot.remainingQuantity),
          0
        ),
      bundleItems: p.isBundle
        ? p.bundleItems.map((bi) => ({
          componentProductId: bi.componentProductId,
          componentName: bi.componentProduct.name,
          componentUnit: bi.componentProduct.unit,
          quantity: Number(bi.quantity),
          componentStock: bi.componentProduct.stockLots.reduce(
            (sum, lot) => sum + Number(lot.remainingQuantity),
            0
          ),
        }))
        : [],
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

