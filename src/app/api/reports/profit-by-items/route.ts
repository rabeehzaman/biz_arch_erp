import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    // Build where clause
    const where: {
      invoice?: {
        organizationId?: string;
        issueDate?: {
          gte?: Date;
          lte?: Date;
        };
      };
      productId?: string;
    } = {
      invoice: { organizationId },
    };

    if (productId) {
      where.productId = productId;
    }

    if (fromDate || toDate) {
      where.invoice = {
        ...where.invoice,
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
            unit: true,
          },
        },
      },
      orderBy: {
        invoice: {
          issueDate: "desc",
        },
      },
    });

    // Calculate profit for each item and group by invoice
    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalCOGS = 0;

    // Group items by invoice
    const invoiceMap = new Map<
      string,
      {
        invoiceId: string;
        invoiceNumber: string;
        invoiceDate: string;
        customerName: string;
        totalQty: number;
        totalRevenue: number;
        totalCOGS: number;
        totalProfit: number;
        profitPercent: number;
        items: Array<{
          id: string;
          productId: string | null;
          productName: string;
          productSku: string | null;
          quantity: number;
          unitPrice: number;
          discount: number;
          salePriceAfterDiscount: number;
          fifoCostPerUnit: number;
          profitPerUnit: number;
          profitPercent: number;
          lineTotal: number;
          lineCOGS: number;
          lineProfit: number;
        }>;
      }
    >();

    invoiceItems.forEach((item) => {
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

      const invoiceId = item.invoice.id;
      const profitItem = {
        id: item.id,
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

      if (invoiceMap.has(invoiceId)) {
        const invoice = invoiceMap.get(invoiceId)!;
        invoice.totalQty += quantity;
        invoice.totalRevenue += lineTotal;
        invoice.totalCOGS += lineCOGS;
        invoice.totalProfit = invoice.totalRevenue - invoice.totalCOGS;
        invoice.profitPercent =
          invoice.totalRevenue > 0
            ? (invoice.totalProfit / invoice.totalRevenue) * 100
            : 0;
        invoice.items.push(profitItem);
      } else {
        invoiceMap.set(invoiceId, {
          invoiceId,
          invoiceNumber: item.invoice.invoiceNumber,
          invoiceDate: item.invoice.issueDate.toISOString(),
          customerName: item.invoice.customer.name,
          totalQty: quantity,
          totalRevenue: lineTotal,
          totalCOGS: lineCOGS,
          totalProfit: lineProfit,
          profitPercent:
            lineTotal > 0 ? (lineProfit / lineTotal) * 100 : 0,
          items: [profitItem],
        });
      }
    });

    const invoices = Array.from(invoiceMap.values());

    const totalProfit = totalRevenue - totalCOGS;
    const averageProfitPercent =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      invoices,
      summary: {
        totalInvoices: invoices.length,
        totalItems: invoiceItems.length,
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
