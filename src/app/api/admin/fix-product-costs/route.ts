import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Find the true MRP for a product by preferring invoices with discounts.
 * Invoices entered with a discount have the real MRP as unitCost.
 * Invoices with 0% discount may have a corrupted (already-discounted) unitCost.
 */
async function findProductMRP(productId: string) {
  // First: most recent invoice WITH a discount — has the true MRP
  const discountedItem = await prisma.purchaseInvoiceItem.findFirst({
    where: {
      productId,
      discount: { gt: 0 },
    },
    orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
    select: {
      unitCost: true,
      discount: true,
      purchaseInvoice: { select: { purchaseInvoiceNumber: true } },
    },
  });

  if (discountedItem) {
    return {
      mrp: Number(discountedItem.unitCost),
      discount: Number(discountedItem.discount),
      invoice: discountedItem.purchaseInvoice.purchaseInvoiceNumber,
      source: "discounted" as const,
    };
  }

  // Fallback: latest invoice (no discounts found)
  const latestItem = await prisma.purchaseInvoiceItem.findFirst({
    where: { productId },
    orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
    select: {
      unitCost: true,
      discount: true,
      purchaseInvoice: { select: { purchaseInvoiceNumber: true } },
    },
  });

  if (latestItem) {
    return {
      mrp: Number(latestItem.unitCost),
      discount: Number(latestItem.discount),
      invoice: latestItem.purchaseInvoice.purchaseInvoiceNumber,
      source: "latest" as const,
    };
  }

  return null;
}

// GET: Check which products have incorrect costs
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
      select: { id: true, name: true, cost: true },
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
      const result = await findProductMRP(product.id);
      if (!result) continue;

      const currentCost = Number(product.cost);
      if (Math.abs(currentCost - result.mrp) > 0.01) {
        issues.push({
          id: product.id,
          name: product.name,
          currentCost,
          correctCost: result.mrp,
          latestInvoice: result.invoice,
          discount: result.discount,
        });
      }
    }

    return NextResponse.json({
      totalProducts: products.length,
      productsWithIssues: issues.length,
      issues,
      message: issues.length > 0
        ? `Found ${issues.length} product(s) with incorrect cost.`
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
      select: { id: true, name: true, cost: true },
    });

    const fixes: Array<{
      id: string;
      name: string;
      oldCost: number;
      newCost: number;
      discount: number;
    }> = [];

    for (const product of products) {
      const result = await findProductMRP(product.id);
      if (!result) continue;

      const currentCost = Number(product.cost);
      if (Math.abs(currentCost - result.mrp) > 0.01) {
        await prisma.product.update({
          where: { id: product.id },
          data: { cost: result.mrp },
        });

        fixes.push({
          id: product.id,
          name: product.name,
          oldCost: currentCost,
          newCost: result.mrp,
          discount: result.discount,
        });

        console.log(`[Fix Product Costs] ${product.name}: ${currentCost} -> ${result.mrp}`);
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
