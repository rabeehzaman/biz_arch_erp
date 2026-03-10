/**
 * Import products from Odoo 19 (Contabo VPS) into BizArch ERP
 * Target org: qimma-adawi
 *
 * Usage:
 *   cd "/Users/tmr/Desktop/Final Projects/biz_arch_erp"
 *   npx tsx scripts/import-odoo-products.ts
 */

import { execSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  parseWeightBarcode,
  WeighMachineConfig,
} from "../src/lib/weigh-machine/barcode-parser";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ODOO_HOST = "root@81.17.98.163";
const ODOO_DB = "production1";
const TARGET_ORG_SLUG = "qimma-adawi";

interface OdooProduct {
  odoo_id: number;
  name: string;
  price: number | null;
  cost: number | null;
  description: string | null;
  type: "service" | "consu" | "product";
  sku: string | null;
  barcode: string | null;
  uom_name: string | null;
  category_name: string | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchOdooProducts(): Promise<OdooProduct[]> {
  const sql = `
SELECT json_agg(t) FROM (
  SELECT
    pt.id        AS odoo_id,
    pt.name->>'en_US' AS name,
    pt.list_price  AS price,
    pp.standard_price AS cost,
    COALESCE(pt.description_sale->>'en_US', '') AS description,
    pt.type,
    pp.default_code  AS sku,
    pp.barcode,
    uu.name->>'en_US' AS uom_name,
    pc.complete_name AS category_name
  FROM product_template pt
  LEFT JOIN LATERAL (
    SELECT default_code, barcode, (standard_price->>'1')::numeric AS standard_price FROM product_product
    WHERE product_tmpl_id = pt.id AND active = true ORDER BY id LIMIT 1
  ) pp ON true
  LEFT JOIN uom_uom uu ON uu.id = pt.uom_id
  LEFT JOIN product_category pc ON pc.id = pt.categ_id
  WHERE pt.active = true
  ORDER BY pt.id
) t
  `.trim().replace(/\n/g, " ");

  const cmd = `ssh -o StrictHostKeyChecking=no ${ODOO_HOST} "sudo -u postgres psql -d ${ODOO_DB} -t -A -c \\"${sql.replace(/"/g, '\\"')}\\""`;

  console.log("Connecting to Odoo server via SSH...");
  const output = execSync(cmd, { encoding: "utf8", timeout: 60000 }).trim();

  if (!output || output === "NULL") {
    console.log("No products returned from Odoo.");
    return [];
  }

  const products: OdooProduct[] = JSON.parse(output);
  console.log(`Fetched ${products.length} products from Odoo.`);
  return products;
}

async function main() {
  // 1. Find target org
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: TARGET_ORG_SLUG },
    select: {
      id: true,
      name: true,
      isWeighMachineEnabled: true,
      weighMachineBarcodePrefix: true,
      weighMachineProductCodeLen: true,
      weighMachineWeightDigits: true,
      weighMachineDecimalPlaces: true,
    },
  });
  const organizationId = org.id;
  console.log(`Target org: "${org.name}" (${organizationId})`);

  // Build weigh machine config if enabled
  const weighConfig: WeighMachineConfig | null =
    org.isWeighMachineEnabled &&
    org.weighMachineBarcodePrefix &&
    org.weighMachineProductCodeLen &&
    org.weighMachineWeightDigits &&
    org.weighMachineDecimalPlaces
      ? {
          prefix: org.weighMachineBarcodePrefix,
          productCodeLen: org.weighMachineProductCodeLen,
          weightDigits: org.weighMachineWeightDigits,
          decimalPlaces: org.weighMachineDecimalPlaces,
        }
      : null;

  if (weighConfig) {
    console.log(
      `Weigh machine enabled: prefix="${weighConfig.prefix}", codeLen=${weighConfig.productCodeLen}`
    );
  }

  // 2. Fetch products from Odoo
  const odooProducts = await fetchOdooProducts();
  if (odooProducts.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  // 3. Pre-populate unit and category caches
  const unitCache = new Map<string, string>(); // uom_name → unit.id
  const categoryCache = new Map<string, string>(); // category_name → category.id

  // 4. Process each product
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of odooProducts) {
    try {
      // --- Unit ---
      let unitId: string | null = null;
      if (p.uom_name) {
        const uomName = p.uom_name.trim();
        if (unitCache.has(uomName)) {
          unitId = unitCache.get(uomName)!;
        } else {
          const code = slugify(uomName).slice(0, 20) || "unit";
          const unit = await prisma.unit.upsert({
            where: { organizationId_code: { organizationId, code } },
            update: {},
            create: {
              code,
              name: uomName,
              isActive: true,
              organizationId,
            },
          });
          unitCache.set(uomName, unit.id);
          unitId = unit.id;
        }
      }

      if (!unitId) {
        // Fallback: find or create a "pcs" unit
        const fallbackCode = "pcs";
        if (unitCache.has("__fallback__")) {
          unitId = unitCache.get("__fallback__")!;
        } else {
          const unit = await prisma.unit.upsert({
            where: { organizationId_code: { organizationId, code: fallbackCode } },
            update: {},
            create: {
              code: fallbackCode,
              name: "Pieces",
              isActive: true,
              organizationId,
            },
          });
          unitCache.set("__fallback__", unit.id);
          unitId = unit.id;
        }
      }

      // --- Category ---
      let categoryId: string | null = null;
      if (p.category_name) {
        const catName = p.category_name.trim();
        if (categoryCache.has(catName)) {
          categoryId = categoryCache.get(catName)!;
        } else {
          const slug = slugify(catName).slice(0, 80) || "category";
          const cat = await prisma.productCategory.upsert({
            where: { organizationId_slug: { organizationId, slug } },
            update: {},
            create: {
              name: catName,
              slug,
              organizationId,
            },
          });
          categoryCache.set(catName, cat.id);
          categoryId = cat.id;
        }
      }

      // --- Barcode handling ---
      let regularBarcode: string | null = null;
      let weighMachineCode: string | null = null;

      if (p.barcode) {
        const bc = p.barcode.trim();
        if (weighConfig) {
          const parsed = parseWeightBarcode(bc, weighConfig);
          if (parsed) {
            weighMachineCode = parsed.productCode;
          } else {
            regularBarcode = bc;
          }
        } else {
          regularBarcode = bc;
        }
      }

      // --- Upsert product ---
      const isService = p.type === "service";
      const productData = {
        name: p.name.trim(),
        description: p.description || null,
        price: p.price ?? 0,
        cost: p.cost ?? 0,
        unitId,
        categoryId,
        isService,
        sku: p.sku?.trim() || null,
        barcode: regularBarcode,
        weighMachineCode,
        organizationId,
      };

      if (productData.sku) {
        // Upsert by SKU
        await prisma.product.upsert({
          where: { organizationId_sku: { organizationId, sku: productData.sku } },
          update: {
            name: productData.name,
            description: productData.description,
            price: productData.price,
            cost: productData.cost,
            unitId: productData.unitId,
            categoryId: productData.categoryId,
            isService: productData.isService,
            barcode: productData.barcode,
            weighMachineCode: productData.weighMachineCode,
          },
          create: productData,
        });
        updated++;
      } else {
        // No SKU — check by name to avoid duplicates, then create
        const existing = await prisma.product.findFirst({
          where: { organizationId, name: productData.name },
          select: { id: true },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              description: productData.description,
              price: productData.price,
              cost: productData.cost,
              unitId: productData.unitId,
              categoryId: productData.categoryId,
              isService: productData.isService,
              barcode: productData.barcode,
              weighMachineCode: productData.weighMachineCode,
            },
          });
          updated++;
        } else {
          await prisma.product.create({ data: productData });
          created++;
        }
      }

      process.stdout.write(".");
    } catch (err) {
      skipped++;
      console.error(`\nFailed to import "${p.name}" (odoo_id=${p.odoo_id}):`, err);
    }
  }

  console.log("\n");
  console.log(`Import complete:`);
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Units cached   : ${unitCache.size}`);
  console.log(`  Categories cached: ${categoryCache.size}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
