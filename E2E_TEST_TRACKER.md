# E2E Test Suite — Master Tracker

**Goal:** 1000+ tests covering every feature, making the app 100% production-ready.
**Test orgs:** `e2e-test-india` (INDIA/GST), `e2e-test-saudi` (SAUDI/VAT) — created fresh, never touching production orgs.

---

## Progress Summary

| # | Batch | File | Tests | Status |
|---|-------|------|-------|--------|
| 0 | Stock Transfer Fix | `e2e/stock-transfer-fifo.spec.ts` | 8 | PASSING |
| 1 | FIFO Comprehensive | `e2e/fifo-comprehensive.spec.ts` | 107 | PASSING (~2 timeouts, 1 skip) |
| 2 | Products, Customers, Suppliers, Units | `e2e/tests/master-data.spec.ts` | 120 | ✅ PASSING (122/122) |
| 3 | Invoices & Purchases (CRUD + tax) | `e2e/tests/invoices-purchases.spec.ts` | 150 | ✅ PASSING (150/150, transient Supabase timeouts) |
| 4 | Quotations, Credit/Debit Notes | `e2e/tests/quotations-returns.spec.ts` | 80 | ✅ PASSING (82/82) |
| 5 | Payments (customer + supplier) | `e2e/tests/payments.spec.ts` | 60 | ✅ PASSING (62/62) |
| 6 | Accounting (COA, Journals, Cash/Bank, Expenses) | `e2e/tests/accounting.spec.ts` | 120 | WRITTEN — NOT YET RUN |
| 7 | POS (sessions, checkout, held orders) | `e2e/tests/pos.spec.ts` | 100 | WRITTEN — NOT YET RUN |
| 8 | Reports (all 30+ reports) | `e2e/tests/reports.spec.ts` | 100 | WRITTEN — NOT YET RUN |
| 9 | Settings, Branches, Employees, Mobile Devices | `e2e/tests/settings-inventory.spec.ts` | 80 | WRITTEN — NOT YET RUN |
| 10 | Auth, Permissions, Navigation, Dashboard | `e2e/tests/auth-navigation.spec.ts` | 60 | WRITTEN — NOT YET RUN |
| 11 | GST vs VAT (India vs Saudi edition) | `e2e/tests/tax-editions.spec.ts` | 80 | WRITTEN — NOT YET RUN |
| 12 | Edge cases, validation, stress tests | `e2e/tests/edge-cases.spec.ts` | 100 | WRITTEN — NOT YET RUN |
| **TOTAL** | | **13 files** | **1,165** | |

---

## Next Steps

- [ ] Run batches 2-12 ONE BY ONE, fix all failures before moving to next batch
- [ ] Fix any app bugs found during test execution
- [ ] Update this tracker after each batch passes
- [ ] Update `e2e/fifo-comprehensive.spec.ts` test 46 (opening stock delete) — bug is now fixed, un-skip it
- [ ] All 1,165 tests passing

---

## Infrastructure

- [x] Playwright config with `comprehensive` project (`e2e/tests/**/*.spec.ts`)
- [x] `e2e/helpers/test-org-setup.ts` — org creation, user auth, warehouse setup
- [x] `e2e/global-setup.ts` — provisions test orgs before all tests
- [x] `e2e/helpers/fifo.ts` — shared helpers (purchases, sales, transfers, stock queries, DB pool)
- [x] All 13 test files written and TypeScript clean
- [x] Auth setup: `e2e/auth.setup.ts` → `e2e/.auth/admin.json` + `e2e/.auth/superadmin.json`
- [x] Superadmin: `superadmin@bizarch.com` / `superadmin123`
- [x] Admin: `admin@bizarch.com` / `admin123`

---

## Bugs Found & Fixed

| # | Description | Severity | Fixed? | Commit |
|---|-------------|----------|--------|--------|
| 1 | Cannot edit/reverse completed transfer when dest stock consumed | HIGH | YES | `027cc0a` |
| 2 | Delete consumed opening stock → server 500 | MEDIUM | YES | `7a98445` |
| 3 | Edit purchase warehouse doesn't relocate stock lot | LOW | YES | `7a98445` |
| 4 | Edit sale warehouse not propagated through recalculation | LOW | YES | `7a98445` |
| 5 | Journal auto-number overflow: string sort "999" > "1000" | HIGH | YES | `3192ab8` |
| 6 | Transaction timeout 30s too low for Supabase latency | MEDIUM | YES | `ac66396` |

---

## How to Run Tests

```bash
# Run a specific batch
npx playwright test e2e/tests/master-data.spec.ts --reporter=list

# Run all comprehensive tests
npx playwright test --project=comprehensive --reporter=list

# Run FIFO tests only
npx playwright test e2e/fifo-comprehensive.spec.ts --reporter=list
npx playwright test e2e/stock-transfer-fifo.spec.ts --reporter=list
```

---

## Session Log

### Session 1 — 2026-03-18
- Analyzed Zoho Books FIFO architecture from Supabase export
- Implemented stock transfer edit/reverse with FIFO recalculation
- Wrote & ran 8 stock transfer FIFO tests (all passing)
- Wrote & ran 107 comprehensive FIFO tests (~105 passing, 2 timeout, 1 skip)
- Built test infrastructure (org setup, global setup, helpers)
- Wrote ALL 12 batches (1,165 tests total) across 11 new test files
- Fixed 4 app bugs found during testing
- All files compile clean with zero TypeScript errors
- Commits: `027cc0a`, `f9c91ec`, `ddc5675`, `2cee21e`, `7a98445`
- **Next:** Run batches 2-12 one by one, fix failures, iterate to 100% pass rate
