/**
 * Investigate Specific Costing Issues
 *
 * Deep dive into specific problematic items identified in the analysis
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Deep Investigation of Specific Issues\n");

  // ==========================================================================
  // 1. INVESTIGATE ITEMS WITH STOCK LOTS BUT ZERO COGS
  // ==========================================================================
  console.log("=".repeat(80));
  console.log("1. ITEMS WITH STOCK LOTS BUT ZERO COGS");
  console.log("=".repeat(80));

  const zeroCostWithLots = await prisma.invoiceItem.findMany({
    where: {
      costOfGoodsSold: 0,
      productId: { not: null },
      product: {
        stockLots: {
          some: { remainingQuantity: { gt: 0 } },
        },
      },
    },
    include: {
      invoice: true,
      product: {
        include: {
          stockLots: {
            orderBy: { lotDate: "asc" },
          },
        },
      },
      lotConsumptions: true,
    },
    take: 10,
  });

  console.log(`\nFound ${zeroCostWithLots.length} items\n`);

  for (const item of zeroCostWithLots) {
    console.log("-".repeat(80));
    console.log(`Invoice: ${item.invoice.invoiceNumber}`);
    console.log(`Product: ${item.product?.name}`);
    console.log(`Invoice Date: ${item.invoice.issueDate.toISOString().split("T")[0]}`);
    console.log(`Quantity Sold: ${item.quantity.toString()}`);
    console.log(`COGS: $${item.costOfGoodsSold.toString()}`);
    console.log(`Lot Consumptions: ${item.lotConsumptions.length}`);

    console.log("\nAvailable Stock Lots:");
    if (item.product?.stockLots) {
      for (const lot of item.product.stockLots) {
        const lotDateStr = lot.lotDate.toISOString().split("T")[0];
        const isBeforeInvoice = lot.lotDate <= item.invoice.issueDate;
        console.log(
          `  - Date: ${lotDateStr} | Cost: $${lot.unitCost.toString()} | Remaining: ${lot.remainingQuantity.toString()} | Source: ${lot.sourceType}${isBeforeInvoice ? " ✓" : " ✗ (after invoice)"}`
        );
      }
    }

    // Check if there were lots available BEFORE the invoice date
    const lotsBeforeInvoice = item.product?.stockLots.filter(
      (lot) => lot.lotDate <= item.invoice.issueDate
    );
    const totalQtyBefore = lotsBeforeInvoice?.reduce(
      (sum, lot) => sum.add(lot.initialQuantity),
      new (require("@prisma/client/runtime/client").Decimal)(0)
    );

    console.log(`\nLots available before invoice date: ${lotsBeforeInvoice?.length || 0}`);
    console.log(`Total initial quantity before invoice: ${totalQtyBefore?.toString() || "0"}`);

    console.log("\nPOSSIBLE REASON:");
    if ((lotsBeforeInvoice?.length || 0) === 0) {
      console.log("  ⚠️  All stock lots are dated AFTER the invoice - items sold before purchase!");
    } else if (item.lotConsumptions.length === 0) {
      console.log("  ⚠️  No lot consumptions recorded - FIFO consumption may have failed!");
    } else {
      console.log("  ❓ Unknown - needs manual investigation");
    }
    console.log("");
  }

  // ==========================================================================
  // 2. INVESTIGATE HIGH PROFIT MARGIN ITEM (67.5%)
  // ==========================================================================
  console.log("=".repeat(80));
  console.log("2. HIGH PROFIT MARGIN ITEM INVESTIGATION");
  console.log("=".repeat(80));

  const highProfitItem = await prisma.invoiceItem.findFirst({
    where: {
      description: { contains: "VGUARD SUPERIO PLUS 1MM", mode: "insensitive" },
    },
    include: {
      invoice: true,
      product: {
        include: {
          stockLots: {
            orderBy: { lotDate: "asc" },
          },
        },
      },
      lotConsumptions: {
        include: {
          stockLot: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (highProfitItem) {
    console.log("\nInvoice Item Details:");
    console.log("-".repeat(80));
    console.log(`Invoice: ${highProfitItem.invoice.invoiceNumber}`);
    console.log(`Product: ${highProfitItem.product?.name || highProfitItem.description}`);
    console.log(`Invoice Date: ${highProfitItem.invoice.issueDate.toISOString().split("T")[0]}`);
    console.log(`Quantity: ${highProfitItem.quantity.toString()}`);
    console.log(`Unit Price: $${highProfitItem.unitPrice.toString()}`);
    console.log(`Discount: ${highProfitItem.discount.toString()}%`);
    console.log(`Total: $${highProfitItem.total.toString()}`);
    console.log(`COGS: $${highProfitItem.costOfGoodsSold.toString()}`);
    const profit = highProfitItem.total.sub(highProfitItem.costOfGoodsSold);
    const margin = highProfitItem.total.gt(0)
      ? profit.div(highProfitItem.total).mul(100)
      : new (require("@prisma/client/runtime/client").Decimal)(0);
    console.log(`Profit: $${profit.toString()}`);
    console.log(`Profit Margin: ${margin.toFixed(1)}%`);

    console.log("\nLot Consumptions:");
    if (highProfitItem.lotConsumptions.length > 0) {
      for (const consumption of highProfitItem.lotConsumptions) {
        console.log(
          `  - Qty: ${consumption.quantityConsumed.toString()} @ $${consumption.unitCost.toString()}/unit = $${consumption.totalCost.toString()}`
        );
        console.log(`    Lot Date: ${consumption.stockLot.lotDate.toISOString().split("T")[0]}`);
        console.log(`    Lot Source: ${consumption.stockLot.sourceType}`);
      }
    } else {
      console.log("  No lot consumptions found");
    }

    console.log("\nAll Stock Lots for this Product:");
    if (highProfitItem.product?.stockLots) {
      for (const lot of highProfitItem.product.stockLots) {
        console.log(
          `  - Date: ${lot.lotDate.toISOString().split("T")[0]} | Cost: $${lot.unitCost.toString()} | Initial: ${lot.initialQuantity.toString()} | Remaining: ${lot.remainingQuantity.toString()}`
        );
      }
    }

    console.log("\nANALYSIS:");
    const avgCostPerUnit = highProfitItem.costOfGoodsSold.div(highProfitItem.quantity);
    const markupPercent = highProfitItem.unitPrice.sub(avgCostPerUnit).div(avgCostPerUnit).mul(100);
    console.log(`  Average cost per unit: $${avgCostPerUnit.toFixed(2)}`);
    console.log(`  Selling price per unit: $${highProfitItem.unitPrice.toString()}`);
    console.log(`  Markup: ${markupPercent.toFixed(1)}%`);

    if (margin.gt(50)) {
      console.log("\n  ⚠️  POTENTIAL ISSUES:");
      console.log("  1. Selling price might be too high");
      console.log("  2. Purchase cost might be recorded incorrectly (too low)");
      console.log("  3. This could be a legitimate high-margin item (rare/specialty)");
    }
  } else {
    console.log("\nHigh profit margin item not found");
  }

  // ==========================================================================
  // 3. CHECK WHY PRODUCT COSTS AREN'T AUTO-UPDATING
  // ==========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("3. AUTO-UPDATE INVESTIGATION");
  console.log("=".repeat(80));

  // Find products that have recent purchases but cost = 0
  const productsNeedingUpdate = await prisma.product.findMany({
    where: {
      cost: 0,
      isActive: true,
      stockLots: {
        some: {
          sourceType: "PURCHASE",
          lotDate: { gte: new Date("2026-01-01") },
        },
      },
    },
    include: {
      stockLots: {
        where: { sourceType: "PURCHASE" },
        orderBy: { lotDate: "desc" },
        take: 1,
      },
    },
    take: 10,
  });

  console.log(`\nFound ${productsNeedingUpdate.length} products with recent purchases but cost = 0\n`);

  if (productsNeedingUpdate.length > 0) {
    console.log("Sample products that should have been auto-updated:");
    console.log("-".repeat(80));
    for (const product of productsNeedingUpdate) {
      const latestLot = product.stockLots[0];
      console.log(`Product: ${product.name}`);
      console.log(`  Current cost: $${product.cost.toString()}`);
      console.log(`  Latest purchase: $${latestLot?.unitCost.toString() || "N/A"} on ${latestLot?.lotDate.toISOString().split("T")[0] || "N/A"}`);
      console.log("");
    }

    console.log("CONCLUSION:");
    console.log("  ⚠️  The auto-update feature may not be working correctly!");
    console.log("  OR these purchases were created BEFORE the feature was deployed.");
    console.log("\nRECOMMENDATION:");
    console.log("  Run: npx tsx scripts/recalculate-all-fifo-costs.ts");
    console.log("  This will update all product costs to their latest purchase prices.");
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Investigation Complete");
  console.log("=".repeat(80));
}

main()
  .catch((error) => {
    console.error("❌ Error during investigation:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
