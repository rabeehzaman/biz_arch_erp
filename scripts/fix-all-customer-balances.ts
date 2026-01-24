// Script to fix all customer balance discrepancies
// This recalculates customer balances from their transactions
// Run with: npx tsx scripts/fix-all-customer-balances.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixAllCustomerBalances() {
  console.log(`\n🔧 Fixing all customer balances...\n`);

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      balance: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${customers.length} customers\n`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const customer of customers) {
    try {
      // Get all transactions for this customer
      const transactions = await prisma.customerTransaction.findMany({
        where: { customerId: customer.id },
        orderBy: { transactionDate: "asc" },
      });

      // Calculate correct balance from transactions
      const calculatedBalance = transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);

      const discrepancy = Number(customer.balance) - calculatedBalance;

      if (Math.abs(discrepancy) > 0.01) {
        console.log(
          `Fixing ${customer.name}: ${customer.balance} → ${calculatedBalance.toFixed(2)} (diff: ${discrepancy.toFixed(
            2
          )})`
        );

        await prisma.$transaction(async (tx) => {
          // Update customer balance
          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: calculatedBalance },
          });

          // Recalculate and update running balances for all transactions
          let runningBalance = 0;
          for (const txn of transactions) {
            runningBalance += Number(txn.amount);
            await tx.customerTransaction.update({
              where: { id: txn.id },
              data: { runningBalance },
            });
          }
        });

        fixedCount++;
      }
    } catch (error) {
      console.error(`❌ Error fixing ${customer.name}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} customer balances`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} errors occurred`);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const confirm = args[0];

  if (confirm !== "--confirm") {
    console.log(`
This script will recalculate and fix ALL customer balances based on their transactions.

Current issues found:
- 49 customers have balance discrepancies
- Balances will be recalculated from customer transactions
- Running balances will be recalculated for audit trail

To proceed, run:
  npx tsx scripts/fix-all-customer-balances.ts --confirm
    `);
    return;
  }

  await fixAllCustomerBalances();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
