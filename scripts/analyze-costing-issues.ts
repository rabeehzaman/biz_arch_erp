/**
 * Analyze Costing Issues Script
 *
 * This script identifies and analyzes:
 * 1. Invoice items with zero COGS
 * 2. Items with abnormally high profit margins (>20%)
 * 3. Products with missing or incorrect cost data
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { Decimal } from "@prisma/client/runtime/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ZeroCostItem {
  invoiceNumber: string;
  invoiceDate: Date;
  productName: string;
  productSku: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
  total: Decimal;
  costOfGoodsSold: Decimal;
  productDefaultCost: Decimal;
  stockLotsAvailable: number;
}

interface HighProfitItem {
  invoiceNumber: string;
  invoiceDate: Date;
  productName: string;
  quantity: Decimal;
  unitPrice: Decimal;
  total: Decimal;
  costOfGoodsSold: Decimal;
  profit: Decimal;
  profitMargin: number;
}

async function main() {
  console.log("🔍 Analyzing Costing Issues...\n");

  // ==========================================================================
  // 1. FIND INVOICE ITEMS WITH ZERO COGS
  // ==========================================================================
  console.log("=".repeat(80));
  console.log("1. INVOICE ITEMS WITH ZERO COGS");
  console.log("=".repeat(80));

  const zeroCostItems = await prisma.invoiceItem.findMany({
    where: {
      costOfGoodsSold: 0,
      productId: { not: null },
    },
    include: {
      invoice: true,
      product: {
        include: {
          stockLots: {
            where: { remainingQuantity: { gt: 0 } },
          },
        },
      },
      lotConsumptions: true,
    },
    orderBy: { invoice: { issueDate: "desc" } },
  });

  const zeroCostAnalysis: ZeroCostItem[] = zeroCostItems.map((item: any) => ({
    invoiceNumber: item.invoice.invoiceNumber,
    invoiceDate: item.invoice.issueDate,
    productName: item.product?.name || "Unknown",
    productSku: item.product?.sku || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    costOfGoodsSold: item.costOfGoodsSold,
    productDefaultCost: item.product?.cost || new Decimal(0),
    stockLotsAvailable: item.product?.stockLots?.length || 0,
  }));

  console.log(`\nFound ${zeroCostAnalysis.length} items with zero COGS\n`);

  if (zeroCostAnalysis.length > 0) {
    console.log("Sample (first 10):");
    console.log("-".repeat(80));
    console.log(
      "Invoice".padEnd(20) +
        "Product".padEnd(25) +
        "Qty".padEnd(8) +
        "Price".padEnd(12) +
        "Def Cost".padEnd(12) +
        "Lots"
    );
    console.log("-".repeat(80));

    for (const item of zeroCostAnalysis.slice(0, 10)) {
      console.log(
        item.invoiceNumber.padEnd(20) +
          item.productName.substring(0, 24).padEnd(25) +
          item.quantity.toFixed(2).padEnd(8) +
          `$${item.unitPrice.toFixed(2)}`.padEnd(12) +
          `$${item.productDefaultCost.toFixed(2)}`.padEnd(12) +
          item.stockLotsAvailable.toString()
      );
    }

    // Categorize zero-cost items
    const noDefaultCost = zeroCostAnalysis.filter((item) =>
      item.productDefaultCost.lte(0)
    );
    const hasDefaultCost = zeroCostAnalysis.filter((item) =>
      item.productDefaultCost.gt(0)
    );
    const noStockLots = zeroCostAnalysis.filter(
      (item) => item.stockLotsAvailable === 0
    );

    console.log("\nCategorization:");
    console.log(`  - Items with no default cost: ${noDefaultCost.length}`);
    console.log(`  - Items with default cost >0: ${hasDefaultCost.length}`);
    console.log(`  - Items with no stock lots: ${noStockLots.length}`);
  }

  // ==========================================================================
  // 2. FIND ITEMS WITH HIGH PROFIT MARGINS (>20%)
  // ==========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("2. ITEMS WITH HIGH PROFIT MARGINS (>20%)");
  console.log("=".repeat(80));

  const allInvoiceItems = await prisma.invoiceItem.findMany({
    where: {
      productId: { not: null },
      costOfGoodsSold: { gt: 0 },
      total: { gt: 0 },
    },
    include: {
      invoice: true,
      product: true,
    },
  });

  const highProfitItems: HighProfitItem[] = [];

  for (const item of allInvoiceItems) {
    const profit = item.total.sub(item.costOfGoodsSold);
    const profitMargin = item.total.gt(0)
      ? profit.div(item.total).mul(100).toNumber()
      : 0;

    if (profitMargin > 20) {
      highProfitItems.push({
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceDate: item.invoice.issueDate,
        productName: item.product?.name || "Unknown",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        costOfGoodsSold: item.costOfGoodsSold,
        profit,
        profitMargin,
      });
    }
  }

  // Sort by profit margin descending
  highProfitItems.sort((a, b) => b.profitMargin - a.profitMargin);

  console.log(`\nFound ${highProfitItems.length} items with >20% profit margin\n`);

  if (highProfitItems.length > 0) {
    console.log("Top 15 by profit margin:");
    console.log("-".repeat(80));
    console.log(
      "Invoice".padEnd(20) +
        "Product".padEnd(25) +
        "Total".padEnd(12) +
        "COGS".padEnd(12) +
        "Margin %"
    );
    console.log("-".repeat(80));

    for (const item of highProfitItems.slice(0, 15)) {
      console.log(
        item.invoiceNumber.padEnd(20) +
          item.productName.substring(0, 24).padEnd(25) +
          `$${item.total.toFixed(2)}`.padEnd(12) +
          `$${item.costOfGoodsSold.toFixed(2)}`.padEnd(12) +
          `${item.profitMargin.toFixed(1)}%`
      );
    }

    // Statistics
    const margins = highProfitItems.map((item) => item.profitMargin);
    const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
    const maxMargin = Math.max(...margins);
    const minMargin = Math.min(...margins);

    console.log("\nProfit Margin Statistics:");
    console.log(`  - Average: ${avgMargin.toFixed(1)}%`);
    console.log(`  - Maximum: ${maxMargin.toFixed(1)}%`);
    console.log(`  - Minimum: ${minMargin.toFixed(1)}%`);

    // Find items with suspiciously high margins (>50%)
    const suspiciousItems = highProfitItems.filter((item) => item.profitMargin > 50);
    if (suspiciousItems.length > 0) {
      console.log(`\n⚠️  WARNING: ${suspiciousItems.length} items have >50% margin (likely data issue)`);
    }
  }

  // ==========================================================================
  // 3. CHECK PRODUCT DEFAULT COSTS
  // ==========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("3. PRODUCT DEFAULT COST ANALYSIS");
  console.log("=".repeat(80));

  const productsWithZeroCost = await prisma.product.count({
    where: { cost: 0, isActive: true },
  });

  const productsWithPurchases = await prisma.product.findMany({
    where: {
      isActive: true,
      stockLots: {
        some: { sourceType: "PURCHASE" },
      },
    },
    include: {
      stockLots: {
        where: { sourceType: "PURCHASE" },
        orderBy: { lotDate: "desc" },
        take: 1,
        select: { unitCost: true },
      },
    },
  });

  const outdatedCosts = productsWithPurchases.filter(
    (p) => p.cost.lt(p.stockLots[0]?.unitCost || 0)
  );

  console.log(`\nActive products with cost = 0: ${productsWithZeroCost}`);
  console.log(`Products with outdated costs: ${outdatedCosts.length}`);

  if (outdatedCosts.length > 0) {
    console.log("\nSample products with outdated costs (first 5):");
    console.log("-".repeat(80));
    for (const product of outdatedCosts.slice(0, 5)) {
      const latestPurchaseCost = product.stockLots[0]?.unitCost || new Decimal(0);
      console.log(
        `  ${product.name.substring(0, 30).padEnd(30)} | Current: $${product.cost.toFixed(2)} | Latest Purchase: $${latestPurchaseCost.toFixed(2)}`
      );
    }
  }

  // ==========================================================================
  // 4. SUMMARY AND RECOMMENDATIONS
  // ==========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY & RECOMMENDATIONS");
  console.log("=".repeat(80));

  console.log("\n📊 Issues Found:");
  console.log(`  ✗ ${zeroCostAnalysis.length} invoice items with zero COGS`);
  console.log(`  ⚠️  ${highProfitItems.length} items with >20% profit margin`);
  console.log(`  ✗ ${productsWithZeroCost} active products with cost = 0`);
  console.log(`  ⚠️  ${outdatedCosts.length} products with outdated default costs`);

  console.log("\n💡 Recommendations:");

  if (zeroCostAnalysis.length > 0) {
    console.log("\n1. Zero COGS Items:");
    console.log("   - Run: npx tsx scripts/recalculate-all-fifo-costs.ts");
    console.log("   - This will recalculate FIFO costs for all historical invoices");
    console.log("   - Ensure all products have opening stock or purchase history");
  }

  if (productsWithZeroCost > 0) {
    console.log("\n2. Products with Zero Cost:");
    console.log("   - Review products with no cost set");
    console.log("   - Add opening stock entries with costs");
    console.log("   - Or ensure purchases are recorded for these products");
  }

  if (highProfitItems.length > 0) {
    console.log("\n3. High Profit Margins:");
    console.log("   - Review items with >50% margins for data accuracy");
    console.log("   - Verify selling prices are correct");
    console.log("   - Check if COGS calculations are accurate");
    console.log("   - Some high margins may be legitimate (markup products)");
  }

  if (outdatedCosts.length > 0) {
    console.log("\n4. Outdated Default Costs:");
    console.log("   - These should auto-update with new FIFO improvements");
    console.log("   - If not updated, check recent purchases were processed");
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Analysis Complete");
  console.log("=".repeat(80));
}

main()
  .catch((error) => {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
