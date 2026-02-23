# Journal Entry Sync — Test Documentation

**Date:** 2026-02-24  
**Branch:** main  
**Commit:** 6356f2f  
**Test environment:** localhost:3000 (Next.js dev)

---

## Bugs Fixed (8 total)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | `recalculateFromDate()` updated item COGS but never synced GL journals | `src/lib/inventory/fifo.ts` | Collect affected invoiceIds in loop; call `syncInvoiceCOGSJournal()` after loop |
| 2 | Invoice PUT deleted all journals but never recreated them | `src/app/api/invoices/[id]/route.ts` | Call `syncInvoiceRevenueJournal()` + `syncInvoiceCOGSJournal()` after recalculation |
| 3 | Invoice DELETE left orphaned journal entries | `src/app/api/invoices/[id]/route.ts` | `journalEntry.deleteMany({ sourceType:"INVOICE", sourceId:id })` before delete |
| 4 | Invoice POST skipped COGS journal when `totalCOGS=0` (never recreated later) | `src/app/api/invoices/route.ts` | Replace inline code with `syncInvoiceCOGSJournal()` — helper handles $0 case |
| 5 | Purchase Invoice PUT deleted purchase journal but never recreated it | `src/app/api/purchase-invoices/[id]/route.ts` | Call `syncPurchaseJournal()` after recreating stock lots |
| 6 | Purchase Invoice DELETE left orphaned journal entries | `src/app/api/purchase-invoices/[id]/route.ts` | `journalEntry.deleteMany({ sourceType:"PURCHASE_INVOICE", sourceId:id })` before delete |
| 7 | Credit Note PUT deleted journals but never recreated them | `src/app/api/credit-notes/[id]/route.ts` | Added journal recreation after FIFO recalculation block |
| 8 | Debit Note PUT deleted journals but never recreated them | `src/app/api/debit-notes/[id]/route.ts` | Added journal recreation after FIFO recalculation block |

### Bonus Fixes

| Fix | File |
|-----|------|
| `StockLotConsumption` FK constraint prevents lot deletion (no cascade in schema) | Purchase Invoice PUT + DELETE: delete consumptions before deleting lots |
| Transaction timeout (Prisma default 5s too short for complex FIFO chains) | Added `{ timeout: 30000 }` to all 17 `prisma.$transaction()` calls across 9 route files |
| Quotation→Invoice conversion never created revenue or COGS journal entries | `src/app/api/quotations/[id]/convert/route.ts`: added `syncInvoiceRevenueJournal()` + `syncInvoiceCOGSJournal()` |
| POS checkout transaction missing `{ timeout: 30000 }` | `src/app/api/pos/checkout/route.ts` |

---

## New Helpers Added (`src/lib/accounting/journal.ts`)

### `syncInvoiceCOGSJournal(tx, organizationId, invoiceId)`
- Fetches invoice items, sums `costOfGoodsSold`
- Deletes existing COGS journals (`sourceType=INVOICE`, description starts with `"COGS"`)
- If `totalCOGS > 0`: creates DR 5100 / CR 1400 journal
- If `totalCOGS = 0`: no journal created (correct)

### `syncInvoiceRevenueJournal(tx, organizationId, invoiceId)`
- Fetches invoice totals
- Deletes existing revenue journals (description starts with `"Sales Invoice"`)
- Creates DR 1300 (AR) / CR 4100 (Revenue) [/ CR 2200 (Tax) if taxAmount > 0]

### `syncPurchaseJournal(tx, organizationId, purchaseInvoiceId)`
- Fetches purchase invoice totals
- Deletes all existing journals for that purchase invoice
- Creates DR 1400 (Inventory) [/ DR 2200 (Input Tax) if taxAmount > 0] / CR 2100 (AP)

---

## Test Results — 29 Test Cases

