/**
 * Historical Data Recalculation Script
 *
 * This script recalculates all FIFO costs for all products in the database.
 * It should be run once after deploying the FIFO improvements to fix any
 * historical incorrect costs.
 *
 * What it does:
 * 1. Updates product.cost for all products to their latest purchase price
 * 2. Recalculates FIFO costs for all products that have invoices
 * 3. Generates a detailed report of all cost changes
 *
 * Usage:
 *   npm run tsx scripts/recalculate-all-fifo-costs.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client.js";
import { recalculateFromDate } from "../src/lib/inventory/fifo";
import { Decimal } from "@prisma/client/runtime/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface CostChange {
  productId: string;
  productName: string;
  oldCost: Decimal;
  newCost: Decimal;
  change: Decimal;
}

interface InvoiceItemChange {
  invoiceNumber: string;
  invoiceDate: Date;
  productName: string;
  oldCOGS: Decimal;
  newCOGS: Decimal;
  change: Decimal;
}

async function main() {
  console.log("🚀 Starting FIFO Cost Recalculation...\n");

  // STEP 1: Update product.cost for all products with purchases
  console.log("📦 Step 1: Updating product.cost to latest purchase prices...");
  const productCostChanges: CostChange[] = [];

  const productsWithPurchases = await prisma.product.findMany({
    include: {
      stockLots: {
        where: { sourceType: "PURCHASE" },
        orderBy: { lotDate: "desc" },
        take: 1,
      },
    },
  });

  for (const product of productsWithPurchases) {
    if (product.stockLots.length > 0) {
      const latestPurchaseCost = product.stockLots[0].unitCost;
      const oldCost = product.cost;

      if (!oldCost.equals(latestPurchaseCost)) {
        await prisma.product.update({
          where: { id: product.id },
          data: { cost: latestPurchaseCost },
        });

        productCostChanges.push({
          productId: product.id,
          productName: product.name,
          oldCost,
          newCost: latestPurchaseCost,
          change: latestPurchaseCost.sub(oldCost),
        });

        console.log(
          `  ✓ ${product.name}: $${oldCost.toFixed(2)} → $${latestPurchaseCost.toFixed(2)}`
        );
      }
    }
  }

  console.log(
    `✅ Updated ${productCostChanges.length} product costs\n`
  );

  // STEP 2: Collect all invoice items before recalculation (for comparison)
  console.log("📊 Step 2: Collecting current invoice costs...");
  const invoiceItemsBefore = await prisma.invoiceItem.findMany({
    where: { productId: { not: null } },
    include: {
      invoice: { select: { invoiceNumber: true, issueDate: true } },
      product: { select: { name: true } },
    },
  });

  const beforeCosts = new Map<string, Prisma.Decimal>(
    invoiceItemsBefore.map((item: any) => [item.id, item.costOfGoodsSold])
  );
  console.log(`✅ Collected ${invoiceItemsBefore.length} invoice items\n`);

  // STEP 3: Recalculate FIFO for all products with invoices
  console.log("🔄 Step 3: Recalculating FIFO costs...");
  const productsWithInvoices = await prisma.product.findMany({
    where: {
      invoiceItems: { some: {} },
    },
    include: {
      invoiceItems: {
        include: {
          invoice: true,
        },
        orderBy: { invoice: { issueDate: "asc" } },
        take: 1,
      },
    },
  });

  let recalculatedProducts = 0;
  for (const product of productsWithInvoices) {
    if (product.invoiceItems.length > 0) {
      const earliestInvoiceDate = product.invoiceItems[0].invoice.issueDate;

      try {
        await prisma.$transaction(async (tx: any) => {
          await recalculateFromDate(product.id, earliestInvoiceDate, tx);
        });

        recalculatedProducts++;
        console.log(`  ✓ Recalculated: ${product.name}`);
      } catch (error) {
        console.error(`  ✗ Error recalculating ${product.name}:`, error);
      }
    }
  }

  console.log(`✅ Recalculated ${recalculatedProducts} products\n`);

  // STEP 4: Collect invoice items after recalculation and compare
  console.log("📈 Step 4: Analyzing cost changes...");
  const invoiceItemsAfter = await prisma.invoiceItem.findMany({
    where: { productId: { not: null } },
    include: {
      invoice: { select: { invoiceNumber: true, issueDate: true } },
      product: { select: { name: true } },
    },
  });

  const invoiceChanges: InvoiceItemChange[] = [];
  for (const item of invoiceItemsAfter) {
    const oldCOGS = beforeCosts.get(item.id) || new Decimal(0);
    const newCOGS = item.costOfGoodsSold;

    if (!oldCOGS.equals(newCOGS)) {
      invoiceChanges.push({
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceDate: item.invoice.issueDate,
        productName: item.product?.name || "Unknown",
        oldCOGS,
        newCOGS,
        change: newCOGS.sub(oldCOGS),
      });
    }
  }

  console.log(`✅ Found ${invoiceChanges.length} invoice items with cost changes\n`);

  // STEP 5: Generate detailed report
  console.log("📝 Generating Report...\n");
  console.log("=".repeat(80));
  console.log("FIFO COST RECALCULATION REPORT");
  console.log("=".repeat(80));
  console.log();

  console.log("Product Cost Changes:");
  console.log("-".repeat(80));
  if (productCostChanges.length > 0) {
    console.log(
      "Product Name".padEnd(30) +
        "Old Cost".padEnd(15) +
        "New Cost".padEnd(15) +
        "Change".padEnd(15)
    );
    console.log("-".repeat(80));
    for (const change of productCostChanges) {
      console.log(
        change.productName.padEnd(30) +
          `$${change.oldCost.toFixed(2)}`.padEnd(15) +
          `$${change.newCost.toFixed(2)}`.padEnd(15) +
          `$${change.change.toFixed(2)}`.padEnd(15)
      );
    }
  } else {
    console.log("No product cost changes");
  }
  console.log();

  console.log("Invoice COGS Changes (First 20):");
  console.log("-".repeat(80));
  if (invoiceChanges.length > 0) {
    console.log(
      "Invoice".padEnd(20) +
        "Product".padEnd(25) +
        "Old COGS".padEnd(15) +
        "New COGS".padEnd(15)
    );
    console.log("-".repeat(80));
    for (const change of invoiceChanges.slice(0, 20)) {
      console.log(
        change.invoiceNumber.padEnd(20) +
          change.productName.padEnd(25) +
          `$${change.oldCOGS.toFixed(2)}`.padEnd(15) +
          `$${change.newCOGS.toFixed(2)}`.padEnd(15)
      );
    }
    if (invoiceChanges.length > 20) {
      console.log(`... and ${invoiceChanges.length - 20} more changes`);
    }
  } else {
    console.log("No invoice COGS changes");
  }
  console.log();

  // Summary statistics
  const totalCOGSBefore = invoiceItemsAfter.reduce(
    (sum: Decimal, item: any) => sum.add(beforeCosts.get(item.id) || new Decimal(0)),
    new Decimal(0)
  );
  const totalCOGSAfter = invoiceItemsAfter.reduce(
    (sum: Decimal, item: any) => sum.add(item.costOfGoodsSold),
    new Decimal(0)
  );
  const totalChange = totalCOGSAfter.sub(totalCOGSBefore);

  console.log("Summary:");
  console.log("-".repeat(80));
  console.log(`Total Products Updated: ${productCostChanges.length}`);
  console.log(`Total Invoice Items Changed: ${invoiceChanges.length}`);
  console.log(`Total COGS Before: $${totalCOGSBefore.toFixed(2)}`);
  console.log(`Total COGS After: $${totalCOGSAfter.toFixed(2)}`);
  console.log(`Total Change: $${totalChange.toFixed(2)}`);
  console.log("=".repeat(80));

  console.log("\n✅ Recalculation complete!");
}

main()
  .catch((error) => {
    console.error("❌ Error during recalculation:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
