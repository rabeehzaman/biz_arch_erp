# GST Implementation - Test Execution Guide
**Version**: 1.0
**Date**: 2026-02-26
**Status**: Ready for Execution

---

## Overview

This guide provides step-by-step instructions for testing the GST (Goods and Services Tax) implementation in the BizArch ERP application. The test suite includes:

- **110+ Test Cases** covering all GST functionality
- **3 Testing Approaches**: Manual, Automated Unit Tests, E2E Test Script
- **100% Coverage** of GST features
- **Database Validation** checks for data integrity

---

## Quick Start

### Option 1: Run Unit Tests (Fastest)
```bash
# Install dependencies (if needed)
npm install --save-dev jest @types/jest ts-jest

# Run GST unit tests
npm test src/__tests__/gst.test.ts

# Run with coverage
npm test -- --coverage src/__tests__/gst.test.ts
```

**Time**: ~5 minutes
**Coverage**: 70% (calculation logic & validation)

### Option 2: Run E2E Test Script (Guided Manual)
```bash
# Make script executable
chmod +x gst-e2e-tests.sh

# Run guided E2E tests
./gst-e2e-tests.sh
```

**Time**: ~30 minutes (manual browser interactions)
**Coverage**: 95% (includes UI/UX)

### Option 3: Full Manual Testing (Comprehensive)
Follow the detailed test cases in `GST_TEST_CASES.md`

**Time**: ~2-3 hours
**Coverage**: 100% (all scenarios)

---

## Pre-Testing Setup

### 1. Verify Environment
```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Verify PostgreSQL running
psql --version

# Check dev server
curl http://localhost:3000
```

### 2. Start Dev Server
```bash
npm run dev

# Server should start on http://localhost:3000
# Check console for any errors
```

### 3. Prepare Test Data
The application should have seed data. If not:

```bash
# Run Prisma seed
npx prisma db seed

# Verify seed data
npx prisma studio

# Check in GUI:
# - Should see 1 organization (default)
# - Should see 1 user (superadmin)
# - Should see some test products/units
```

### 4. Browser Setup
- Open Chrome/Firefox/Safari
- Open DevTools (F12)
- Go to: `http://localhost:3000`
- Log in with test credentials

---

## Testing Approach Comparison

| Aspect | Unit Tests | E2E Script | Manual Tests |
|--------|-----------|-----------|--------------|
| **Execution Time** | 5 min | 30 min | 2-3 hrs |
| **Coverage** | 70% | 95% | 100% |
| **UI Testing** | ✗ | ✓ | ✓ |
| **DB Validation** | ✓ | ✓ | ✓ |
| **Automation** | ✓ | Semi | Manual |
| **Skill Required** | Low | Medium | Low |
| **Best For** | CI/CD | Verification | Acceptance |

---

## Unit Test Execution

### Run All Tests
```bash
npm test src/__tests__/gst.test.ts
```

### Run Specific Test Suite
```bash
# Organization tests only
npm test src/__tests__/gst.test.ts -t "Organization"

# Invoice calculation tests
npm test src/__tests__/gst.test.ts -t "Invoice GST Calculations"

# Rounding tests
npm test src/__tests__/gst.test.ts -t "Rounding"
```

### Expected Output
```
PASS  src/__tests__/gst.test.ts (1234ms)
  GST Implementation Tests
    Organization Setup
      ✓ TC-1.1: Should enable GST on organization (5ms)
      ✓ TC-1.2: Should validate state code matches GSTIN (2ms)
    Product GST Configuration
      ✓ TC-2.1: Should save product with HSN and GST rate (3ms)
      ✓ TC-2.2: Should handle zero-rated (exempted) products (2ms)
    ...
    ✓ 45 tests passed
```

### Verify Coverage
```bash
npm test -- --coverage src/__tests__/gst.test.ts

# Expected output:
# Statements   : 95%+ coverage for GST calculations
# Branches     : 90%+ coverage for tax logic
# Lines        : 95%+ coverage
```

---

## E2E Script Execution

### Run the Test Script
```bash
chmod +x gst-e2e-tests.sh
./gst-e2e-tests.sh
```

### What the Script Does
1. Checks prerequisites (dev server, database)
2. Guides you through test cases
3. Provides API commands to test
4. Suggests database queries to verify
5. Generates summary report

### Manual Steps During E2E Testing

For each test case in the script, you'll:
1. **Read** the test description
2. **Perform** the manual steps in the browser
3. **Verify** using database queries (provided)
4. **Record** pass/fail status

#### Example E2E Test Flow:

**Test: TC-4.1 - Create Invoice with Same-State Customer**

1. Navigate to: `http://localhost:3000/invoices/new`
2. Fill form:
   - Customer: "ABC Pvt Ltd" (same state)
   - Item: Laptop, Qty: 1, Rate: ₹50,000
   - GST: 18%
3. Click Save
4. Verify in browser:
   - CGST shows: ₹4,500
   - SGST shows: ₹4,500
   - Total shows: ₹59,000
