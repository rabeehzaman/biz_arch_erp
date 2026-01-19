/**
 * Migration Script: Fix Stock Lot Unit Costs for Discounted Purchases
 *
 * This script corrects historical stock lots that were created with the wrong unit cost
 * (undiscounted) when purchase invoices had item-level discounts.
 *
 * What it does:
 * 1. Finds all stock lots from purchase invoice items with discounts > 0
 * 2. Recalculates the correct unit cost (original cost - discount)
 * 3. Updates the stock lot unit cost
 * 4. If the lot has consumptions, updates those consumption records
 * 5. Recalculates COGS for affected sales invoices
 *
 * Run with: npx tsx scripts/fix-discounted-stock-lots.ts
 */

import dotenv from "dotenv";
import prisma from "../src/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🔍 Starting migration to fix discounted stock lot unit costs...\n");

  try {
    // Find all purchase invoice items with discounts
    const itemsWithDiscounts = await prisma.purchaseInvoiceItem.findMany({
      where: {
        discount: { gt: 0 },
      },
      include: {
        stockLot: {
          include: {
            consumptions: {
              include: {
                invoiceItem: true,
              },
            },
          },
        },
        purchaseInvoice: {
          select: {
            purchaseInvoiceNumber: true,
            invoiceDate: true,
          },
        },
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (itemsWithDiscounts.length === 0) {
      console.log("✅ No purchase invoice items with discounts found. Nothing to fix.");
      return;
    }

    console.log(`📊 Found ${itemsWithDiscounts.length} purchase invoice items with discounts\n`);

    let fixedLots = 0;
    let fixedConsumptions = 0;
    let affectedInvoices = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const item of itemsWithDiscounts) {
        if (!item.stockLot) {
          console.log(`⚠️  No stock lot found for item ${item.id}, skipping...`);
          continue;
        }

        const lot = item.stockLot;

        // Calculate the correct net unit cost after discount
        const discountFactor = new Decimal(1).minus(new Decimal(item.discount).div(100));
        const correctUnitCost = new Decimal(item.unitCost).mul(discountFactor);
        const oldUnitCost = lot.unitCost;

        // Check if the lot already has the correct cost (already fixed or created after the fix)
        if (new Decimal(oldUnitCost).equals(correctUnitCost)) {
          console.log(`✓ Lot ${lot.id} already has correct cost, skipping...`);
          continue;
        }

        console.log(`\n📦 Processing: ${item.product.name}`);
        console.log(`   Invoice: ${item.purchaseInvoice.purchaseInvoiceNumber}`);
        console.log(`   Original Cost: $${item.unitCost}`);
        console.log(`   Discount: ${item.discount}%`);
        console.log(`   Old Lot Cost: $${oldUnitCost} ❌`);
        console.log(`   Correct Lot Cost: $${correctUnitCost} ✓`);

        // Update the stock lot unit cost
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { unitCost: correctUnitCost },
        });

        fixedLots++;

        // If this lot has consumptions, we need to fix those too
        if (lot.consumptions.length > 0) {
          console.log(`   📌 Fixing ${lot.consumptions.length} consumption(s)...`);

          for (const consumption of lot.consumptions) {
            // Recalculate consumption costs with the correct unit cost
            const newTotalCost = new Decimal(consumption.quantityConsumed).mul(correctUnitCost);

            await tx.stockLotConsumption.update({
              where: { id: consumption.id },
              data: {
                unitCost: correctUnitCost,
                totalCost: newTotalCost,
              },
            });

            fixedConsumptions++;
            affectedInvoices.add(consumption.invoiceItemId);
          }
        }
      }

      // Recalculate COGS for all affected invoice items
      if (affectedInvoices.size > 0) {
        console.log(`\n💰 Recalculating COGS for ${affectedInvoices.size} affected sales invoice item(s)...`);

        for (const invoiceItemId of affectedInvoices) {
          // Sum up all consumptions for this invoice item
          const consumptions = await tx.stockLotConsumption.findMany({
            where: { invoiceItemId },
          });

          const totalCOGS = consumptions.reduce(
            (sum, c) => sum.add(c.totalCost),
            new Decimal(0)
          );

          await tx.invoiceItem.update({
            where: { id: invoiceItemId },
            data: { costOfGoodsSold: totalCOGS },
          });
        }
      }
    });

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Stock lots fixed: ${fixedLots}`);
    console.log(`   - Consumptions updated: ${fixedConsumptions}`);
    console.log(`   - Sales invoice items recalculated: ${affectedInvoices.size}`);
    console.log("=".repeat(60));

    if (fixedLots === 0) {
      console.log("\n💡 All stock lots already have correct costs. No changes needed.");
    }

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
