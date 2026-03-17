import prisma from "@/lib/prisma";

export interface SalesByItemRow {
  productId: string;
  productName: string;
  sku: string | null;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface SalesByItemData {
  rows: SalesByItemRow[];
  totals: {
    qtySold: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  };
}

export async function getSalesByItemData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<SalesByItemData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      organizationId,
      invoice: {
        issueDate: { gte: from, lte: to },
      },
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
      invoice: {
        select: { issueDate: true },
      },
    },
  });

  // Group by productId
  const productMap = new Map<
    string,
    { productName: string; sku: string | null; qtySold: number; revenue: number; cost: number }
  >();

  for (const item of invoiceItems) {
    const productId = item.productId || item.id; // fallback for non-product items
    const productName = item.product?.name || item.description;
    const sku = item.product?.sku || null;
    const quantity = Number(item.quantity);
    const lineTotal = Number(item.total);
    const costOfGoodsSold = Number(item.costOfGoodsSold);

    const existing = productMap.get(productId);
    if (existing) {
      existing.qtySold += quantity;
      existing.revenue += lineTotal;
      existing.cost += costOfGoodsSold;
    } else {
      productMap.set(productId, {
        productName,
        sku,
        qtySold: quantity,
        revenue: lineTotal,
        cost: costOfGoodsSold,
      });
    }
  }

  // Build rows and compute profit + margin
  const rows: SalesByItemRow[] = [];
  let totalQtySold = 0;
  let totalRevenue = 0;
  let totalCost = 0;

  for (const [productId, data] of productMap.entries()) {
    const profit = data.revenue - data.cost;
    const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

    rows.push({
      productId,
      productName: data.productName,
      sku: data.sku,
      qtySold: data.qtySold,
      revenue: data.revenue,
      cost: data.cost,
      profit,
      margin,
    });

    totalQtySold += data.qtySold;
    totalRevenue += data.revenue;
    totalCost += data.cost;
  }

  // Sort by revenue descending
  rows.sort((a, b) => b.revenue - a.revenue);

  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    rows,
    totals: {
      qtySold: totalQtySold,
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      margin: totalMargin,
    },
  };
}
