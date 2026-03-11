-- Fix column naming: database uses camelCase, not snake_case

-- Rename column in products table
ALTER TABLE "products" RENAME COLUMN "is_bundle" TO "isBundle";

-- Rename columns in product_bundle_items table
ALTER TABLE "product_bundle_items" RENAME COLUMN "bundle_product_id" TO "bundleProductId";
ALTER TABLE "product_bundle_items" RENAME COLUMN "component_product_id" TO "componentProductId";
ALTER TABLE "product_bundle_items" RENAME COLUMN "organization_id" TO "organizationId";
ALTER TABLE "product_bundle_items" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "product_bundle_items" RENAME COLUMN "updated_at" TO "updatedAt";

-- Drop old indexes and constraints (they reference old column names)
DROP INDEX IF EXISTS "product_bundle_items_organization_id_idx";
DROP INDEX IF EXISTS "product_bundle_items_bundle_product_id_idx";
DROP INDEX IF EXISTS "product_bundle_items_bundle_product_id_component_product_id_key";

-- Recreate indexes with new column names
CREATE INDEX "product_bundle_items_organizationId_idx" ON "product_bundle_items"("organizationId");
CREATE INDEX "product_bundle_items_bundleProductId_idx" ON "product_bundle_items"("bundleProductId");
CREATE UNIQUE INDEX "product_bundle_items_bundleProductId_componentProductId_key" ON "product_bundle_items"("bundleProductId", "componentProductId");

-- Drop old foreign keys and recreate with new column names
ALTER TABLE "product_bundle_items" DROP CONSTRAINT IF EXISTS "product_bundle_items_bundle_product_id_fkey";
ALTER TABLE "product_bundle_items" DROP CONSTRAINT IF EXISTS "product_bundle_items_component_product_id_fkey";
ALTER TABLE "product_bundle_items" DROP CONSTRAINT IF EXISTS "product_bundle_items_organization_id_fkey";

ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_bundleProductId_fkey" FOREIGN KEY ("bundleProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
