# GST Implementation - Comprehensive Test Case Suite
**Created**: 2026-02-26
**Scope**: 100% test coverage for Indian GST implementation
**Status**: Ready for execution

---

## Test Environment Setup

### Prerequisites
- [ ] Dev server running on `http://localhost:3000`
- [ ] Superadmin account created and logged in
- [ ] At least one organization created with GST enabled
- [ ] Test data available (products, customers, suppliers)

### Test Data to Create First
1. **Organization**:
   - Name: "Test Corp GST"
   - GSTIN: "27AABCT1234Z0Z1" (valid format)
   - State Code: "27" (Maharashtra)
   - Enable GST: ✓

2. **Products** (with various GST rates):
   - Electronics (18% GST)
   - Clothing (5% GST)
   - Food Items (0% - exempted)
   - Services (18% GST)

3. **Customers**:
   - Same State (Maharashtra): GSTIN starting with "27"
   - Different State (Karnataka): GSTIN starting with "29"
   - Unregistered (no GSTIN)

---

## Test Cases by Category

### Category 1: Organization GST Configuration
**Module**: Settings / Admin / Organizations

#### TC-1.1: Enable GST on Organization
- [ ] Navigate to Settings > Organization
- [ ] Enable "GST" toggle
- [ ] Enter GSTIN: `27AABCT1234Z0Z1`
- [ ] Select State: "Maharashtra (27)"
- [ ] Save changes
- **Expected**: Organization updated successfully, GST fields saved in DB

#### TC-1.2: Verify GST Enabled State
- [ ] Refresh page
- [ ] Check if GST toggle is still enabled
- [ ] Verify GSTIN displays correctly
- [ ] Check state code in DB: `SELECT gstStateCode FROM "Organization"`
- **Expected**: All GST settings persisted correctly

#### TC-1.3: Disable GST
- [ ] Disable GST toggle
- [ ] Save changes
- [ ] Verify invoice creation still works (without GST)
- **Expected**: GST disabled successfully, invoices created without tax

---

### Category 2: Product GST Configuration
**Module**: Products / Inventory

#### TC-2.1: Create Product with HSN Code & GST Rate
- [ ] Navigate to Products > New Product
- [ ] Enter:
  - Name: "Laptop Computer"
  - SKU: "LAP-001"
  - Price: ₹50,000
  - HSN Code: `8471.30` (Computer goods)
  - GST Rate: `18%`
  - Unit: "Piece"
- [ ] Save
- **Expected**:
  - Product created with `hsnCode = "8471.30"` and `gstRate = 18.00`
  - Verify in DB: `SELECT hsnCode, gstRate FROM "Product" WHERE name = 'Laptop Computer'`

#### TC-2.2: Create Exempted Product (0% GST)
- [ ] Create product:
  - Name: "White Bread"
  - HSN: `1905.90`
  - GST Rate: `0%`
- **Expected**:
  - HSN saved correctly
  - gstRate = 0.00 in DB
  - No tax applied in invoices

#### TC-2.3: Create Service with GST
- [ ] Create product:
  - Name: "Consulting Service"
  - Is Service: ✓
  - HSN Code: `9990` (Services not elsewhere classified)
  - GST Rate: `18%`
- **Expected**: Service created with correct GST rate

#### TC-2.4: Update Product GST Rate
- [ ] Edit existing product
- [ ] Change GST rate from 5% to 12%
- [ ] Save
- **Expected**:
  - gstRate updated in DB
  - New invoices use new rate
  - Existing invoices maintain original rate

---

### Category 3: Customer GST Configuration
**Module**: Customers

#### TC-3.1: Create Same-State Customer with GSTIN
- [ ] Navigate to Customers > New Customer
- [ ] Enter:
  - Name: "ABC Pvt Ltd"
  - GSTIN: `27AABCT5678Z0Z1` (same state - 27)
  - Address: "Mumbai, Maharashtra"
  - State: "Maharashtra"
- [ ] Save
- **Expected**:
  - Customer created with GSTIN saved
  - DB: `SELECT gstin, gstStateCode FROM "Customer" WHERE name = 'ABC Pvt Ltd'`

#### TC-3.2: Create Inter-State Customer
- [ ] Create customer:
  - Name: "XYZ Traders"
  - GSTIN: `29AAXXX9999Z0Z1` (different state - 29, Karnataka)
  - State: "Karnataka"
- **Expected**:
  - GSTIN with different state code saved
  - System should apply IGST for this customer

#### TC-3.3: Create Unregistered Customer (No GSTIN)
- [ ] Create customer:
  - Name: "Retail Buyer"
  - GSTIN: (leave empty)
  - Registered for GST: ✗ (unregistered)
- **Expected**:
  - Customer created without GSTIN
  - System should apply full GST (CGST+SGST or IGST based on state)

