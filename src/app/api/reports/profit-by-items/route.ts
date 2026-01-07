import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    // Build where clause
    const where: {
      productId?: string;
      invoice?: {
        issueDate?: {
          gte?: Date;
          lte?: Date;
        };
      };
    } = {};

    if (productId) {
      where.productId = productId;
    }

    if (fromDate || toDate) {
      where.invoice = {
        issueDate: {},
      };
      if (fromDate) {
        where.invoice.issueDate!.gte = new Date(fromDate);
      }
      if (toDate) {
        // Set to end of day
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        where.invoice.issueDate!.lte = endDate;
      }
    }

    // Fetch invoice items with relations
    const invoiceItems = await prisma.invoiceItem.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: {
        invoice: {
          issueDate: "desc",
        },
      },
    });

    // Calculate profit for each item
    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalCOGS = 0;

    const items = invoiceItems.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const discount = Number(item.discount);
      const costOfGoodsSold = Number(item.costOfGoodsSold);

      const salePriceAfterDiscount = unitPrice * (1 - discount / 100);
      const fifoCostPerUnit = quantity > 0 ? costOfGoodsSold / quantity : 0;
      const profitPerUnit = salePriceAfterDiscount - fifoCostPerUnit;
      const profitPercent =
        salePriceAfterDiscount > 0
          ? (profitPerUnit / salePriceAfterDiscount) * 100
          : 0;

      const lineTotal = quantity * salePriceAfterDiscount;
      const lineCOGS = costOfGoodsSold;
      const lineProfit = lineTotal - lineCOGS;

      // Accumulate totals
      totalQuantity += quantity;
      totalRevenue += lineTotal;
      totalCOGS += lineCOGS;

      return {
        id: item.id,
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceDate: item.invoice.issueDate.toISOString(),
        invoiceId: item.invoice.id,
        customerName: item.invoice.customer.name,
        productId: item.productId,
        productName: item.product?.name || item.description,
        productSku: item.product?.sku || null,
        quantity,
        unitPrice,
        discount,
        salePriceAfterDiscount,
        fifoCostPerUnit,
        profitPerUnit,
        profitPercent,
        lineTotal,
        lineCOGS,
        lineProfit,
      };
    });

    const totalProfit = totalRevenue - totalCOGS;
    const averageProfitPercent =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      items,
      summary: {
        totalItems: items.length,
        totalQuantity,
        totalRevenue,
        totalCOGS,
        totalProfit,
        averageProfitPercent,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to generate profit by items report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
