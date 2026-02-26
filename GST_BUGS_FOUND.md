# GST Testing - Bugs Found

**Test Date:** 2026-02-26
**Tester:** Claude (automated browser + API testing)
**Org State:** Kerala (gstStateCode: 32)

---

## FIXED DURING TESTING

### BUG-01: Customer API Missing GSTIN/gstStateCode (FIXED)
**Severity:** Critical
**Files Fixed:**
- `src/app/api/customers/route.ts` - POST handler
- `src/app/api/customers/[id]/route.ts` - PUT handler

**Description:** The `gstin` and `gstStateCode` fields were not being read from the request body or saved to the database when creating or updating customers. The fields exist in the Prisma schema and UI, but were silently dropped by the API.

**Impact:** All inter-state IGST calculations were broken because `computeDocumentGST` received `null` for customer `gstStateCode`, causing it to default to same-state (CGST+SGST) for all customers.

**Fix:** Added `gstin` and `gstStateCode` to destructuring and Prisma `create`/`update` data objects in both files.

---

### BUG-02: Supplier API Missing GSTIN/gstStateCode (FIXED)
**Severity:** Critical
**Files Fixed:**
- `src/app/api/suppliers/route.ts` - POST handler
- `src/app/api/suppliers/[id]/route.ts` - PUT handler

**Description:** Same issue as BUG-01 but for suppliers. The `gstin` and `gstStateCode` fields were not saved when creating or updating suppliers, breaking IGST calculations on purchase invoices.

**Fix:** Added `gstin` and `gstStateCode` to destructuring and Prisma `create`/`update` data objects in both files.

---

## OPEN BUGS

### BUG-03: No GST Rate Validation (No Range Check)
**Severity:** Medium
**Test Case:** TC-12.1
**Status:** Open

**Description:** The invoice/quotation/purchase invoice APIs accept any numeric GST rate including values greater than 100% or negative values. No server-side validation is performed.

**Steps to Reproduce:**
```js
fetch('/api/invoices', { method: 'POST', body: JSON.stringify({
  customerId: '...', issueDate: '...', dueDate: '...',
  items: [{ description: 'Test', quantity: 1, unitPrice: 1000, gstRate: 150 }]
}) })
// Returns 201 with CGST=750, SGST=750, Total=2500
```

**Expected:** API should return 400 error for `gstRate` outside valid Indian GST rates (0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28).

**Affected APIs:** `/api/invoices`, `/api/quotations`, `/api/purchase-invoices`, `/api/credit-notes`, `/api/debit-notes`

---

### BUG-04: No GSTIN Format Validation
**Severity:** Medium
**Test Case:** TC-12.3
**Status:** Open

**Description:** The customer and supplier APIs accept any string as GSTIN with no format validation. A valid Indian GSTIN must match the regex: `^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`

**Steps to Reproduce:**
```js
fetch('/api/customers', { method: 'POST', body: JSON.stringify({
  name: 'Test', gstin: 'INVALID123'
}) })
// Returns 201 with gstin: "INVALID123"
```

**Expected:** API should return 400 with format validation error.

**Affected APIs:** `/api/customers`, `/api/customers/[id]`, `/api/suppliers`, `/api/suppliers/[id]`

---

### BUG-05: UI - Unit Field Resets When GST Rate Changed
**Severity:** Low
**Test Case:** TC-2.4
**Status:** Open

**Description:** In the product edit form, when the user changes the GST Rate dropdown, the Unit field (a custom combobox component) resets to its empty/default state. This causes form submission to fail because the unit is now missing.

**Steps to Reproduce:**
1. Go to Products → Edit a product
2. Change the GST Rate dropdown value
3. Observe: Unit field resets to "Select a unit"

**Root Cause:** The GST Rate `<select>` change triggers a React state update that re-renders the Unit combobox component, losing its controlled value.

**Workaround:** Select the Unit field last (after setting GST rate), then immediately submit the form.

**File:** `src/components/units/unit-select.tsx` (combobox loses state on parent re-render)

---

### BUG-06: No Dedicated GST Summary Report
**Severity:** Low
**Test Case:** TC-14.1
**Status:** Open (Feature Gap)

**Description:** There is no dedicated GST summary/GSTR report endpoint. Users cannot get a consolidated view of total CGST, SGST, and IGST liability for a date range without manually aggregating from the invoice list.

**Note:** GST data IS available in the Trial Balance under accounts:
- 1350 CGST Input, 1360 SGST Input, 1370 IGST Input
- 2210 CGST Output, 2220 SGST Output, 2230 IGST Output

**Suggestion:** Add `/api/reports/gst-summary?from=YYYY-MM-DD&to=YYYY-MM-DD` endpoint returning CGST/SGST/IGST totals for sales and purchases.

---

## TEST RESULTS SUMMARY

| Category | Tests | Pass | Fail | Notes |
|----------|-------|------|------|-------|
| 2. Product GST Config | 4 | 3 | 1 | TC-2.4: UI bug (unit field resets) |
| 3. Customer GST Config | 3 | 1 | 2 | TC-3.1, 3.2: GSTIN not saved (FIXED) |
| 4. Invoice GST Same-State | 2 | 2 | 0 | |
| 5. Invoice GST Inter-State | 1 | 0 | 1 | Root cause: BUG-01 (now FIXED) |
| 6. Edge Cases | 4 | 4 | 0 | |
| 7. Quotation GST | 3 | 3 | 0 | |
| 8. Purchase Invoice GST | 3 | 3 | 0 | |
| 9. Credit Notes GST | 3 | 3 | 0 | |
| 10. Debit Notes GST | 2 | 2 | 0 | |
| 11. PDF Export | 3 | 3 | 0 | |
| 12. Data Validation | 4 | 2 | 2 | TC-12.1 (>100% GST), TC-12.3 (GSTIN format) |
| 13. Invoice Amendment | 2 | 2 | 0 | |
| 14. Reporting | 2 | 1 | 1 | TC-14.1: No dedicated GST report |
| 15. Multi-Org Isolation | 2 | 2 | 0 | |
| 16. API Structure | 3 | 3 | 0 | |

**Total: 41 tests | 34 Pass | 7 Fail (3 bugs fixed during testing)**

---

## KEY FINDINGS

1. **Core GST calculation logic is correct** — CGST+SGST vs IGST splitting works perfectly once customer/supplier state codes are properly saved.

2. **Root cause of inter-state failures was BUG-01/BUG-02** — fixed during testing. All affected tests re-ran and passed.

3. **Input validation gaps** — GST rate range and GSTIN format not validated server-side (BUG-03, BUG-04).

4. **Trial balance correctly tracks GST** — All 6 GST ledger accounts (Input/Output × CGST/SGST/IGST) are maintained via journal entries.

5. **Multi-tenant isolation is solid** — All documents are properly scoped to `organizationId`.
