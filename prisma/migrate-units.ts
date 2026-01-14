import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrateUnits() {
  console.log("Starting unit migration...");

  try {
    // Get all products with unitCode but no unitId
    const products = await prisma.product.findMany({
      where: {
        unitCode: { not: null },
        unitId: null,
      },
      select: {
        id: true,
        name: true,
        unitCode: true,
      },
    });

    console.log(`Found ${products.length} products to migrate`);

    if (products.length === 0) {
      console.log("No products need migration");
      return;
    }

    // Get all unique unit codes
    const uniqueUnitCodes = [
      ...new Set(products.map((p) => p.unitCode).filter((code): code is string => code !== null)),
    ];
    console.log(`Unique unit codes found: ${uniqueUnitCodes.join(", ")}`);

    // Map of unit code to unit ID
    const unitCodeToIdMap: Record<string, string> = {};

    // For each unique unit code, find or create the unit
    for (const code of uniqueUnitCodes) {
      const lowerCode = code.toLowerCase();

      // Try to find existing unit by code
      let unit = await prisma.unit.findUnique({
        where: { code: lowerCode },
      });

      // If not found, create it with a capitalized name
      if (!unit) {
        const name = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
        console.log(`Creating new unit: ${lowerCode} (${name})`);

        unit = await prisma.unit.create({
          data: {
            code: lowerCode,
            name: name,
          },
        });
      }

      unitCodeToIdMap[code] = unit.id;
    }

    // Update all products with their unitId
    let updatedCount = 0;
    for (const product of products) {
      if (product.unitCode) {
        const unitId = unitCodeToIdMap[product.unitCode];
        if (unitId) {
          await prisma.product.update({
            where: { id: product.id },
            data: { unitId },
          });
          updatedCount++;
        }
      }
    }

    console.log(`Successfully migrated ${updatedCount} products`);

    // Verify migration
    const remainingProducts = await prisma.product.count({
      where: {
        unitCode: { not: null },
        unitId: null,
      },
    });

    if (remainingProducts === 0) {
      console.log("✓ All products have been successfully migrated!");
    } else {
      console.warn(`⚠ Warning: ${remainingProducts} products still need migration`);
    }

    // Show summary
    const allUnits = await prisma.unit.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { code: "asc" },
    });

    console.log("\nUnit Summary:");
    allUnits.forEach((unit) => {
      console.log(`  - ${unit.name} (${unit.code}): ${unit._count.products} products`);
    });
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

migrateUnits();
