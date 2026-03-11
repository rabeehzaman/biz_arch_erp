-- AlterTable
ALTER TABLE "products" ADD COLUMN "is_bundle" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_bundle_items" (
    "id" TEXT NOT NULL,
    "bundle_product_id" TEXT NOT NULL,
    "component_product_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_bundle_items_organization_id_idx" ON "product_bundle_items"("organization_id");

-- CreateIndex
CREATE INDEX "product_bundle_items_bundle_product_id_idx" ON "product_bundle_items"("bundle_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_bundle_items_bundle_product_id_component_product_id_key" ON "product_bundle_items"("bundle_product_id", "component_product_id");

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_bundle_product_id_fkey" FOREIGN KEY ("bundle_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
