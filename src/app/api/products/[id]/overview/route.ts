import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    // Run all queries in parallel
    const [
      product,
      stockLots,
      salesInvoiceItemCount,
      purchaseInvoiceItemCount,
      openingStockCount,
      lastSale,
      lastPurchase,
    ] = await Promise.all([
      // 1. Fetch product with relations
      prisma.product.findFirst({
        where: { id, organizationId },
        include: {
          category: { select: { id: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          unitConversions: {
            select: {
              unitId: true,
              unit: { select: { name: true, code: true } },
              conversionFactor: true,
              price: true,
              isDefaultUnit: true,
            },
          },
          bundleItems: {
            include: {
              componentProduct: {
                select: {
                  id: true,
                  name: true,
                  unit: { select: { code: true } },
                },
              },
            },
          },
        },
      }),
      // 2. Fetch stock lots with remaining quantity > 0
      prisma.stockLot.findMany({
        where: {
          productId: id,
          organizationId,
          remainingQuantity: { gt: 0 },
        },
        select: {
          remainingQuantity: true,
          unitCost: true,
          warehouseId: true,
          warehouse: { select: { name: true } },
        },
      }),
      // 3. Count sales invoice items
      prisma.invoiceItem.count({
        where: { productId: id, organizationId },
      }),
      // 4. Count purchase invoice items
      prisma.purchaseInvoiceItem.count({
        where: { productId: id, organizationId },
      }),
      // 5. Count opening stocks
      prisma.openingStock.count({
        where: { productId: id, organizationId },
      }),
      // 6. Last sale date
      prisma.invoiceItem.findFirst({
        where: { productId: id, organizationId },
        orderBy: { invoice: { issueDate: "desc" } },
        select: { invoice: { select: { issueDate: true } } },
      }),
      // 7. Last purchase date
      prisma.purchaseInvoiceItem.findFirst({
        where: { productId: id, organizationId },
        orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
        select: {
          purchaseInvoice: { select: { invoiceDate: true } },
        },
      }),
    ]);

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Aggregate stock by warehouse in-memory
    const byWarehouse: Record<
      string,
      { warehouseName: string; quantity: number; value: number }
    > = {};
    for (const lot of stockLots) {
      const key = lot.warehouseId || "default";
      if (!byWarehouse[key]) {
        byWarehouse[key] = {
          warehouseName: lot.warehouse?.name || "Default",
          quantity: 0,
          value: 0,
        };
      }
      byWarehouse[key].quantity += Number(lot.remainingQuantity);
      byWarehouse[key].value +=
        Number(lot.remainingQuantity) * Number(lot.unitCost);
    }

    const totalOnHand = Object.values(byWarehouse).reduce(
      (sum, w) => sum + w.quantity,
      0
    );
    const totalValue = Object.values(byWarehouse).reduce(
      (sum, w) => sum + w.value,
      0
    );

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        cost: Number(product.cost),
        gstRate: Number(product.gstRate),
        unitConversions: product.unitConversions.map((uc) => ({
          unitId: uc.unitId,
          unit: uc.unit,
          conversionFactor: Number(uc.conversionFactor),
          price: uc.price != null ? Number(uc.price) : null,
          isDefaultUnit: uc.isDefaultUnit,
        })),
        bundleItems: product.bundleItems.map((bi) => ({
          ...bi,
          quantity: Number(bi.quantity),
        })),
      },
      stock: {
        totalOnHand,
        totalValue,
        byWarehouse: Object.entries(byWarehouse).map(([warehouseId, data]) => ({
          warehouseId,
          warehouseName: data.warehouseName,
          quantity: data.quantity,
          value: data.value,
        })),
      },
      counts: {
        salesInvoiceItems: salesInvoiceItemCount,
        purchaseInvoiceItems: purchaseInvoiceItemCount,
        openingStocks: openingStockCount,
      },
      lastSaleDate: lastSale?.invoice?.issueDate?.toISOString() ?? null,
      lastPurchaseDate:
        lastPurchase?.purchaseInvoice?.invoiceDate?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch product overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch product overview" },
      { status: 500 }
    );
  }
}
