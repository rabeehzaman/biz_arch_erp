// Script to delete all opening stock transactions
// Run with: npx tsx prisma/delete-opening-stocks.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function deleteOpeningStocks() {
  console.log('🗑️  Deleting all opening stock transactions...\n')

  try {
    // 1. First, get all stock lots that are from opening stock
    const openingStockLots = await prisma.stockLot.findMany({
      where: { sourceType: 'OPENING_STOCK' },
      select: { id: true }
    });
    const lotIds = openingStockLots.map(lot => lot.id);

    console.log(`Found ${lotIds.length} opening stock lots to delete`)

    // 2. Delete stock lot consumptions for opening stock lots
    const deletedConsumptions = await prisma.stockLotConsumption.deleteMany({
      where: { stockLotId: { in: lotIds } }
    });
    console.log(`✓ Deleted ${deletedConsumptions.count} stock lot consumptions`)

    // 3. Delete the stock lots from opening stock
    const deletedStockLots = await prisma.stockLot.deleteMany({
      where: { sourceType: 'OPENING_STOCK' }
    });
    console.log(`✓ Deleted ${deletedStockLots.count} stock lots`)

    // 4. Delete all opening stock records
    const deletedOpeningStocks = await prisma.openingStock.deleteMany({});
    console.log(`✓ Deleted ${deletedOpeningStocks.count} opening stocks`)

    console.log('\n✅ All opening stock transactions have been deleted!')

  } catch (error) {
    console.error('❌ Error deleting opening stocks:', error)
    throw error
  }
}

deleteOpeningStocks()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
