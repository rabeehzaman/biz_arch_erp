-- Add missing indexes on foreign key columns for performance
-- These indexes speed up JOINs, WHERE clauses, and cascading deletes

-- InvoiceItem: parent FK and product FK
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");

-- QuotationItem: parent FK and product FK
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");
CREATE INDEX "quotation_items_productId_idx" ON "quotation_items"("productId");

-- Quotation: customer FK
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- PurchaseInvoiceItem: parent FK and product FK
CREATE INDEX "purchase_invoice_items_purchaseInvoiceId_idx" ON "purchase_invoice_items"("purchaseInvoiceId");
CREATE INDEX "purchase_invoice_items_productId_idx" ON "purchase_invoice_items"("productId");

-- CreditNote: customer lookup and invoice FK
CREATE INDEX "credit_notes_organizationId_customerId_idx" ON "credit_notes"("organizationId", "customerId");
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");

-- CreditNoteItem: parent FK and product FK
CREATE INDEX "credit_note_items_creditNoteId_idx" ON "credit_note_items"("creditNoteId");
CREATE INDEX "credit_note_items_productId_idx" ON "credit_note_items"("productId");

-- DebitNote: supplier lookup and purchase invoice FK
CREATE INDEX "debit_notes_organizationId_supplierId_idx" ON "debit_notes"("organizationId", "supplierId");
CREATE INDEX "debit_notes_purchaseInvoiceId_idx" ON "debit_notes"("purchaseInvoiceId");

-- DebitNoteItem: parent FK and product FK
CREATE INDEX "debit_note_items_debitNoteId_idx" ON "debit_note_items"("debitNoteId");
CREATE INDEX "debit_note_items_productId_idx" ON "debit_note_items"("productId");

-- Payment: customer FK
CREATE INDEX "payments_customerId_idx" ON "payments"("customerId");

-- SupplierPayment: supplier FK
CREATE INDEX "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");

-- StockLot: purchase invoice FK and org+product composite
CREATE INDEX "stock_lots_organizationId_productId_idx" ON "stock_lots"("organizationId", "productId");
CREATE INDEX "stock_lots_purchaseInvoiceId_idx" ON "stock_lots"("purchaseInvoiceId");

-- OpeningStock: product FK and warehouse FK
CREATE INDEX "opening_stocks_productId_idx" ON "opening_stocks"("productId");
CREATE INDEX "opening_stocks_warehouseId_idx" ON "opening_stocks"("warehouseId");

-- Expense: supplier FK and cash/bank account FK
CREATE INDEX "expenses_supplierId_idx" ON "expenses"("supplierId");
CREATE INDEX "expenses_cashBankAccountId_idx" ON "expenses"("cashBankAccountId");

-- ExpenseItem: account FK
CREATE INDEX "expense_items_accountId_idx" ON "expense_items"("accountId");

-- StockTransferItem: product FK
CREATE INDEX "stock_transfer_items_productId_idx" ON "stock_transfer_items"("productId");

-- UserWarehouseAccess: branch FK
CREATE INDEX "user_warehouse_access_branchId_idx" ON "user_warehouse_access"("branchId");

-- MobileDevice: product, customer, purchase invoice FKs
CREATE INDEX "mobile_devices_productId_idx" ON "mobile_devices"("productId");
CREATE INDEX "mobile_devices_customerId_idx" ON "mobile_devices"("customerId");
CREATE INDEX "mobile_devices_purchaseInvoiceId_idx" ON "mobile_devices"("purchaseInvoiceId");
