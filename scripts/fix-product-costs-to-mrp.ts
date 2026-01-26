/**
 * Fix Script: Update product.cost to MRP (pre-discount) from latest purchase invoice
 *
 * Previously, product.cost was being set to the discounted price instead of the
 * original MRP. This caused forms to auto-populate with the wrong price, and some
 * users then entered the discounted price directly with 0% discount.
 *
 * Strategy:
 * 1. Find the most recent purchase invoice item WITH a discount > 0 — that has the true MRP
 * 2. If none found, fall back to the latest invoice's unitCost
 *
 * Run with: npx tsx scripts/fix-product-costs-to-mrp.ts
 */

import dotenv from "dotenv";
dotenv.config();

async function main() {
  const { default: prisma } = await import("../src/lib/prisma");

  console.log("Starting fix: Update product.cost to MRP from purchase invoices...\n");

  try {
    const products = await prisma.product.findMany({
      where: {
        purchaseInvoiceItems: { some: {} },
      },
      select: {
        id: true,
        name: true,
        cost: true,
        price: true,
      },
    });

    console.log(`Found ${products.length} products with purchase history.\n`);

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      // First: find the most recent invoice WITH a discount — has the true MRP
      const discountedItem = await prisma.purchaseInvoiceItem.findFirst({
        where: {
          productId: product.id,
          discount: { gt: 0 },
        },
        orderBy: {
          purchaseInvoice: { invoiceDate: "desc" },
        },
        select: {
          unitCost: true,
          discount: true,
          purchaseInvoice: {
            select: { purchaseInvoiceNumber: true },
          },
        },
      });

      // Fallback: latest invoice regardless of discount
      const latestItem = await prisma.purchaseInvoiceItem.findFirst({
        where: { productId: product.id },
        orderBy: {
          purchaseInvoice: { invoiceDate: "desc" },
        },
        select: {
          unitCost: true,
          discount: true,
          purchaseInvoice: {
            select: { purchaseInvoiceNumber: true },
          },
        },
      });

      // Prefer the discounted item's unitCost (true MRP), fall back to latest
      const sourceItem = discountedItem || latestItem;
      if (!sourceItem) {
        skipped++;
        continue;
      }

      const mrp = Number(sourceItem.unitCost);
      const currentCost = Number(product.cost);

      if (Math.abs(currentCost - mrp) < 0.01) {
        skipped++;
        continue;
      }

      const source = discountedItem
        ? `discounted invoice ${sourceItem.purchaseInvoice.purchaseInvoiceNumber} (discount: ${sourceItem.discount}%)`
        : `latest invoice ${sourceItem.purchaseInvoice.purchaseInvoiceNumber}`;

      console.log(`${product.name}: cost ${currentCost} -> ${mrp} (from ${source})`);

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
