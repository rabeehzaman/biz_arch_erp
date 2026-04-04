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
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    // Fetch product cost, price, and default unit conversion
    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: {
        cost: true,
        price: true,
        unitConversions: {
          where: { isDefaultUnit: true },
          select: {
            conversionFactor: true,
            price: true,
            unit: { select: { name: true, code: true } },
          },
          take: 1,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const defaultUc = product.unitConversions[0];
    const factor = defaultUc ? Number(defaultUc.conversionFactor) : 1;
    const displayPrice = defaultUc?.price != null
      ? Number(defaultUc.price)
      : Number(product.price) * factor;
    const displayCost = Number(product.cost) * factor;
    const defaultUnitName = defaultUc?.unit?.name || defaultUc?.unit?.code || null;

    // Recent sales (last 10)
    const recentSales = await prisma.invoiceItem.findMany({
      where: { productId, organizationId },
      select: {
        unitPrice: true,
        discount: true,
        invoice: {
          select: {
            invoiceNumber: true,
            issueDate: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { invoice: { issueDate: "desc" } },
      take: 10,
    });

    // Last sale to specific customer
    let lastSaleToCustomer = null;
    if (customerId) {
      const customerSale = await prisma.invoiceItem.findFirst({
        where: {
          productId,
          organizationId,
          invoice: { customerId },
        },
        select: {
          unitPrice: true,
          discount: true,
          invoice: {
            select: {
              invoiceNumber: true,
              issueDate: true,
            },
          },
        },
        orderBy: { invoice: { issueDate: "desc" } },
      });

      if (customerSale) {
        lastSaleToCustomer = {
          unitPrice: Number(customerSale.unitPrice),
          discount: Number(customerSale.discount),
          date: customerSale.invoice.issueDate,
          invoiceNumber: customerSale.invoice.invoiceNumber,
        };
      }
    }

    // Recent purchases (last 10)
    const recentPurchases = await prisma.purchaseInvoiceItem.findMany({
      where: { productId, organizationId },
      select: {
        unitCost: true,
        discount: true,
        purchaseInvoice: {
          select: {
            purchaseInvoiceNumber: true,
            invoiceDate: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
      take: 10,
    });

    // Compute stats from recent sales
    const salePrices = recentSales.map((s) => Number(s.unitPrice));
    const stats = salePrices.length > 0
      ? {
          avgSalePrice: salePrices.reduce((a, b) => a + b, 0) / salePrices.length,
          minSalePrice: Math.min(...salePrices),
          maxSalePrice: Math.max(...salePrices),
        }
      : { avgSalePrice: 0, minSalePrice: 0, maxSalePrice: 0 };

    return NextResponse.json({
      cost: displayCost,
      currentPrice: displayPrice,
      defaultUnitName,
      lastSaleToCustomer,
      recentSales: recentSales.map((s) => ({
        customerName: s.invoice.customer.name,
        unitPrice: Number(s.unitPrice),
        discount: Number(s.discount),
        date: s.invoice.issueDate,
        invoiceNumber: s.invoice.invoiceNumber,
      })),
      recentPurchases: recentPurchases.map((p) => ({
        supplierName: p.purchaseInvoice.supplier.name,
        unitCost: Number(p.unitCost),
        discount: Number(p.discount),
        date: p.purchaseInvoice.invoiceDate,
        invoiceNumber: p.purchaseInvoice.purchaseInvoiceNumber,
      })),
      stats,
    });
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
