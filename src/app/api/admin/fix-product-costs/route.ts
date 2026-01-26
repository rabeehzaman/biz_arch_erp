import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET: Check which products have discounted costs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const products = await prisma.product.findMany({
      where: {
        purchaseInvoiceItems: { some: {} },
      },
      select: {
        id: true,
        name: true,
        cost: true,
      },
      orderBy: { name: "asc" },
    });

    const issues: Array<{
      id: string;
      name: string;
      currentCost: number;
      correctCost: number;
      latestInvoice: string;
      discount: number;
    }> = [];

    for (const product of products) {
      const latestItem = await prisma.purchaseInvoiceItem.findFirst({
        where: { productId: product.id },
        orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
        select: {
          unitCost: true,
          discount: true,
          purchaseInvoice: {
            select: { purchaseInvoiceNumber: true },
          },
        },
      });

      if (!latestItem) continue;

      const mrp = Number(latestItem.unitCost);
      const currentCost = Number(product.cost);

      if (Math.abs(currentCost - mrp) > 0.01) {
        issues.push({
          id: product.id,
          name: product.name,
          currentCost,
          correctCost: mrp,
          latestInvoice: latestItem.purchaseInvoice.purchaseInvoiceNumber,
          discount: Number(latestItem.discount),
        });
      }
    }

    return NextResponse.json({
      totalProducts: products.length,
      productsWithIssues: issues.length,
      issues,
      message: issues.length > 0
        ? `Found ${issues.length} product(s) with discounted cost instead of MRP.`
        : "All product costs are correct.",
    });
  } catch (error) {
    console.error("[Fix Product Costs] Check error:", error);
    return NextResponse.json({ error: "Failed to check product costs" }, { status: 500 });
  }
}

// POST: Fix product costs to MRP
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    console.log(`[Fix Product Costs] Starting fix by ${session.user.email}`);

    const products = await prisma.product.findMany({
      where: {
        purchaseInvoiceItems: { some: {} },
      },
      select: {
        id: true,
        name: true,
        cost: true,
      },
    });

    const fixes: Array<{
      id: string;
      name: string;
      oldCost: number;
      newCost: number;
      discount: number;
    }> = [];

    for (const product of products) {
      const latestItem = await prisma.purchaseInvoiceItem.findFirst({
        where: { productId: product.id },
        orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
        select: {
          unitCost: true,
          discount: true,
        },
      });

      if (!latestItem) continue;

      const mrp = Number(latestItem.unitCost);
      const currentCost = Number(product.cost);

      if (Math.abs(currentCost - mrp) > 0.01) {
        await prisma.product.update({
          where: { id: product.id },
          data: { cost: mrp },
        });

        fixes.push({
          id: product.id,
          name: product.name,
          oldCost: currentCost,
          newCost: mrp,
          discount: Number(latestItem.discount),
        });

        console.log(`[Fix Product Costs] ${product.name}: ${currentCost} -> ${mrp}`);
      }
    }

    console.log(`[Fix Product Costs] Done. Fixed ${fixes.length} products.`);

    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: products.length,
        fixedCount: fixes.length,
      },
      fixes,
      message: fixes.length > 0
        ? `Fixed ${fixes.length} product cost(s) to MRP.`
        : "No products needed fixing.",
    });
  } catch (error) {
    console.error("[Fix Product Costs] Fix error:", error);
    return NextResponse.json({ error: "Failed to fix product costs" }, { status: 500 });
  }
}
