-- Add jewellery fields to invoice_items
ALTER TABLE "invoice_items" ADD COLUMN "jewelleryItemId" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "goldRate" DECIMAL(12,2);
ALTER TABLE "invoice_items" ADD COLUMN "purity" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "metalType" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "grossWeight" DECIMAL(10,3);
ALTER TABLE "invoice_items" ADD COLUMN "netWeight" DECIMAL(10,3);
ALTER TABLE "invoice_items" ADD COLUMN "fineWeight" DECIMAL(10,3);
ALTER TABLE "invoice_items" ADD COLUMN "wastagePercent" DECIMAL(5,2);
ALTER TABLE "invoice_items" ADD COLUMN "makingChargeType" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "makingChargeValue" DECIMAL(12,2);
ALTER TABLE "invoice_items" ADD COLUMN "stoneValue" DECIMAL(15,2);
ALTER TABLE "invoice_items" ADD COLUMN "tagNumber" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "huidNumber" TEXT;

-- Add jewellery fields to quotation_items
ALTER TABLE "quotation_items" ADD COLUMN "jewelleryItemId" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "goldRate" DECIMAL(12,2);
ALTER TABLE "quotation_items" ADD COLUMN "purity" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "metalType" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "grossWeight" DECIMAL(10,3);
ALTER TABLE "quotation_items" ADD COLUMN "netWeight" DECIMAL(10,3);
ALTER TABLE "quotation_items" ADD COLUMN "fineWeight" DECIMAL(10,3);
ALTER TABLE "quotation_items" ADD COLUMN "wastagePercent" DECIMAL(5,2);
ALTER TABLE "quotation_items" ADD COLUMN "makingChargeType" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "makingChargeValue" DECIMAL(12,2);
ALTER TABLE "quotation_items" ADD COLUMN "stoneValue" DECIMAL(15,2);
ALTER TABLE "quotation_items" ADD COLUMN "tagNumber" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "huidNumber" TEXT;

-- Add jewellery fields to purchase_invoice_items
ALTER TABLE "purchase_invoice_items" ADD COLUMN "jewelleryItemId" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "goldRate" DECIMAL(12,2);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "purity" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "metalType" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "grossWeight" DECIMAL(10,3);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "netWeight" DECIMAL(10,3);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "fineWeight" DECIMAL(10,3);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "wastagePercent" DECIMAL(5,2);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "makingChargeType" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "makingChargeValue" DECIMAL(12,2);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "stoneValue" DECIMAL(15,2);
ALTER TABLE "purchase_invoice_items" ADD COLUMN "tagNumber" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "huidNumber" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "karigarId" TEXT;

-- Add jewellery fields to credit_note_items
ALTER TABLE "credit_note_items" ADD COLUMN "jewelleryItemId" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "goldRate" DECIMAL(12,2);
ALTER TABLE "credit_note_items" ADD COLUMN "purity" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "metalType" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "grossWeight" DECIMAL(10,3);
ALTER TABLE "credit_note_items" ADD COLUMN "netWeight" DECIMAL(10,3);
ALTER TABLE "credit_note_items" ADD COLUMN "fineWeight" DECIMAL(10,3);
ALTER TABLE "credit_note_items" ADD COLUMN "wastagePercent" DECIMAL(5,2);
ALTER TABLE "credit_note_items" ADD COLUMN "makingChargeType" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "makingChargeValue" DECIMAL(12,2);
ALTER TABLE "credit_note_items" ADD COLUMN "stoneValue" DECIMAL(15,2);
ALTER TABLE "credit_note_items" ADD COLUMN "tagNumber" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "huidNumber" TEXT;

-- Add jewellery fields to debit_note_items
ALTER TABLE "debit_note_items" ADD COLUMN "jewelleryItemId" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "goldRate" DECIMAL(12,2);
ALTER TABLE "debit_note_items" ADD COLUMN "purity" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "metalType" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "grossWeight" DECIMAL(10,3);
ALTER TABLE "debit_note_items" ADD COLUMN "netWeight" DECIMAL(10,3);
ALTER TABLE "debit_note_items" ADD COLUMN "fineWeight" DECIMAL(10,3);
ALTER TABLE "debit_note_items" ADD COLUMN "wastagePercent" DECIMAL(5,2);
ALTER TABLE "debit_note_items" ADD COLUMN "makingChargeType" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "makingChargeValue" DECIMAL(12,2);
ALTER TABLE "debit_note_items" ADD COLUMN "stoneValue" DECIMAL(15,2);
ALTER TABLE "debit_note_items" ADD COLUMN "tagNumber" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "huidNumber" TEXT;

-- Add jewellery fields to invoices
ALTER TABLE "invoices" ADD COLUMN "isJewellerySale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "oldGoldDeduction" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Add foreign key constraints
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "invoice_items_jewelleryItemId_idx" ON "invoice_items"("jewelleryItemId");
CREATE INDEX "quotation_items_jewelleryItemId_idx" ON "quotation_items"("jewelleryItemId");
CREATE INDEX "purchase_invoice_items_jewelleryItemId_idx" ON "purchase_invoice_items"("jewelleryItemId");
CREATE INDEX "credit_note_items_jewelleryItemId_idx" ON "credit_note_items"("jewelleryItemId");
CREATE INDEX "debit_note_items_jewelleryItemId_idx" ON "debit_note_items"("jewelleryItemId");
