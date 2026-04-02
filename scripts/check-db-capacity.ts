/**
 * Neon DB Capacity Check Script
 * Run with: npx tsx scripts/check-db-capacity.ts
 *
 * Estimates current storage usage and remaining customer capacity
 * based on Neon Free Plan limits (512 MiB).
 */

import { PrismaClient } from "../src/generated/prisma";

const NEON_FREE_STORAGE_BYTES = 512 * 1024 * 1024; // 512 MiB

async function checkCapacity() {
  const prisma = new PrismaClient();

  try {
    // Get current database size
    const dbSize = await prisma.$queryRaw<
      { pg_database_size: bigint }[]
    >`SELECT pg_database_size(current_database())`;
    const currentSizeBytes = Number(dbSize[0].pg_database_size);

    // Get table sizes for key tables
    const tableSizes = await prisma.$queryRaw<
      { table_name: string; total_size: string }[]
    >`
      SELECT
        relname AS table_name,
        pg_total_relation_size(c.oid)::text AS total_size
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 15
    `;

    // Get row counts for important tables
    const customerCount = await prisma.customer.count();
    const invoiceCount = await prisma.invoice.count();
    const productCount = await prisma.product.count();
    const paymentCount = await prisma.payment.count();
    const transactionCount = await prisma.customerTransaction.count();

    // Calculate
    const usedPercent = ((currentSizeBytes / NEON_FREE_STORAGE_BYTES) * 100).toFixed(1);
    const remainingBytes = NEON_FREE_STORAGE_BYTES - currentSizeBytes;
    const avgBytesPerCustomer =
      customerCount > 0 ? currentSizeBytes / customerCount : 25000; // fallback estimate

    const estimatedRemainingCustomers = Math.floor(
      remainingBytes / avgBytesPerCustomer
    );

    console.log("=== Neon DB Capacity Report (Free Plan: 512 MiB) ===\n");
    console.log(
      `Database size:    ${formatBytes(currentSizeBytes)} / 512 MiB (${usedPercent}% used)`
    );
    console.log(`Remaining:        ${formatBytes(remainingBytes)}\n`);

    console.log("--- Row Counts ---");
    console.log(`Customers:        ${customerCount}`);
    console.log(`Invoices:         ${invoiceCount}`);
    console.log(`Products:         ${productCount}`);
    console.log(`Payments:         ${paymentCount}`);
    console.log(`Transactions:     ${transactionCount}\n`);

    console.log("--- Top 15 Tables by Size ---");
    for (const t of tableSizes) {
      const sizeNum = Number(t.total_size);
      console.log(`  ${t.table_name.padEnd(35)} ${formatBytes(sizeNum)}`);
    }

    console.log("\n--- Capacity Estimate ---");
    if (customerCount > 0) {
      console.log(
        `Avg data per customer (all tables): ~${formatBytes(Math.round(avgBytesPerCustomer))}`
      );
    }
    console.log(
      `Est. additional customers possible:  ~${estimatedRemainingCustomers.toLocaleString()}`
    );

    if (Number(usedPercent) > 80) {
      console.log(
        "\n⚠ WARNING: Storage usage above 80%. Consider upgrading to Neon Launch plan ($19/mo)."
      );
    } else if (Number(usedPercent) > 60) {
      console.log(
        "\n⚠ NOTICE: Storage usage above 60%. Monitor growth closely."
      );
    } else {
      console.log("\n✓ Storage usage is healthy.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

checkCapacity().catch(console.error);
