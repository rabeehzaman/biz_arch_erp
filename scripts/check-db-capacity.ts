/**
 * Neon DB Capacity Check Script (Multi-Tenant)
 * Run with: npx tsx scripts/check-db-capacity.ts
 *
 * Estimates current storage usage and remaining organization capacity
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
      LIMIT 20
    `;

    // Get row counts for multi-tenant metrics
    const orgCount = await prisma.organization.count();
    const userCount = await prisma.user.count();
    const customerCount = await prisma.customer.count();
    const invoiceCount = await prisma.invoice.count();
    const productCount = await prisma.product.count();
    const paymentCount = await prisma.payment.count();
    const transactionCount = await prisma.customerTransaction.count();

    // Per-org breakdown
    const orgBreakdown = await prisma.$queryRaw<
      { org_name: string; org_id: string; users: bigint; customers: bigint; invoices: bigint; products: bigint }[]
    >`
      SELECT
        o.name AS org_name,
        o.id AS org_id,
        (SELECT COUNT(*) FROM users u WHERE u."organizationId" = o.id) AS users,
        (SELECT COUNT(*) FROM customers c WHERE c."organizationId" = o.id) AS customers,
        (SELECT COUNT(*) FROM invoices i WHERE i."organizationId" = o.id) AS invoices,
        (SELECT COUNT(*) FROM products p WHERE p."organizationId" = o.id) AS products
      FROM organizations o
      ORDER BY o."createdAt" DESC
    `;

    // Calculate
    const usedPercent = ((currentSizeBytes / NEON_FREE_STORAGE_BYTES) * 100).toFixed(1);
    const remainingBytes = NEON_FREE_STORAGE_BYTES - currentSizeBytes;
    const avgBytesPerOrg =
      orgCount > 0 ? currentSizeBytes / orgCount : 3 * 1024 * 1024; // fallback: 3 MB

    const estimatedRemainingOrgs = Math.floor(remainingBytes / avgBytesPerOrg);

    console.log("=== Neon DB Multi-Tenant Capacity Report (Free Plan: 512 MiB) ===\n");
    console.log(
      `Database size:    ${formatBytes(currentSizeBytes)} / 512 MiB (${usedPercent}% used)`
    );
    console.log(`Remaining:        ${formatBytes(remainingBytes)}\n`);

    console.log("--- Global Counts ---");
    console.log(`Organizations:    ${orgCount}`);
    console.log(`Users:            ${userCount}`);
    console.log(`Customers:        ${customerCount}`);
    console.log(`Products:         ${productCount}`);
    console.log(`Invoices:         ${invoiceCount}`);
    console.log(`Payments:         ${paymentCount}`);
    console.log(`Transactions:     ${transactionCount}\n`);

    if (orgBreakdown.length > 0) {
      console.log("--- Per-Organization Breakdown ---");
      console.log(
        `${"Organization".padEnd(30)} ${"Users".padStart(6)} ${"Customers".padStart(10)} ${"Invoices".padStart(9)} ${"Products".padStart(9)}`
      );
      console.log("-".repeat(70));
      for (const org of orgBreakdown) {
        console.log(
          `${org.org_name.substring(0, 29).padEnd(30)} ${String(org.users).padStart(6)} ${String(org.customers).padStart(10)} ${String(org.invoices).padStart(9)} ${String(org.products).padStart(9)}`
        );
      }
      console.log();
    }

    console.log("--- Top 20 Tables by Size ---");
    for (const t of tableSizes) {
      const sizeNum = Number(t.total_size);
      console.log(`  ${t.table_name.padEnd(35)} ${formatBytes(sizeNum)}`);
    }

    console.log("\n--- Capacity Estimate ---");
    if (orgCount > 0) {
      console.log(
        `Avg data per organization:          ~${formatBytes(Math.round(avgBytesPerOrg))}`
      );
    }
    console.log(
      `Est. additional orgs possible:       ~${estimatedRemainingOrgs.toLocaleString()}`
    );

    // Guidance based on usage
    console.log("\n--- Recommended Plan ---");
    if (Number(usedPercent) > 80) {
      console.log(
        "WARNING: Storage above 80%. Upgrade to Neon Launch plan ($19/mo, 10 GiB)."
      );
    } else if (Number(usedPercent) > 60) {
      console.log(
        "NOTICE: Storage above 60%. Monitor growth — plan upgrade soon."
      );
    } else {
      console.log("Storage usage is healthy.");
    }

    if (orgCount <= 100) {
      console.log("Free plan ($0): Suitable for up to ~50-100 active orgs.");
    } else if (orgCount <= 1000) {
      console.log("Launch plan ($19/mo): Recommended for 100-1,000 orgs.");
    } else {
      console.log("Scale plan ($69/mo): Recommended for 1,000+ orgs with autoscaling.");
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
