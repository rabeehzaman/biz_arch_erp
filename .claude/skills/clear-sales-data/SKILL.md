---
name: clear-sales-data
description: Clear all sales transaction data for a specific organization while preserving purchases and master data
disable-model-invocation: true
argument-hint: <org-slug>
allowed-tools: Bash(npx tsx scripts/clear-sales-data.ts *), Read, Edit
---

# Clear Sales Data

Clear all sales-side transaction data for organization slug: `$ARGUMENTS`

## What this does

Runs `scripts/clear-sales-data.ts` which deletes the following for the given org:

- **Invoices** (MANUAL + POS) + InvoiceItems + StockLotConsumptions + CostAuditLogs
- **Credit Notes** + CreditNoteItems + StockLots (sourceType = CREDIT_NOTE)
- **Payments** (customer) + PaymentAllocations
- **CustomerTransactions** (ledger entries)
- **POS Sessions** + POSHeldOrders
- **Quotations** + QuotationItems
- **MobileDevices** — resets `salesInvoiceId = null`, `status = IN_STOCK`
- **StockLots** — resets `remainingQuantity = initialQuantity`

## What is preserved

- PurchaseInvoices, PurchaseInvoiceItems, StockLots (PURCHASE/OPENING_STOCK/ADJUSTMENT/STOCK_TRANSFER)
- SupplierPayments, SupplierTransactions, DebitNotes
- POSRegisterConfigs (register account settings — must NOT be deleted)
- Customers, Suppliers, Products, Units, Branches, Warehouses, Settings
- All org config and master data

## Steps

1. First, update the `ORG_SLUG` constant in `scripts/clear-sales-data.ts` to match `$ARGUMENTS`
2. Confirm with the user before running — this is a destructive operation
3. Run the script:
   ```bash
   npx tsx scripts/clear-sales-data.ts
   ```
4. Review the output counts to verify success
