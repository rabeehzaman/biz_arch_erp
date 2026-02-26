# Goal Description
Implement Phase 1 (Fatoora) of Saudi Arabia's ZATCA e-invoicing for specific organizations. Phase 1 requires generating a Base64 encoded TLV (Tag-Length-Value) QR code containing the Seller Name, VAT Number, Timestamp, Total Amount, and VAT Total on all tax invoices and simplified tax invoices. This feature will be controlled by a per-organization toggle. 

To properly handle ZATCA requirements, we will also implement a **Generic VAT Engine**, adding standard VAT fields. This will ensure Saudi organizations have a way to input the mandatory 15% VAT, completely separate from the Indian GST system.

Phase 2 (Integration with ZATCA XML UBL APIs) will be planned for a future update.

## Proposed Changes

### Database Schema
We will add fields to identify if an organization has VAT and Saudi E-Invoicing enabled, along with VAT fields and mandatory Arabic translations for ZATCA compliance.

#### [MODIFY] [schema.prisma](file:///Users/tmr/Desktop/Final%20Projects/biz_arch_erp/prisma/schema.prisma)
- **Organization**: Add `vatEnabled Boolean @default(false)`
- **Organization**: Add `isSaudiEInvoiceEnabled Boolean @default(false)`
- **Organization**: Add `vatNumber String?`
- **Organization**: Add `arabicName String?`, `arabicAddress String?`, `arabicCity String?`, `arabicState String?`
- **Customer**: Add `arabicName String?`, `arabicAddress String?`, `arabicCity String?`, `arabicState String?`
- **Product**: Add `arabicName String?`, `arabicDescription String?`
- **Product**: Add `vatRate Decimal @default(0) @db.Decimal(5, 2)`
- **Invoice / PurchaseInvoice / Quotation / CreditNote / DebitNote**:
  - Add `totalVat Decimal @default(0) @db.Decimal(12, 2)`
- **InvoiceItem / PurchaseInvoiceItem / QuotationItem / CreditNoteItem / DebitNoteItem**:
  - Add `vatRate Decimal @default(0) @db.Decimal(5, 2)`
  - Add `vatAmount Decimal @default(0) @db.Decimal(12, 2)`

---
### Backend & Services
We need a service to encode the invoice data into ZATCA's specific Phase 1 Base64 TLV format, and update the auth session to include VAT rules.

#### [NEW] [qr.ts](file:///Users/tmr/Desktop/Final%20Projects/biz_arch_erp/src/lib/zatca/qr.ts)
- Create a utility function `generateZatcaQR(sellerName: string, vatRegistrationNumber: string, timestamp: Date | string, invoiceTotal: number, vatTotal: number): string`
- Implement Tag-Length-Value (TLV) encoding using Node `Buffer`.
- Return the final Base64 encoded string.

#### [MODIFY] [Auth Session](file:///Users/tmr/Desktop/Final%20Projects/biz_arch_erp/src/lib/auth.config.ts)
- Expose `vatEnabled` and `isSaudiEInvoiceEnabled` in the NextAuth session user object so the UI can conditionally render columns.

---
### UI & Settings
We will update the Organization settings, Forms (Customer, Product, etc.), and display components to accommodate Arabic.

#### [MODIFY] [Organization Form Component](file:///Users/tmr/Desktop/Final%20Projects/biz_arch_erp/src/app/(dashboard)/admin/organizations) 
- Automatically set `vatEnabled` to true when `isSaudiEInvoiceEnabled` is checked.
- Add a text input for `VAT Number` (`vatNumber`), visible when `vatEnabled` is true.
- Add inputs for the Organization's Arabic Name and Address fields.

#### [MODIFY] [Forms (Customer, Product, Invoice)](file:///Users/tmr/Desktop/Final%20Projects/biz_arch_erp/src/app/(dashboard))
- **Product & Customer Forms**: If `session.user.isSaudiEInvoiceEnabled` is true, show additional form fields for Arabic Name, Description, and Address.
- **Invoice Forms**: If `session.user.vatEnabled` is true, show "VAT %" columns instead of "GST %" columns.
- Update subtotal and total calculations to include `totalVat`.

#### [MODIFY] [Invoice Display Component](file:///Users/tmr/Desktop/Final%20Projects/biz_arch_erp/src/components)
- Conditionally render the QR code if `organization.isSaudiEInvoiceEnabled` is true.
- Render the Invoice bilingually (English & Arabic) using the new Arabic schema fields for the Seller, Buyer, and Line Items.
- Call `generateZatcaQR(...)` passing the relevant invoice parameters, notably `totalVat`.
- Display the QR code using a standard React QR library (to be installed).

## Verification Plan

### Automated Tests
- Run `npm run build` to verify TypeScript compilation after schema generation.

### Manual Verification
1. Navigate to Organization settings (`http://localhost:3000/admin/organizations`), enable Saudi E-Invoicing. Verify VAT is also enabled and enter a VAT number.
2. Create an invoice for this organization, adding sample line items and 15% VAT. Ensure the GST columns do not appear.
3. Open the Invoice print view or PDF.
4. Scan the rendered QR code using an online ZATCA TLV decoder or official App to verify all 5 fields pass validation.