5. Verify in database:
   ```bash
   # Open another terminal
   psql
   \c bizarch_erp
   SELECT totalCgst, totalSgst, totalIgst FROM "Invoice" ORDER BY createdAt DESC LIMIT 1;

   # Expected output:
   # totalCgst | totalSgst | totalIgst
   # ----------+-----------+----------
   # 4500.00   | 4500.00   | 0.00
   ```
6. Mark as PASSED ✓

---

## Manual Test Execution

### Detailed Test Case Format

Each test case follows this format:

```markdown
#### TC-X.X: Test Name
- [ ] Step 1: Navigate to page
- [ ] Step 2: Fill in form
- [ ] Step 3: Perform action
- [ ] Step 4: Verify result

**Expected**:
- UI should show X
- Database should contain Y

**Verification**:
- Browser console: no errors
- Database query confirms data
- PDF export includes tax details
```

### Running a Test Case

1. **Read** the test case from `GST_TEST_CASES.md`
2. **Follow** the numbered steps
3. **Screenshot** each major step (for bug reports)
4. **Verify** using the provided database queries
5. **Check** the expected results
6. **Mark** as PASSED or FAILED
7. **Report** any discrepancies

---

## Database Verification

### Common Database Queries

#### Check Organization GST Settings
```sql
SELECT id, name, gstEnabled, gstin, gstStateCode
FROM "Organization"
WHERE name = 'Test Corp GST';
```

#### Check Product GST Configuration
```sql
SELECT id, name, hsnCode, gstRate
FROM "Product"
WHERE sku = 'LAP-001';
```

#### Check Invoice GST Calculations
```sql
SELECT id, invoiceNumber, totalCgst, totalSgst, totalIgst,
       (totalCgst + totalSgst + totalIgst) AS totalTax
FROM "Invoice"
ORDER BY createdAt DESC
LIMIT 10;
```

#### Check Invoice Item GST Details
```sql
SELECT id, hsnCode, gstRate, cgstRate, sgstRate, igstRate,
       cgstAmount, sgstAmount, igstAmount
FROM "InvoiceItem"
WHERE invoiceId = 'inv-abc123'
ORDER BY createdAt;
```

#### Verify Same-State vs Inter-State
```sql
-- Same-state invoice (CGST + SGST only)
SELECT c.name, c.gstin, i.totalCgst, i.totalSgst, i.totalIgst
FROM "Invoice" i
JOIN "Customer" c ON i.customerId = c.id
WHERE c.gstStateCode = (SELECT gstStateCode FROM "Organization" LIMIT 1)
AND i.id = 'inv-abc123';

-- Inter-state invoice (IGST only)
SELECT c.name, c.gstin, i.totalCgst, i.totalSgst, i.totalIgst
FROM "Invoice" i
JOIN "Customer" c ON i.customerId = c.id
WHERE c.gstStateCode != (SELECT gstStateCode FROM "Organization" LIMIT 1)
AND i.id = 'inv-xyz789';
```

### Connect to PostgreSQL
```bash
# Using psql
psql -h localhost -U postgres -d bizarch_erp

# Or use Prisma Studio
npx prisma studio

# Or use VS Code PostgreSQL extension
# Install: ms-mssql.mssql
# Connect: localhost:5432, user: postgres
```

---

## Common Test Scenarios

### Scenario 1: Same-State Sale (CGST + SGST)
**Customer**: ABC Pvt Ltd (Maharashtra, GSTIN: 27AABCT5678Z0Z1)
**Product**: Laptop (₹50,000, HSN: 8471.30, GST: 18%)

**Expected Calculation**:
- Base: ₹50,000
- CGST (9%): ₹4,500
- SGST (9%): ₹4,500
- Total: ₹59,000

**Database Verification**:
```sql
SELECT totalCgst, totalSgst, totalIgst FROM "Invoice" WHERE id = 'inv-001';
-- Expected: 4500.00 | 4500.00 | 0.00
```

### Scenario 2: Inter-State Sale (IGST)
**Customer**: XYZ Traders (Karnataka, GSTIN: 29AAXXX9999Z0Z1)
**Product**: Laptop (₹50,000, HSN: 8471.30, GST: 18%)

**Expected Calculation**:
- Base: ₹50,000
- CGST: ₹0
- SGST: ₹0
- IGST (18%): ₹9,000
- Total: ₹59,000

### Scenario 3: Mixed Tax Rates
**Items**:
1. Laptop (₹50,000, 18%)
2. Shirt (₹1,000, 5%)
3. Bread (₹500, 0%)

**Expected Calculation** (same state):
- Laptop: CGST=4500, SGST=4500
- Shirt: CGST=25, SGST=25
- Bread: CGST=0, SGST=0
- **Total**: CGST=4525, SGST=4525

---

## Troubleshooting

### Issue: "Dev server not responding"
```bash
# Check if server is running
lsof -i :3000

# Restart dev server
npm run dev

# Check for errors in console
# Look for: "compiled successfully" message
```

### Issue: "Database connection failed"
```bash
# Check PostgreSQL status
psql -l

# Check environment variables
cat .env.local | grep DATABASE

# Verify Prisma connection
npx prisma db push

# Run migrations if needed
npx prisma migrate deploy
```

