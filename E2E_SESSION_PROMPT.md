# Prompt: Run & Fix 1,165 E2E Tests

Copy-paste this into a new Claude Code session:

---

## Task

I have 1,165 Playwright E2E tests written across 13 files for my BizArch ERP app. They are all written and compile clean, but batches 2-12 (1,050 tests) have NOT been run yet. I need you to:

1. Read `E2E_TEST_TRACKER.md` for the full context and progress
2. Run each batch ONE BY ONE starting from batch 2 (`e2e/tests/master-data.spec.ts`)
3. For each batch: run → analyze failures → fix test assertions OR fix app bugs → re-run until passing
4. After each batch passes, update `E2E_TEST_TRACKER.md` with the results
5. Move to next batch and repeat
6. If you find real app bugs (not test bugs), fix the app code and note in the tracker
7. Un-skip test 46 in `e2e/fifo-comprehensive.spec.ts` (the opening stock delete bug was fixed in commit `7a98445`)
8. When all batches pass, commit and push everything

## Key Rules

- **NEVER touch existing production organizations** (qimma-adawi, danbros, i-wave-manjeri)
- **NEVER modify invoice PDF templates or POS receipt components** (user feedback rule)
- Dev server runs on `http://localhost:3000`
- Auth: admin@bizarch.com / admin123, superadmin@bizarch.com / superadmin123
- Database: PostgreSQL, connection via `DATABASE_URL` env var
- Run tests with: `npx playwright test <file> --reporter=list`
- Fix failures by adjusting test assertions to match actual API behavior, OR fix app bugs if the behavior is wrong
- When fixing tests, use the Edit tool for surgical changes — do NOT rewrite entire files
- Commit after each batch with descriptive message

## Batch Order

```
Batch 2:  npx playwright test e2e/tests/master-data.spec.ts --reporter=list
Batch 3:  npx playwright test e2e/tests/invoices-purchases.spec.ts --reporter=list
Batch 4:  npx playwright test e2e/tests/quotations-returns.spec.ts --reporter=list
Batch 5:  npx playwright test e2e/tests/payments.spec.ts --reporter=list
Batch 6:  npx playwright test e2e/tests/accounting.spec.ts --reporter=list
Batch 7:  npx playwright test e2e/tests/pos.spec.ts --reporter=list
Batch 8:  npx playwright test e2e/tests/reports.spec.ts --reporter=list
Batch 9:  npx playwright test e2e/tests/settings-inventory.spec.ts --reporter=list
Batch 10: npx playwright test e2e/tests/auth-navigation.spec.ts --reporter=list
Batch 11: npx playwright test e2e/tests/tax-editions.spec.ts --reporter=list
Batch 12: npx playwright test e2e/tests/edge-cases.spec.ts --reporter=list
```

## Context Files

- `E2E_TEST_TRACKER.md` — master progress tracker
- `e2e/helpers/fifo.ts` — shared test helpers (API calls, DB queries)
- `e2e/helpers/test-org-setup.ts` — test org provisioning
- `playwright.config.ts` — test configuration
- `e2e/auth.setup.ts` — auth setup (admin + superadmin)

Start with batch 2. Go.
