-- Add multiUnitEnabled to organizations
ALTER TABLE "organizations" ADD COLUMN "multiUnitEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: unit_conversions
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "conversionFactor" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_organizationId_fromUnitId_toUnitId_key" ON "unit_conversions"("organizationId", "fromUnitId", "toUnitId");
CREATE INDEX "unit_conversions_organizationId_idx" ON "unit_conversions"("organizationId");
CREATE INDEX "unit_conversions_fromUnitId_idx" ON "unit_conversions"("fromUnitId");
CREATE INDEX "unit_conversions_toUnitId_idx" ON "unit_conversions"("toUnitId");

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add unitId and conversionFactor to invoice_items
ALTER TABLE "invoice_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unitId and conversionFactor to quotation_items
ALTER TABLE "quotation_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unitId and conversionFactor to purchase_invoice_items
ALTER TABLE "purchase_invoice_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unitId and conversionFactor to credit_note_items
ALTER TABLE "credit_note_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1;
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unitId and conversionFactor to debit_note_items
ALTER TABLE "debit_note_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1;
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