---

### Category 4: Invoice GST Calculation - Same State (CGST + SGST)
**Module**: Invoices

#### TC-4.1: Create Invoice with Same-State Customer
- [ ] Create new invoice to "ABC Pvt Ltd" (same state)
- [ ] Add line items:
  | Product | Qty | Rate | HSN | GST% | Amount |
  |---------|-----|------|-----|------|--------|
  | Laptop | 1 | ₹50,000 | 8471.30 | 18% | ₹50,000 |

- [ ] System should calculate:
  - Subtotal: ₹50,000
  - CGST (9%): ₹4,500
  - SGST (9%): ₹4,500
  - IGST: ₹0
  - Total: ₹59,000

- **Expected**:
  - Line item shows: `cgstRate=9, sgstRate=9, igstRate=0`
  - Line item shows: `cgstAmount=4500, sgstAmount=4500, igstAmount=0`
  - Invoice totals: `totalCgst=4500, totalSgst=4500, totalIgst=0`
  - Verify in DB

#### TC-4.2: Multiple Items in Same Invoice (Mixed Tax Rates)
- [ ] Add items with different GST rates:
  | Product | Rate | GST% |
  |---------|------|------|
  | Laptop | ₹50,000 | 18% |
  | Shirt | ₹1,000 | 5% |
  | Bread | ₹500 | 0% |

- **Expected**:
  - Laptop: CGST=4500, SGST=4500 (18% ÷ 2 = 9% each)
  - Shirt: CGST=25, SGST=25 (5% ÷ 2 = 2.5% each)
  - Bread: CGST=0, SGST=0 (0% ÷ 2 = 0% each)
  - Total CGST = 4525, Total SGST = 4525

#### TC-4.3: Save Invoice and Verify DB
- [ ] Save invoice
- [ ] Query DB:
  ```sql
  SELECT id, number, totalCgst, totalSgst, totalIgst FROM "Invoice" WHERE number = 'INV-XXXX';
  SELECT hsnCode, gstRate, cgstRate, sgstRate, igstRate, cgstAmount, sgstAmount, igstAmount
    FROM "InvoiceItem" WHERE invoiceId = '[id]';
  ```
- **Expected**: All GST fields correctly persisted

---

### Category 5: Invoice GST Calculation - Inter-State (IGST)
**Module**: Invoices

#### TC-5.1: Create Invoice with Inter-State Customer
- [ ] Create invoice to "XYZ Traders" (different state - Karnataka)
- [ ] Add items:
  | Product | Rate | HST% |
  |---------|------|------|
  | Laptop | ₹50,000 | 18% |

- **Expected**:
  - Line item shows: `cgstRate=0, sgstRate=0, igstRate=18`
  - Line item shows: `cgstAmount=0, sgstAmount=0, igstAmount=9000`
  - Invoice totals: `totalCgst=0, totalSgst=0, totalIgst=9000`
  - Total amount: ₹59,000

#### TC-5.2: Multiple Items Inter-State (5% & 18% Mix)
- [ ] Add:
  | Product | Rate | GST% |
  |---------|------|------|
  | Laptop | ₹50,000 | 18% |
  | Shirt | ₹1,000 | 5% |

- **Expected**:
  - Laptop: IGST = ₹9,000
  - Shirt: IGST = ₹50
  - Total IGST = ₹9,050
  - No CGST or SGST

