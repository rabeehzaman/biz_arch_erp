/**
 * Import products from CSV into Ruwayd Al Raida Trading EST
 *
 * Usage:
 *   npx tsx scripts/import-ruwayd-products.ts
 */

import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CSV_PATH = "/Users/rabeehzaman/Downloads/RuwaydaItemimport.csv";
const ORG_ID = "cmnl86ru4000004kzuzocthnw";
const GST_RATE = 15; // Saudi 15% VAT

const UNIT_MAP: Record<string, string> = {
  CTN: "cmnle888z000104jvcpuf4qa9",
  KG: "cmnlo9h66000004jo4dn3fsop",
  PCS: "cmnle8dri000j04laykbaj8a6",
};

async function main() {
  const raw = readFileSync(CSV_PATH, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim());

  // Skip header
  const dataLines = lines.slice(1);
  console.log(`Parsed ${dataLines.length} rows from CSV`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const line of dataLines) {
    const [name, unitCode, sellingRate, purchaseRate, ...arabicParts] =
      line.split(",");

    const trimmedName = name.trim();
    if (!trimmedName) {
      skipped++;
      continue;
    }

    const unitId = UNIT_MAP[unitCode?.trim().toUpperCase()];
    if (!unitId) {
      console.error(`Unknown unit "${unitCode}" for "${trimmedName}", skipping`);
      skipped++;
      continue;
    }

    const price = parseFloat(sellingRate) || 0;
    const cost = parseFloat(purchaseRate) || 0;
    const arabicName = arabicParts.join(",").trim() || null;

    try {
      const existing = await prisma.product.findFirst({
        where: { organizationId: ORG_ID, name: trimmedName },
        select: { id: true },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { price, cost, unitId, arabicName, gstRate: GST_RATE },
        });
        updated++;
      } else {
        await prisma.product.create({
          data: {
            name: trimmedName,
            arabicName,
            price,
            cost,
            unitId,
            gstRate: GST_RATE,
            organizationId: ORG_ID,
          },
        });
        created++;
      }
      process.stdout.write(".");
    } catch (err) {
      skipped++;
      console.error(`\nFailed "${trimmedName}":`, err);
    }
  }

  console.log("\n");
  console.log("Import complete:");
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
