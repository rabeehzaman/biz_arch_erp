import prisma from "@/lib/prisma";

export interface PurchasesByItemRow {
  productId: string;
  productName: string;
  sku: string | null;
  qtyPurchased: number;
  amount: number;
  tax: number;
  total: number;
}

export interface PurchasesByItemData {
  rows: PurchasesByItemRow[];
  totals: {
    qtyPurchased: number;
    amount: number;
    tax: number;
    total: number;
  };
}

export async function getPurchasesByItemData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<PurchasesByItemData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const purchaseItems = await prisma.purchaseInvoiceItem.findMany({
    where: {
      organizationId,
      purchaseInvoice: {
        invoiceDate: { gte: from, lte: to },
        status: { not: "DRAFT" },
      },
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
    },
  });

  // Group by productId
  const productMap = new Map<
    string,
    { productName: string; sku: string | null; qtyPurchased: number; amount: number; tax: number }
  >();

  for (const item of purchaseItems) {
    const productId = item.productId || item.id;
    const productName = item.product?.name || item.description;
    const sku = item.product?.sku || null;
    const quantity = Number(item.quantity);
    const lineTotal = Number(item.total);
    const tax =
      Number(item.vatAmount || 0) +
      Number(item.cgstAmount) +
      Number(item.sgstAmount) +
      Number(item.igstAmount);

    const existing = productMap.get(productId);
    if (existing) {
      existing.qtyPurchased += quantity;
      existing.amount += lineTotal;
      existing.tax += tax;
    } else {
      productMap.set(productId, {
        productName,
        sku,
        qtyPurchased: quantity,
        amount: lineTotal,
        tax,
      });
    }
  }

  // Build rows
  const rows: PurchasesByItemRow[] = [];
  let totalQtyPurchased = 0;
  let totalAmount = 0;
  let totalTax = 0;

  for (const [productId, data] of productMap.entries()) {
    const total = data.amount + data.tax;

    rows.push({
      productId,
      productName: data.productName,
      sku: data.sku,
      qtyPurchased: data.qtyPurchased,
      amount: data.amount,
      tax: data.tax,
      total,
    });

    totalQtyPurchased += data.qtyPurchased;
    totalAmount += data.amount;
    totalTax += data.tax;
  }

  // Sort by amount descending
  rows.sort((a, b) => b.amount - a.amount);

  return {
    rows,
    totals: {
      qtyPurchased: totalQtyPurchased,
      amount: totalAmount,
      tax: totalTax,
      total: totalAmount + totalTax,
    },
  };
}
