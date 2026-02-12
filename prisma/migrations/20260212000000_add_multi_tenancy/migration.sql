-- CreateTable: Organization
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- Create default organization for backfill
INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('default-org', 'Default Organization', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- Step 1: Add organizationId as NULLABLE to all tables
-- ============================================================

ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "units" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "products" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "customers" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "customer_assignments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "quotations" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "purchase_invoices" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "credit_notes" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "credit_note_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "debit_notes" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "debit_note_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "debit_note_lot_consumptions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "payments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "payment_allocations" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "supplier_payments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "supplier_payment_allocations" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "stock_lots" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "stock_lot_consumptions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "opening_stocks" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "cost_audit_logs" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "customer_transactions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "supplier_transactions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "settings" ADD COLUMN "organizationId" TEXT;

-- ============================================================
-- Step 2: Backfill all existing rows with the default org ID
-- ============================================================

UPDATE "users" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "units" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "products" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "customers" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "customer_assignments" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "suppliers" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "invoices" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "invoice_items" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "quotations" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "quotation_items" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "purchase_invoices" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "purchase_invoice_items" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "credit_notes" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "credit_note_items" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "debit_notes" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "debit_note_items" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "debit_note_lot_consumptions" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "payments" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "payment_allocations" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "supplier_payments" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "supplier_payment_allocations" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "stock_lots" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "stock_lot_consumptions" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "opening_stocks" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "cost_audit_logs" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "customer_transactions" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "supplier_transactions" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "settings" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;

-- ============================================================
-- Step 3: Make organizationId NOT NULL
-- ============================================================

ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "units" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "customer_assignments" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "suppliers" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "invoice_items" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "quotations" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "quotation_items" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "purchase_invoices" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "purchase_invoice_items" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "credit_notes" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "credit_note_items" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "debit_notes" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "debit_note_items" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "debit_note_lot_consumptions" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "payment_allocations" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "supplier_payments" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "supplier_payment_allocations" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "stock_lots" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "stock_lot_consumptions" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "opening_stocks" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "cost_audit_logs" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "customer_transactions" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "supplier_transactions" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "settings" ALTER COLUMN "organizationId" SET NOT NULL;

-- ============================================================
-- Step 4: Drop old unique constraints and add org-scoped ones
-- ============================================================

-- Units: code unique -> (organizationId, code) unique
DROP INDEX IF EXISTS "units_code_key";

-- Products: sku unique -> (organizationId, sku) unique
DROP INDEX IF EXISTS "products_sku_key";

-- Invoices: invoiceNumber unique -> (organizationId, invoiceNumber) unique
DROP INDEX IF EXISTS "invoices_invoiceNumber_key";

-- Quotations: quotationNumber unique -> (organizationId, quotationNumber) unique
DROP INDEX IF EXISTS "quotations_quotationNumber_key";

-- PurchaseInvoices: purchaseInvoiceNumber unique -> (organizationId, purchaseInvoiceNumber) unique
DROP INDEX IF EXISTS "purchase_invoices_purchaseInvoiceNumber_key";

-- CreditNotes: creditNoteNumber unique -> (organizationId, creditNoteNumber) unique
DROP INDEX IF EXISTS "credit_notes_creditNoteNumber_key";

-- DebitNotes: debitNoteNumber unique -> (organizationId, debitNoteNumber) unique
DROP INDEX IF EXISTS "debit_notes_debitNoteNumber_key";

-- Payments: paymentNumber unique -> (organizationId, paymentNumber) unique
DROP INDEX IF EXISTS "payments_paymentNumber_key";

-- SupplierPayments: paymentNumber unique -> (organizationId, paymentNumber) unique
DROP INDEX IF EXISTS "supplier_payments_paymentNumber_key";

-- Settings: key unique -> (organizationId, key) unique
DROP INDEX IF EXISTS "settings_key_key";

-- Create new compound unique indexes
CREATE UNIQUE INDEX "units_organizationId_code_key" ON "units"("organizationId", "code");
CREATE UNIQUE INDEX "products_organizationId_sku_key" ON "products"("organizationId", "sku");
CREATE UNIQUE INDEX "invoices_organizationId_invoiceNumber_key" ON "invoices"("organizationId", "invoiceNumber");
CREATE UNIQUE INDEX "quotations_organizationId_quotationNumber_key" ON "quotations"("organizationId", "quotationNumber");
CREATE UNIQUE INDEX "purchase_invoices_organizationId_purchaseInvoiceNumber_key" ON "purchase_invoices"("organizationId", "purchaseInvoiceNumber");
CREATE UNIQUE INDEX "credit_notes_organizationId_creditNoteNumber_key" ON "credit_notes"("organizationId", "creditNoteNumber");
CREATE UNIQUE INDEX "debit_notes_organizationId_debitNoteNumber_key" ON "debit_notes"("organizationId", "debitNoteNumber");
CREATE UNIQUE INDEX "payments_organizationId_paymentNumber_key" ON "payments"("organizationId", "paymentNumber");
CREATE UNIQUE INDEX "supplier_payments_organizationId_paymentNumber_key" ON "supplier_payments"("organizationId", "paymentNumber");
CREATE UNIQUE INDEX "settings_organizationId_key_key" ON "settings"("organizationId", "key");

-- ============================================================
-- Step 5: Add foreign key constraints
-- ============================================================

ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "units" ADD CONSTRAINT "units_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debit_note_lot_consumptions" ADD CONSTRAINT "debit_note_lot_consumptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_audit_logs" ADD CONSTRAINT "cost_audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Step 6: Add organizationId indexes for query performance
-- ============================================================

CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "units_organizationId_idx" ON "units"("organizationId");
CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");
CREATE INDEX "customer_assignments_organizationId_idx" ON "customer_assignments"("organizationId");
CREATE INDEX "suppliers_organizationId_idx" ON "suppliers"("organizationId");
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");
CREATE INDEX "invoice_items_organizationId_idx" ON "invoice_items"("organizationId");
CREATE INDEX "quotations_organizationId_idx" ON "quotations"("organizationId");
CREATE INDEX "quotation_items_organizationId_idx" ON "quotation_items"("organizationId");
CREATE INDEX "purchase_invoices_organizationId_idx" ON "purchase_invoices"("organizationId");
CREATE INDEX "purchase_invoice_items_organizationId_idx" ON "purchase_invoice_items"("organizationId");
CREATE INDEX "credit_notes_organizationId_idx" ON "credit_notes"("organizationId");
CREATE INDEX "credit_note_items_organizationId_idx" ON "credit_note_items"("organizationId");
CREATE INDEX "debit_notes_organizationId_idx" ON "debit_notes"("organizationId");
CREATE INDEX "debit_note_items_organizationId_idx" ON "debit_note_items"("organizationId");
CREATE INDEX "debit_note_lot_consumptions_organizationId_idx" ON "debit_note_lot_consumptions"("organizationId");
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");
CREATE INDEX "payment_allocations_organizationId_idx" ON "payment_allocations"("organizationId");
CREATE INDEX "supplier_payments_organizationId_idx" ON "supplier_payments"("organizationId");
CREATE INDEX "supplier_payment_allocations_organizationId_idx" ON "supplier_payment_allocations"("organizationId");
CREATE INDEX "stock_lots_organizationId_idx" ON "stock_lots"("organizationId");
CREATE INDEX "stock_lot_consumptions_organizationId_idx" ON "stock_lot_consumptions"("organizationId");
CREATE INDEX "opening_stocks_organizationId_idx" ON "opening_stocks"("organizationId");
CREATE INDEX "cost_audit_logs_organizationId_idx" ON "cost_audit_logs"("organizationId");
CREATE INDEX "customer_transactions_organizationId_idx" ON "customer_transactions"("organizationId");
CREATE INDEX "supplier_transactions_organizationId_idx" ON "supplier_transactions"("organizationId");
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");