| TC | Scenario | Expected | Result |
|----|----------|----------|--------|
| TC-01 | Invoice created, no stock, no fallback cost | COGS=$0, no COGS journal, revenue journal created | ✅ PASS |
| TC-02 | Purchase added @$40 after sale → zero-COGS fix triggers | COGS journal auto-created: DR 5100 $400, CR 1400 $400 | ✅ PASS |
| TC-03 | Purchase price edited $40→$45 | COGS journal: $450; purchase journal: $900 | ✅ PASS |
| TC-04 | Invoice qty edited 10→5 | Revenue: DR 1300 $500; COGS: DR 5100 $225 | ✅ PASS |
| TC-05 | Invoice deleted | Zero orphaned journals | ✅ PASS |
| TC-06 | Complex cascade: 3 PIs (10@$10/10@$15/10@$20), sell 25, edit PI-2 $15→$12, delete PI-2 | COGS: $350→$320→$360 cascade correct at each step | ✅ PASS |
| TC-07 | Opening stock (15@$30) → sell 8 units | COGS=$240 (8×$30); journal DR 5100 $240 | ✅ PASS |
| TC-08 | Customer payment $500 via BANK_TRANSFER | DR 1200 $500, CR 1300 $500 | ✅ PASS |
| TC-09 | Supplier payment $100 via BANK_TRANSFER | DR 2100 $100, CR 1200 $100 | ✅ PASS |
| TC-10 | Expense $1500 → approve → pay (bank) | DR 5200 $1500, CR 1200 $1500 | ✅ PASS |
| TC-11 | Expense void after payment | Original journal status=VOID; reversal journal POSTED | ✅ PASS |
| TC-12 | Credit note: return 3 of 8 sold units @$200 (cost $30) | DR 4100 $600 / CR 1300 $600 + DR 1400 $90 / CR 5100 $90 | ✅ PASS |
| TC-13 | Credit note edited: 3→5 units | Revenue journal: $1000; COGS reversal: $150 (recreated) | ✅ PASS |
| TC-14 | Credit note deleted | Zero orphaned journals | ✅ PASS |
| TC-15 | Debit note: return 4 of 20 purchased units @$25 | DR 2100 $100, CR 1400 $100 | ✅ PASS |
| TC-16 | Debit note edited: 4→7 units | DR 2100 $175, CR 1400 $175 (journal recreated) | ✅ PASS |
| TC-17 | Debit note deleted | Zero orphaned journals | ✅ PASS |
| TC-18 | Backdated purchase (yesterday) after today's sale with COGS=$0 | COGS journal auto-synced: DR 5100 $175 (5×$35) | ✅ PASS |
| TC-19 | Multi-product invoice + 18% tax (2×TC07@$200 + 3×TC18@$300) | AR=$1534; Revenue=$1300; Tax=$234; COGS=$165 | ✅ PASS |
| TC-20 | Bank deposit $5000 | DR 1200 $5000, CR 3100 $5000 | ✅ PASS |
| TC-21 | Cash→Bank transfer $800 | DR 1200 $800, CR 1100 $800 | ✅ PASS |
| TC-22 | Invoice with 10% line discount (10×$500 @10% off) | AR=$4500, Revenue=$4500, COGS=$250 | ✅ PASS |
| TC-23 | Debit note on unsold stock; sold items COGS must not change | DN journals correct; TC22 COGS unchanged at $250 | ✅ PASS |
| TC-24 | Mid-test trial balance check | 27 journals, totalDR=totalCR, diff=$0.00 | ✅ PASS |
| TC-25 | Customer + supplier opening balances | Balances recorded; no journal (correct: migration entries) | ✅ PASS |
| TC-26 | Purchase invoice with 18% GST | DR 1400 $1000, DR 2200 $180, CR 2100 $1180 | ✅ PASS |
| TC-27 | Oversell 15 units (only 10 in stock) — fallback cost | COGS=10×$100+5×$100=$1500; warning message returned | ✅ PASS |
| TC-28 | Delete purchase (lot A: 5@$20) after sale consumed it | COGS cascade: $190→$240 (8 units now all from lot B @$30) | ✅ PASS |
| TC-29 | Final trial balance | 33 journals, DR=CR=$104,419.00, diff=$0.00, 0 imbalanced entries | ✅ PASS |

**All 29 tests passed. 0 failures.**

---

## Account Codes Reference

| Code | Account | Role in Journals |
|------|---------|-----------------|
| 1100 | Cash | DR on cash receipt/deposit |
| 1200 | Bank Accounts | DR on bank receipt/deposit |
| 1300 | Accounts Receivable | DR on sale invoice; CR on payment/CN |
| 1400 | Inventory | DR on purchase; CR on COGS/debit note |
| 2100 | Accounts Payable | CR on purchase; DR on payment/debit note |
| 2200 | Taxes Payable | CR on sale tax; DR on input tax (purchase) |
| 3100 | Owner's Capital | CR on deposit/opening |
| 4100 | Sales Revenue | CR on sale; DR on credit note |
| 5100 | Cost of Goods Sold | DR on sale COGS; CR on credit note COGS reversal |
| 5200 | Operating Expenses | DR on expense payment |

---

## Additional Test Cases (Post-Review, Round 2)

These test cases were identified after code review of untested code paths.

| TC | Scenario | Expected | Notes |
|----|----------|----------|-------|
| TC-30 | Quotation converted to invoice (product with stock) | Revenue journal + COGS journal created | Bug fix applied: conversion previously created zero journals |
| TC-31 | Service-only invoice (no productId on items) | Revenue journal created; no COGS journal (totalCOGS=0) | `syncInvoiceCOGSJournal` correctly skips when sum=0 |
| TC-32 | POS checkout with CASH payment | Revenue + COGS + payment journals created; DR Cash / CR AR | Timeout fix applied |
| TC-33 | Edit purchase invoice (date only, price unchanged) | Purchase journal recreated at new date; COGS journals unaffected if no price change | `syncPurchaseJournal` always recreates; FIFO only triggers if backdated |
| TC-34 | Purchase invoice with multiple lines, different products | Single purchase journal (sum of all lines); separate COGS journals per affected sale invoice | `syncPurchaseJournal` sums all lines into one entry |
| TC-35 | Delete expense that is still in DRAFT (never paid) | No journal to clean up; expense deleted cleanly | Expense journals only created on `pay` |
| TC-36 | Partial payment then credit note reduces AR to zero | AR balance = 0; no double-counting | Revenue journal CR=total, payment CR=paid amount, CN DR=return amount |

> **Note**: TC-30 through TC-36 represent code paths verified by source-code review. Browser automation tests for these scenarios require the browser extension to be connected.

---

## Zoho Books–Style Behaviour Confirmed

- Any edit to a purchase invoice **automatically recalculates** COGS for all downstream sales and **syncs all affected GL journals** — no manual intervention needed.
- Any edit to a sales invoice **deletes and recreates** both the revenue journal and COGS journal with current values.
- Deleting any document (invoice, purchase, credit note, debit note) **removes all associated journal entries** immediately with no orphans.
- COGS journals are **never created when totalCOGS=0** — they are created/updated retroactively when a purchase is later added or edited.
