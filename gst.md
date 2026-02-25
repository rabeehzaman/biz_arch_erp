# GST Test Case Scenarios

## Environment Setup
1. **Login**: Login to the application as `superadmin@bizarch.com` using password `superadmin123`.
2. **Organization Creation/Selection**: If an organization doesn't exist, create one. Ensure it has a predefined State/Province.
3. **Enable GST**: Navigate to Organization Settings (via the settings cog or profile) and toggle "Enable GST" (if it's not already enabled) and provide any dummy GST number.

## Scenario 1: Product Configuration (GST Rates)
- **Objective**: Ensure products can be created with different GST rates.
- **Steps**:
  1. Navigate to "Products" or "Inventory".
  2. Create Product A with 5% GST.
  3. Create Product B with 18% GST.
  4. Create Product C with 0% GST.
- **Expected Result**: Products should be saved successfully with the correct GST rates mapped.

## Scenario 2: Intra-state Customer Creation & Sales Invoice (CGST/SGST)
- **Objective**: Verify standard intra-state sales logic (Buyer & Seller in the SAME state).
- **Steps**:
  1. Create Customer X with an address in the same state as the Organization.
  2. Navigate to "Invoices" or "Sales".
  3. Create a new Invoice for Customer X.
  4. Add Product B (18% GST).
- **Expected Result**: The system should automatically split the 18% GST into 9% CGST and 9% SGST. IGST should be 0. Total Invoice value should reflect Base Amount + CGST + SGST.

## Scenario 3: Inter-state Customer Creation & Sales Invoice (IGST)
- **Objective**: Verify standard inter-state sales logic (Buyer & Seller in DIFFERENT states).
- **Steps**:
  1. Create Customer Y with an address in a different state from the Organization.
  2. Create a new Invoice for Customer Y.
  3. Add Product B (18% GST).
- **Expected Result**: The system should map the entire 18% GST to IGST. CGST and SGST should be 0. Total should reflect Base Amount + IGST.

## Scenario 4: Intra-state Purchase Invoice (CGST/SGST)
- **Objective**: Verify purchase logic for local suppliers.
- **Steps**:
  1. Create Supplier M in the same state.
  2. Create a Purchase Invoice for Supplier M.
  3. Add Product A (5% GST).
- **Expected Result**: The total tax should be split equally into CGST 2.5% and SGST 2.5%. No IGST applied.

## Scenario 5: Inter-state Purchase Invoice (IGST)
- **Objective**: Verify purchase logic for outside-state suppliers.
- **Steps**:
  1. Create Supplier N in a different state.
  2. Create a Purchase Invoice for Supplier N.
  3. Add Product A (5% GST).
- **Expected Result**: The total 5% tax should be booked as IGST. No CGST/SGST.

## Scenario 6: Mixed Tax Rates on a Single Invoice
- **Objective**: Ensure line items with different GST rates are aggregated correctly.
- **Steps**:
  1. Create an Intra-state Invoice (Customer X).
  2. Add Product A (5%) and Product B (18%).
- **Expected Result**: The receipt/invoice summary should break down tax into sub-totals: 
  - 2.5% CGST + 2.5% SGST on Product A amount
  - 9% CGST + 9% SGST on Product B amount

## Scenario 7: Discounts and GST Base Calculation
- **Objective**: Verify that GST is applied to the discounted subtotal, not the gross.
- **Steps**:
  1. Create an Invoice for Customer X.
  2. Add Product B (18% GST), qty 1 at ₹1000.
  3. Apply a 10% discount on the line item.
- **Expected Result**: Subtotal should be ₹900. GST should be 18% of ₹900 = ₹162 (₹81 CGST + ₹81 SGST). Total should be ₹1062.