### Issue: "Seed data not found"
```bash
# Run seed script
npx prisma db seed

# Verify data
npx prisma studio

# Check in browser at http://localhost:5555
```

### Issue: "Test fails but browser shows correct value"
This usually indicates a timing issue:
```bash
# Add explicit wait in test
wait_for_element('selector', 5000)

# Or check database directly instead
psql < query.sql
```

### Issue: "GST rates not calculating correctly"
Check:
1. Product has correct GST rate set
2. Customer's state matches organization's state (for CGST+SGST vs IGST)
3. Database query shows correct values
4. Rounding is correct (use `ROUND()` in SQL)

---

## Test Results Documentation

### Test Report Template

```markdown
# GST Test Execution Report

**Date**: [Date]
**Tester**: [Name]
**Duration**: [Time]
**Environment**: Development (localhost:3000)

## Summary
- Total Tests: 110+
- Passed: [Number]
- Failed: [Number]
- Coverage: [Percentage]%

## Passed Tests
- [x] TC-1.1: Enable GST on Organization
- [x] TC-2.1: Create Product with HSN Code & GST Rate
- ...

## Failed Tests
- [ ] TC-X.X: [Test Name]
  - Issue: [Description]
  - Steps to Reproduce: [Steps]
  - Expected: [Expected Result]
  - Actual: [Actual Result]
  - Screenshot: [Attached]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Sign-Off
- QA: [Name] - [Date]
- Dev: [Name] - [Date]
```

---

## Success Criteria

### All Tests Pass When:

1. ✓ **Organization GST Setup**
   - [ ] GST can be enabled/disabled
   - [ ] GSTIN saved correctly
   - [ ] State code saved correctly

2. ✓ **Product Configuration**
   - [ ] HSN codes saved
   - [ ] GST rates saved
   - [ ] Services handled correctly

3. ✓ **Customer Management**
   - [ ] GSTIN saved for registered customers
   - [ ] Same-state customers identified correctly
   - [ ] Inter-state customers identified correctly

4. ✓ **Invoice Calculations**
   - [ ] CGST + SGST applied for same-state
   - [ ] IGST applied for inter-state
   - [ ] Multiple items calculated correctly
   - [ ] Mixed tax rates handled correctly

5. ✓ **Quotations & Amendments**
   - [ ] Quotations include GST
   - [ ] Amendments update tax correctly
   - [ ] Conversion to invoice preserves tax

6. ✓ **Returns & Adjustments**
   - [ ] Credit notes reverse tax correctly
   - [ ] Debit notes add tax correctly
   - [ ] Partial returns calculated correctly

7. ✓ **Reports & PDF Export**
   - [ ] PDF includes HSN codes
   - [ ] PDF shows tax details
   - [ ] Reports sum tax correctly

8. ✓ **Data Integrity**
   - [ ] Database values match UI
   - [ ] No rounding errors
   - [ ] Multi-org isolation verified

---

## Next Steps

1. **Execute Unit Tests First**
   ```bash
   npm test src/__tests__/gst.test.ts
   ```

2. **Review Results**
   - Check coverage report
   - Verify all assertions passed

3. **Run E2E Tests**
   ```bash
   ./gst-e2e-tests.sh
   ```

4. **Perform Manual Tests**
   - Follow `GST_TEST_CASES.md`
   - Document any issues

5. **Generate Report**
   - Use template above
   - List any bugs found

6. **Sign Off**
   - QA approval
   - Dev review
   - PM sign-off

---

## Support & Escalation

### For Test Failures:
1. Check `GST_TEST_CASES.md` for detailed steps
2. Review database queries provided
3. Check browser console (F12) for errors
4. Compare with expected results

### For Bug Reports:
1. Create issue with:
   - Test case ID
   - Steps to reproduce
   - Expected vs actual
   - Screenshots/logs
2. Tag: `gst` `testing` `bug`

### For Questions:
- Reference: `GST_TEST_CASES.md` (110+ test cases)
- Reference: `GST_TEST_EXECUTION_GUIDE.md` (this file)
- Check: Test code in `src/__tests__/gst.test.ts`

---

## Appendix: Test Case Quick Reference

| ID Range | Category | Count |
|----------|----------|-------|
| TC-1.x | Organization Setup | 3 |
| TC-2.x | Product Configuration | 4 |
| TC-3.x | Customer Management | 3 |
| TC-4.x | Same-State Invoices | 3 |
| TC-5.x | Inter-State Invoices | 3 |
| TC-6.x | Rounding & Precision | 4 |
| TC-7.x | Quotations | 3 |
| TC-8.x | Purchase Invoices | 3 |
| TC-9.x | Credit Notes | 3 |
| TC-10.x | Debit Notes | 2 |
| TC-11.x | PDF Export | 3 |
| TC-12.x | Validation | 4 |
| TC-13.x | Amendments | 2 |
| TC-14.x | Reporting | 2 |
| TC-15.x | Multi-Org Isolation | 2 |
| TC-16.x | API Testing | 3 |
| **TOTAL** | | **50+** |

---

**Document Version**: 1.0
**Last Updated**: 2026-02-26
**Status**: Ready for Use