#### TC-5.3: Unregistered Customer (Different State)
- [ ] Create customer: "Local Trader" (different state, no GSTIN)
- [ ] Create invoice with same items
- **Expected**:
  - Should apply IGST (not customer registered status doesn't matter)
  - Same amounts as TC-5.2

---

### Category 6: Invoice GST - Edge Cases

#### TC-6.1: Zero-Rated Product (0% GST)
- [ ] Create invoice with "White Bread" (0% GST)
- **Expected**:
  - No tax applied
  - All GST fields = 0
  - Total = Base amount only

#### TC-6.2: High Precision Rounding (₹1,234.56 @ 18%)
- [ ] Create invoice with amount: ₹1,234.56
- [ ] GST Rate: 18%
- **Expected**:
  - CGST: ₹55.50 (1234.56 × 9% = 111.1104 → rounded)
  - SGST: ₹55.50
  - Verify no rounding errors

#### TC-6.3: Decimal Quantity Handling (2.5 pieces @ ₹1000 @ 18%)
- [ ] Add item: Qty=2.5, Rate=₹1000, GST=18%
- **Expected**:
  - Base: ₹2,500
  - CGST: ₹225
  - SGST: ₹225
  - No calculation errors

#### TC-6.4: Invoice Amount = ₹0 (Free items)
- [ ] Create invoice with free item (Rate=0)
- **Expected**:
  - Base: ₹0
  - All GST: ₹0
  - Invoice created successfully

---

### Category 7: Quotation GST
**Module**: Quotations

#### TC-7.1: Create Quotation with GST (Same State)
- [ ] Navigate to Quotations > New Quotation
- [ ] Select customer: "ABC Pvt Ltd" (same state)
- [ ] Add items: Laptop (18% GST)
- **Expected**:
  - GST calculated same way as invoices
  - CGST + SGST shown
  - PDF includes tax details

#### TC-7.2: Create Quotation with IGST (Different State)
- [ ] Create quotation for "XYZ Traders"
- [ ] Add items
- **Expected**:
  - IGST calculated and displayed
  - Quote shows total with tax

#### TC-7.3: Convert Quotation to Invoice
- [ ] Convert quotation to invoice
- **Expected**:
  - GST rates and amounts preserved
  - Invoice shows same tax as quotation

---

### Category 8: Purchase Invoices (Inbound GST)
**Module**: Purchase Invoices

#### TC-8.1: Create Purchase Invoice - Same State Supplier
- [ ] Navigate to Purchase Invoices > New
- [ ] Select supplier with same state GSTIN
- [ ] Add items: Laptop @ ₹50,000 (18% GST)
- **Expected**:
  - CGST = ₹4,500, SGST = ₹4,500
  - Purchase invoice created with correct tax
  - Input GST tracked for ITC eligibility

#### TC-8.2: Create Purchase Invoice - Different State Supplier
- [ ] Select supplier from different state
- [ ] Add items
- **Expected**:
  - IGST calculated (₹9,000 for ₹50,000 @ 18%)
  - No CGST/SGST

#### TC-8.3: Purchase Invoice - Unregistered Supplier
- [ ] Create supplier: "Local Trader" (no GSTIN)
- [ ] Create purchase invoice
- **Expected**:
  - Reverse charge mechanism may apply
  - GST still calculated for reference

---

### Category 9: Credit Notes (Returns)
**Module**: Credit Notes

#### TC-9.1: Full Return - Same State Customer
- [ ] Create credit note for returned item (Laptop, ₹50,000 @ 18%)
- **Expected**:
  - CGST credited: ₹4,500
  - SGST credited: ₹4,500
  - Tax amounts match original invoice

#### TC-9.2: Partial Return - Multiple Items
- [ ] Original invoice: Laptop (₹50,000 @ 18%) + Shirt (₹1,000 @ 5%)
- [ ] Credit note: Return Laptop only
- **Expected**:
  - Only Laptop tax credited
  - Shirt tax remains on customer account

#### TC-9.3: Return to Inter-State Customer
- [ ] Create credit note for inter-state customer
- **Expected**:
  - IGST credited correctly
  - No CGST/SGST

---

### Category 10: Debit Notes (Adjustments)
**Module**: Debit Notes

#### TC-10.1: Debit Note for Additional Charges
- [ ] Create debit note: Additional ₹5,000 service charge @ 18% GST
- **Expected**:
  - Additional CGST: ₹225, SGST: ₹225
  - Debit note created with tax

#### TC-10.2: Debit Note - Inter-State
- [ ] Create debit note to inter-state customer
- **Expected**:
  - IGST calculated on additional amount

---

### Category 11: PDF Export
**Module**: Documents / Reporting

#### TC-11.1: Invoice PDF - GST Table
- [ ] Create invoice with mixed tax rates
- [ ] Export to PDF
- [ ] Verify PDF contains:
  - [ ] HSN/SAC codes for each item
  - [ ] Individual tax rates (CGST%, SGST%, IGST%)
  - [ ] Tax amount columns
  - [ ] Summary: Total CGST, SGST, IGST
  - [ ] Grand total including tax

#### TC-11.2: Quotation PDF with GST
- [ ] Export quotation PDF
- [ ] Verify same tax details as invoice PDF

#### TC-11.3: Purchase Invoice PDF
- [ ] Export purchase invoice PDF
- [ ] Verify tax columns correct

---

### Category 12: Data Validation & Constraints

#### TC-12.1: HSN Code Validation
- [ ] Attempt to create product with invalid HSN:
  - [ ] Too short: "123"
  - [ ] Too long: "123456789"
  - [ ] Special characters: "8471@30"
  - [ ] Non-numeric: "ABCD30"
- **Expected**: Validation error or format correction

#### TC-12.2: GST Rate Validation
- [ ] Attempt invalid GST rates:
  - [ ] Negative: -5%
  - [ ] Over 100%: 150%
  - [ ] Invalid decimal: 5.5555%
- **Expected**:
  - Rejected or rounded to valid value
  - Valid rates: 0, 0.25, 0.5, 5, 12, 18, 28

#### TC-12.3: GSTIN Format Validation
- [ ] Attempt invalid GSTIN:
  - [ ] Too short: "27AABCT12"
  - [ ] Wrong checksum
  - [ ] Invalid state code: "99AABCT1234Z0Z1"
- **Expected**: Validation error with message

#### TC-12.4: State Code Validation
- [ ] Attempt mismatched GSTIN and state:
  - [ ] GSTIN: "27..." but selected state: "Karnataka"
- **Expected**: Warning or error message

---

### Category 13: Invoice Amendment & GST Update

#### TC-13.1: Edit Invoice - Change Tax Rate
- [ ] Create invoice with product @ 5% GST
- [ ] Edit invoice
- [ ] Change product GST rate to 18%
- **Expected**:
  - New GST applied to line item
  - Invoice totals recalculated
  - Previous calculations overwritten

#### TC-13.2: Edit Invoice - Add Item
- [ ] Existing invoice with CGST=1000, SGST=1000
- [ ] Add new item: ₹10,000 @ 18%
- **Expected**:
  - New CGST=900, new SGST=900
  - Total: CGST=1900, SGST=1900

---

### Category 14: Tax Summary & Reporting

#### TC-14.1: Organization Tax Dashboard
- [ ] Create 5+ invoices with varying tax rates
- [ ] Check dashboard/reports:
  - [ ] Total CGST collected
  - [ ] Total SGST collected
  - [ ] Total IGST collected
  - [ ] By-tax-rate breakdown
- **Expected**: Accurate summation of all taxes

#### TC-14.2: Customer-wise Tax Report
- [ ] Generate report by customer
- [ ] For each customer, show:
  - [ ] Total taxable value
  - [ ] Total tax applied
  - [ ] Tax rate breakdown
- **Expected**: Accurate per-customer totals

---

### Category 15: Multi-Organization GST Isolation

#### TC-15.1: Verify GST Settings Isolation
- [ ] Create 2 organizations:
  - Org A: GST enabled, GSTIN="27..."
  - Org B: GST disabled
- [ ] Create invoice in Org A with GST
- [ ] Switch to Org B
- [ ] Create invoice
- **Expected**:
  - Org A: Invoice shows GST
  - Org B: Invoice has no GST
  - Settings don't leak between orgs

#### TC-15.2: Product GST Isolation
- [ ] Create same product name in Org A and Org B
- [ ] Org A product: 18% GST
- [ ] Org B product: 5% GST
- [ ] Create invoices in each org
- **Expected**:
  - Org A uses 18%, Org B uses 5%
  - No cross-org data leakage

---

### Category 16: API Testing (Backend Validation)

#### TC-16.1: Create Product via API with GST
```bash
POST /api/products
{
  "name": "Test Product",
  "price": 50000,
  "unitId": "unit-123",
  "hsnCode": "8471.30",
  "gstRate": 18
}
```
- **Expected**:
  - 201 Created
  - Response includes hsnCode and gstRate
  - DB verification: values saved correctly

#### TC-16.2: Update Invoice with GST via API
```bash
PATCH /api/invoices/inv-123
{
  "items": [
    {
      "productId": "prod-123",
      "quantity": 1,
      "rate": 50000,
      "gstRate": 18,
      "hsnCode": "8471.30"
    }
  ]
}
```
- **Expected**:
  - GST amounts calculated
  - Persisted to DB

#### TC-16.3: Fetch Invoice - Verify GST in Response
```bash
GET /api/invoices/inv-123
```
- **Expected**:
  - Response includes all GST fields
  - Accurate tax calculations

---

## Test Execution Checklist

### Pre-Testing
- [ ] Database backed up
- [ ] Fresh seed data loaded
- [ ] Browser dev tools open (F12)
- [ ] PostgreSQL client ready for DB verification

### During Testing
- [ ] Screenshot critical test steps
- [ ] Log all test results
- [ ] Note any bugs/discrepancies
- [ ] Verify DB after each major operation

### Post-Testing
- [ ] Document all failures
- [ ] Verify 100% coverage achieved
- [ ] Generate test report
- [ ] Create bug tickets if needed

---

## Bug Report Template

```
## Bug: [Title]
**TC ID**: TC-X.X
**Severity**: Critical/High/Medium/Low
**Steps to Reproduce**:
1.
2.
3.

**Expected Result**:

**Actual Result**:

**Screenshot**:

**DB Query** (if applicable):

**Environment**:
- Browser:
- Timestamp:
```

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Dev Lead | | | |
| Manager | | | |

---

## Notes
- All decimal amounts should be tested for rounding accuracy
- Currency format: ₹ (Indian Rupee)
- Tax rates follow GST slab: 0%, 5%, 12%, 18%, 28%
- Always verify DB after UI changes
- Test both same-state and inter-state scenarios for completeness
