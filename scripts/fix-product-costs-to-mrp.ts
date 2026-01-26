/**
 * Fix Script: Update product.cost to MRP (pre-discount) from latest purchase invoice
 *
 * Previously, product.cost was being set to the discounted price instead of the
 * original MRP. This script corrects existing products by looking at each product's
 * most recent purchase invoice item and setting product.cost to its unitCost (MRP).
 *
 * Run with: npx tsx scripts/fix-product-costs-to-mrp.ts
 */

import dotenv from "dotenv";
import prisma from "../src/lib/prisma";

dotenv.config();

async function main() {
  console.log("Starting fix: Update product.cost to MRP from latest purchase invoice...\n");

  try {
    // Get all products that have purchase invoice items
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

    console.log(`Found ${products.length} products with purchase history.\n`);

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      // Find the most recent purchase invoice item for this product
      const latestItem = await prisma.purchaseInvoiceItem.findFirst({
        where: { productId: product.id },
        orderBy: {
          purchaseInvoice: { invoiceDate: "desc" },
        },
        select: {
          unitCost: true,
          discount: true,
          purchaseInvoice: {
            select: { purchaseInvoiceNumber: true, invoiceDate: true },
          },
        },
      });

      if (!latestItem) {
        skipped++;
        continue;
      }

      const mrp = Number(latestItem.unitCost);
      const currentCost = Number(product.cost);

      if (currentCost === mrp) {
        skipped++;
        continue;
      }

      console.log(
        `${product.name}: cost ${currentCost} -> ${mrp} ` +
        `(from invoice ${latestItem.purchaseInvoice.purchaseInvoiceNumber}, ` +
        `discount: ${latestItem.discount}%)`
      );

      await prisma.product.update({
        where: { id: product.id },
        data: { cost: mrp },
      });

      updated++;
    }

    console.log(`\nDone. Updated: ${updated}, Skipped (already correct): ${skipped}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
