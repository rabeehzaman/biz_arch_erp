# ZATCA Phase 2 Testing Guide

Complete step-by-step guide to test every part of ZATCA Phase 2 e-invoicing,
from unit tests to live sandbox integration.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Part A: Unit Tests (No Server Needed)](#part-a-unit-tests-no-server-needed)
3. [Part B: Setup for Integration Tests](#part-b-setup-for-integration-tests)
4. [Part C: Organization Setup (Super Admin)](#part-c-organization-setup-super-admin)
5. [Part D: ZATCA Onboarding Ceremony](#part-d-zatca-onboarding-ceremony)
6. [Part E: Invoice Submission Tests](#part-e-invoice-submission-tests)
7. [Part F: Credit Note & Debit Note Tests](#part-f-credit-note--debit-note-tests)
8. [Part G: Queue & Async Processing](#part-g-queue--async-processing)
9. [Part H: Certificate Renewal](#part-h-certificate-renewal)
10. [Part I: Non-ZATCA Org Isolation](#part-i-non-zatca-org-isolation)
11. [Part J: UI Verification Checklist](#part-j-ui-verification-checklist)
12. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

### Environment Variables

Add these to your `.env` file:

```bash
# Required: 32-byte hex string for encrypting ZATCA private keys
# Generate one:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ZATCA_ENCRYPTION_KEY="<64-char hex string>"

# Already required:
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
AUTH_URL="http://localhost:3000"
```

### Database

Make sure your Neon branch is correct (NOT production):

```bash
# Check current branch
npx neon branches list

# The ZATCA models (ZatcaCertificate, ZatcaSubmission) must exist
npx prisma db push    # if migrations haven't been applied
```

### Accounts You'll Need

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Super Admin | `superadmin@bizarch.com` | `superadmin123` | Enable ZATCA for orgs |
| Saudi Org Admin | *(create one below)* | *(you choose)* | Run ZATCA flows |
| India Org Admin | `admin@bizarch.com` | `admin123` | Verify zero impact |

---

## Part A: Unit Tests (No Server Needed)

These run entirely locally with no database or ZATCA API calls.

### A1. Phase 1 Tests (VAT, TRN, QR, Hash)

```bash
npx tsx src/__tests__/saudi-vat.test.ts
```

**Expected:** `63 passed, 0 failed`

Tests: TRN validation, line/document VAT calculation, invoice type determination,
SHA-256 hash chain, UUID generation, 5-tag TLV QR encoding.

### A2. Phase 2 Tests (Certificates, XML, Signing, Enhanced QR, Full Pipeline)

```bash
npx tsx src/__tests__/zatca-phase2.test.ts
```

**Expected:** `240 passed, 0 failed` across 45 test sections.

Tests cover:
- **Configuration** - Environment URLs, API paths, doc types, algorithms, namespaces, exemption codes, initial PIH, encryption key
- **Certificate Management** - ECDSA secp256k1 key generation, PEM import/export round-trip, AES-256-GCM encryption/decryption, CSR generation (sandbox + production), DER/P1363 signature conversion, sign/verify
- **UBL XML Generation** - Standard B2B invoice, Simplified B2C invoice, Credit Note (381), Debit Note (383), document-level discount, line-level discount, mixed tax categories (S+Z+E), cash payment means
- **XML Signing** - Full 8-step XAdES-BES flow, signature embedding, hash determinism, different invoices produce different hashes
- **Enhanced QR Code** - Phase 1 (5 text tags), Phase 2 (9 tags with binary), multi-byte TLV length encoding
- **QR Embedding** - Embed QR in signed XML
- **Full Pipeline** - End-to-end for all 4 document types (Standard, Simplified, Credit Note, Debit Note), PIH hash chain linking, ICV monotonic counter
- **Edge Cases** - Arabic-only names, zero amounts, large amounts (9,999,999.99), 50 line items, XML special characters

### A3. TypeScript Compile Check

```bash
npx tsc --noEmit
```

**Expected:** No errors.

---

## Part B: Setup for Integration Tests

### B1. Start the Dev Server

```bash
npm run dev
```

Wait for `Ready in Xms` message. Verify at http://localhost:3000.

### B2. Login as Super Admin

Open http://localhost:3000/login and sign in:
- Email: `superadmin@bizarch.com`
- Password: `superadmin123`

---

## Part C: Organization Setup (Super Admin)

### C1. Create or Select a Saudi Organization

**Option A: Use existing Saudi org**

Go to **Admin > Organizations** and find an org with `Edition: SAUDI`.
The org "Qimma Adawi (Copy)" already has Phase 2 enabled.

**Option B: Create a new test org**

1. Go to **Admin > Organizations > Create Organization**
2. Set:
   - Name: `ZATCA Test Org`
   - Slug: `zatca-test-org`
   - Edition: `SAUDI`
3. Save

### C2. Configure Saudi E-Invoice (Phase 1)

1. Go to **Admin > Organizations > [your Saudi org]**
2. Enable **"Saudi E-Invoice"** toggle
3. Fill in mandatory fields:

| Field | Test Value | Notes |
|-------|-----------|-------|
| VAT Number (TRN) | `399999999900003` | 15 digits, starts with 3 |
| CR Number | `1010010000` | Commercial registration |
| Arabic Name | `شركة اختبار` | Required for XML/QR |
| Arabic Address | `شارع الملك فهد` | Required for CSR |
| Arabic City | `الرياض` | Required for CSR |

4. Save

**Verify:** The "ZATCA" badge should appear next to the org name.

### C3. Enable ZATCA Phase 2

1. Same org settings page
2. Under Saudi E-Invoice section, enable **"ZATCA Phase 2 Integration"** toggle
3. Save

**Verify via API:**

```bash
curl http://localhost:3000/api/zatca/status \
  -H "Cookie: <your-session-cookie>"
```

Expected:
```json
{
  "phase2Allowed": true,
  "phase2Active": false,
  "environment": "SANDBOX",
  "saudiEInvoiceEnabled": true,
  "vatNumber": "399999999900003",
  "certificate": null
}
```

### C4. Create an Admin User for the Saudi Org

You need a user who **belongs to the Saudi org** (superadmin has no org context).

**Via Prisma Studio:**

```bash
npx prisma studio
```

Open the `User` table and create:
- Name: `ZATCA Tester`
- Email: `zatca@test.com`
- Password: *(bcrypt hash of your password)*
  ```bash
  node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"
  ```
- Role: `admin`
- Organization: *(select your Saudi org)*

**Log out of superadmin and log in as this user.** All remaining steps use this account.

### C5. Set ZATCA Environment

The environment controls which ZATCA API you talk to:

| Environment | When to Use | OTP |
|-------------|------------|-----|
| `SANDBOX` | Initial development testing | Any value (e.g. `123456`) |
| `SIMULATION` | Pre-production UAT | Real OTP from FATOORA portal |
| `PRODUCTION` | Live | Real OTP from FATOORA portal |

Set via Prisma Studio or SQL:
```sql
UPDATE organizations SET "zatcaEnvironment" = 'SANDBOX' WHERE id = '<ORG_ID>';
```

---

## Part D: ZATCA Onboarding Ceremony

This is the 4-step process to get a production certificate from ZATCA.

### D1. Onboard (Generate CSR + Get Compliance CSID)

```bash
curl -X POST http://localhost:3000/api/zatca/onboard \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "otp": "123456",
    "branchName": "Main Branch",
    "egsDeviceId": "EGS1-TEST"
  }'
```

**What happens behind the scenes:**
1. Generates ECDSA secp256k1 keypair
2. Creates CSR with ZATCA-specific OIDs (VAT number, template name, SAN fields)
3. Encrypts private key with AES-256-GCM (using `ZATCA_ENCRYPTION_KEY`)
4. Sends CSR + OTP to ZATCA `/compliance` endpoint
5. Receives Compliance CSID (certificate) + secret
6. Stores everything in `ZatcaCertificate` table

**Expected response:**
```json
{
  "success": true,
  "certificateId": "clxx...",
  "status": "COMPLIANCE_CSID_ISSUED",
  "message": "Compliance CSID obtained. Run compliance check next."
}
```

**Verify in DB:** Open `ZatcaCertificate` in Prisma Studio:
- `status` = `COMPLIANCE_CSID_ISSUED`
- `isActive` = `true`
- `complianceCsid` = non-null
- `privateKeyEnc` = non-null (encrypted)

### D2. Compliance Check (Submit 6 Test Invoices)

```bash
curl -X POST http://localhost:3000/api/zatca/compliance-check \
  -H "Cookie: <session-cookie>"
```

**What happens behind the scenes:**
1. Generates 6 test invoices (each with 1 item: 100 SAR + 15 SAR VAT):
   - Standard Tax Invoice (388, `0100000`)
   - Standard Credit Note (381, `0100000`)
   - Standard Debit Note (383, `0100000`)
   - Simplified Tax Invoice (388, `0200000`)
   - Simplified Credit Note (381, `0200000`)
   - Simplified Debit Note (383, `0200000`)
2. For each: generates UBL XML -> signs it (XAdES-BES) -> submits to ZATCA `/compliance/invoices`
3. Chains the PIH (previous invoice hash) from one to the next
4. Updates certificate status to `COMPLIANCE_PASSED` if all 6 pass

**Expected response:**
```json
{
  "success": true,
  "message": "All 6 compliance test invoices passed. Ready to activate.",
  "results": [
    { "label": "Standard Invoice", "status": "PASSED" },
    { "label": "Standard Credit Note", "status": "PASSED" },
    { "label": "Standard Debit Note", "status": "PASSED" },
    { "label": "Simplified Invoice", "status": "PASSED" },
    { "label": "Simplified Credit Note", "status": "PASSED" },
    { "label": "Simplified Debit Note", "status": "PASSED" }
  ]
}
```

**If any fail:** Check the `errors` array in the failed result. Common causes:
- Invalid XML structure (check `ubl-xml.ts`)
- Hash mismatch (check `xml-signing.ts`)
- Missing required fields (address, building number, etc.)

### D3. Activate (Get Production CSID)

```bash
curl -X POST http://localhost:3000/api/zatca/activate \
  -H "Cookie: <session-cookie>"
```

**What happens:**
1. Exchanges Compliance CSID for Production CSID via `/production/csids`
2. Updates certificate: status -> `PRODUCTION_CSID_ISSUED`, stores production credentials
3. Sets `zatcaPhase2Active = true` on the organization

**Expected response:**
```json
{
  "success": true,
  "message": "Production CSID obtained. ZATCA Phase 2 is now active.",
  "expiresAt": "2031-04-02T..."
}
```

### D4. Verify Activation

```bash
curl http://localhost:3000/api/zatca/status \
  -H "Cookie: <session-cookie>"
```

**Expected:**
```json
{
  "phase2Allowed": true,
  "phase2Active": true,
  "environment": "SANDBOX",
  "certificate": {
    "status": "PRODUCTION_CSID_ISSUED",
    "expiresAt": "2031-..."
  },
  "submissions": { "pending": 0, "cleared": 0, "reported": 0, ... }
}
```

---

## Part E: Invoice Submission Tests

**Prerequisite:** Complete Part D (Phase 2 must be active).

### E1. Create a B2C Invoice (Simplified / Reporting)

Create an invoice for a customer **without a VAT number**. This triggers `SIMPLIFIED` type.

**Via UI:**
1. Go to **Invoices > New Invoice**
2. Select a customer that has no VAT number (or create one)
3. Add line items, set payment type
4. Save

**Via API:**
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "customerId": "<CUSTOMER_ID_WITHOUT_VAT>",
    "issueDate": "2026-04-04T10:00:00Z",
    "dueDate": "2026-05-04T10:00:00Z",
    "paymentType": "CASH",
    "items": [{
      "productId": "<PRODUCT_ID>",
      "description": "Test Product",
      "quantity": 1,
      "unitPrice": 100,
      "vatRate": 15,
      "vatCategory": "S"
    }]
  }'
```

**What to verify:**
- Invoice is created with `saudiInvoiceType: "SIMPLIFIED"`
- A `ZatcaSubmission` record is created with `submissionMode: "REPORTING"`
- Status should be `REPORTED` (or `PENDING` if async)
- The submission has `signedXml`, `xmlHash`, `enhancedQrData`

**Check submissions:**
```bash
curl "http://localhost:3000/api/zatca/submissions" \
  -H "Cookie: <session-cookie>"
```

### E2. Create a B2B Invoice (Standard / Clearance)

Create an invoice for a customer **with a valid VAT number**. This triggers `STANDARD` type.

**Setup:** First create/update a customer with VAT number `399999999900003`.

**Via UI:**
1. Create a customer with VAT Number: `399999999900003`
2. Go to **Invoices > New Invoice**, select this customer
3. Add items, save

**What to verify:**
- Invoice has `saudiInvoiceType: "STANDARD"`
- `ZatcaSubmission` has `submissionMode: "CLEARANCE"`
- Status should be `CLEARED` (synchronous clearance)
- `clearedXml` is populated (ZATCA-stamped XML)
- The cleared XML contains ZATCA's digital stamp

### E3. Manual Submission / Retry

If an invoice wasn't auto-submitted or failed:

```bash
curl -X POST "http://localhost:3000/api/zatca/submit/<INVOICE_ID>?type=invoice" \
  -H "Cookie: <session-cookie>"
```

**Expected response:**
```json
{
  "submissionId": "...",
  "status": "CLEARED",
  "clearedXml": "<ZATCA stamped XML>"
}
```

### E4. Check Submission Details

```bash
curl "http://localhost:3000/api/zatca/submissions" \
  -H "Cookie: <session-cookie>"
```

**Verify for each submission:**
- `documentType` matches (INVOICE, CREDIT_NOTE, DEBIT_NOTE)
- `submissionMode` matches (CLEARANCE for B2B, REPORTING for B2C)
- `status` is CLEARED/REPORTED (not REJECTED/FAILED)
- `warningMessages` and `errorMessages` are empty arrays
- `attemptCount` >= 1

---

## Part F: Credit Note & Debit Note Tests

### F1. Create a Credit Note

1. Go to **Credit Notes > New**
2. Link to an existing invoice
3. Add return items
4. Save

**What to verify:**
- Document type code is `381`
- `BillingReference` in the XML points to the original invoice number
- Submitted to ZATCA (check submissions with `documentType=CREDIT_NOTE`)

```bash
curl "http://localhost:3000/api/zatca/submissions?documentType=CREDIT_NOTE" \
  -H "Cookie: <session-cookie>"
```

### F2. Create a Debit Note

1. Go to **Debit Notes > New**
2. Link to a purchase invoice
3. Save

**What to verify:**
- Document type code is `383`
- `BillingReference` in the XML points to the original purchase invoice number
- Submitted to ZATCA (check submissions with `documentType=DEBIT_NOTE`)

---

## Part G: Queue & Async Processing

### G1. Enable Async Clearance Mode

Set on the organization (via Prisma Studio or SQL):
```sql
UPDATE organizations SET "zatcaClearanceAsync" = true WHERE id = '<ORG_ID>';
```

### G2. Create a B2B Invoice in Async Mode

Create an invoice for a customer with VAT number. Instead of synchronous clearance, the response should return with `status: "PENDING"`.

### G3. Process the Queue

```bash
curl -X POST http://localhost:3000/api/zatca/process-queue \
  -H "Cookie: <session-cookie>"
```

**Expected response:**
```json
{
  "processed": 1,
  "succeeded": 1,
  "failed": 0
}
```

### G4. Verify After Queue Processing

Check submissions again - the PENDING invoice should now be `CLEARED`.

### G5. Retry Logic

If a submission fails with a network error:
- `status` becomes `FAILED`
- `nextRetryAt` is set (1 minute, then exponential backoff up to 4 hours)
- Running `process-queue` again will retry failed submissions after their `nextRetryAt`

### G6. Disable Async Mode

```sql
UPDATE organizations SET "zatcaClearanceAsync" = false WHERE id = '<ORG_ID>';
```

---

## Part H: Certificate Renewal

### H1. Trigger Renewal

```bash
curl -X POST http://localhost:3000/api/zatca/renew \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{ "otp": "123456" }'
```

**What happens:**
1. Generates new keypair + CSR
2. Gets new Compliance CSID
3. Gets new Production CSID
4. Old certificate marked as `EXPIRED`, new one is `PRODUCTION_CSID_ISSUED`

**Verify in DB:**
- Old cert: `status = EXPIRED`, `isActive = false`
- New cert: `status = PRODUCTION_CSID_ISSUED`, `isActive = true`
- New cert has `renewedFromId` pointing to old cert

---

## Part I: Non-ZATCA Org Isolation

This verifies that ZATCA has **zero impact** on organizations that don't use it.

### I1. Login to an India Org

Login as `admin@bizarch.com` / `admin123` (India org).

### I2. Verify ZATCA Is Not Available

```bash
# Status endpoint returns phase2Allowed=false
curl http://localhost:3000/api/zatca/status \
  -H "Cookie: <india-session-cookie>"

# Onboarding is blocked
curl -X POST http://localhost:3000/api/zatca/onboard \
  -H "Content-Type: application/json" \
  -H "Cookie: <india-session-cookie>" \
  -d '{"otp":"123456"}'
# Expected: {"error":"ZATCA Phase 2 not enabled for this organization. Contact super admin."}
```

### I3. Verify Normal Operations Work

1. **Create an invoice** - should work normally, no ZATCA fields
2. **Create a credit note** - should work normally
3. **Create a purchase invoice** - should work normally
4. **Generate PDFs** - should work without QR code or ZATCA elements
5. **POS operations** - should work unaffected

### I4. Verify No ZATCA Data Created

Check that no `ZatcaCertificate` or `ZatcaSubmission` records exist for the India org:

```bash
# Submissions list should be empty
curl "http://localhost:3000/api/zatca/submissions" \
  -H "Cookie: <india-session-cookie>"
# Expected: {"data":[],"total":0,"hasMore":false}
```

---

## Part J: UI Verification Checklist

### Admin Organization Settings

- [ ] Saudi E-Invoice toggle visible for SAUDI edition orgs
- [ ] ZATCA Phase 2 toggle visible **only** when Saudi E-Invoice is enabled
- [ ] VAT Number, CR Number, Arabic Name/Address/City fields appear when Saudi E-Invoice is on
- [ ] "ZATCA" badge appears next to org name when Saudi E-Invoice is enabled
- [ ] Saving with Phase 2 toggle ON sets `zatcaPhase2Allowed = true`

### Customer Form

- [ ] VAT Number field (15 chars, placeholder `3XXXXXXXXXXXXXX`) visible for Saudi orgs
- [ ] Arabic Name field (RTL input) visible for Saudi orgs
- [ ] District, Building Number, Addition Number fields visible
- [ ] CR Number field visible
- [ ] These fields are **hidden** for India orgs

### Invoice Creation

- [ ] Tax-inclusive pricing checkbox visible for Saudi orgs
- [ ] Payment type shows bilingual labels: "Cash / نقدي", "Credit / آجل"
- [ ] Line items calculate VAT correctly at 15%
- [ ] Saving an invoice for customer WITHOUT VAT -> `saudiInvoiceType = SIMPLIFIED`
- [ ] Saving an invoice for customer WITH valid VAT -> `saudiInvoiceType = STANDARD`

### Invoice Detail View

- [ ] Shows "Tax Inclusive" or "Tax Exclusive" badge
- [ ] Shows invoice type: "Simplified Tax Invoice" or "Tax Invoice"
- [ ] Shows "ZATCA Phase 1" label (Phase 2 label when submissions exist)
- [ ] QR code image renders when `qrCodeData` exists
- [ ] QR code labeled "ZATCA-compliant QR code"
- [ ] VAT breakdown shows (not GST/SGST/IGST for Saudi)
- [ ] Invoice Counter Value (ICV) displayed

### Invoice PDF

- [ ] QR code renders in PDF
- [ ] Arabic text displays correctly (right-to-left)
- [ ] VAT amount and TRN displayed
- [ ] Bilingual layout (English + Arabic)

### POS Receipt

- [ ] QR code appears on printed receipt when available
- [ ] Receipt layout unaffected for non-Saudi orgs

---

## Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ZATCA_ENCRYPTION_KEY not set` | Missing env var | Add 64-char hex string to `.env` |
| `ZATCA Phase 2 not enabled` | `zatcaPhase2Allowed = false` | Enable via super admin org settings |
| `Saudi e-invoicing must be enabled` | Missing VAT/CR number | Fill in VAT, CR, Arabic fields |
| `No compliance CSID found` | Onboarding not done | Run `POST /api/zatca/onboard` |
| `Compliance check must pass first` | Trying to activate too early | Run `POST /api/zatca/compliance-check` |
| `Active certificate missing production CSID` | Not activated | Run `POST /api/zatca/activate` |
| `ZATCA Phase 2 is not active` | Trying to submit before activation | Complete full onboarding ceremony |
| `No active production certificate to renew` | No cert exists | Complete onboarding first |
| `Onboarding failed: ... 400` | ZATCA rejected the CSR | Check CSR fields, OTP, environment |
| `Invalid Request` (sandbox) | ZATCA sandbox gateway issue | Try again later or use simulation |
| `Invalid-CSR` (simulation) | Wrong OTP or CSR format | Use real OTP from FATOORA portal |

### Checking Database State

```bash
npx prisma studio
```

**ZatcaCertificate table:**
- `status` - Current state in the lifecycle
- `isActive` - Only one active cert per org
- `complianceCsid` / `productionCsid` - The ZATCA certificates
- `expiresAt` - When the production cert expires
- `privateKeyEnc` - Encrypted private key (never decryptable without `ZATCA_ENCRYPTION_KEY`)

**ZatcaSubmission table:**
- `status` - PENDING / CLEARED / REPORTED / REJECTED / WARNING / FAILED
- `submissionMode` - CLEARANCE (B2B) or REPORTING (B2C)
- `signedXml` - The complete signed UBL XML sent to ZATCA
- `clearedXml` - ZATCA-stamped XML (only for CLEARED B2B invoices)
- `zatcaResponse` - Full JSON response from ZATCA
- `errorMessages` / `warningMessages` - ZATCA validation feedback
- `attemptCount` - How many times submission was attempted
- `nextRetryAt` - When to retry (for FAILED submissions)

### ZATCA Environments

| Environment | Base URL | Notes |
|-------------|----------|-------|
| Sandbox | `gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal` | Any OTP, fake certs |
| Simulation | `gw-fatoora.zatca.gov.sa/e-invoicing/simulation` | Real OTP from FATOORA |
| Production | `gw-fatoora.zatca.gov.sa/e-invoicing/core` | Real OTP, legal invoices |

**To change environment:**
```sql
UPDATE organizations SET "zatcaEnvironment" = 'SIMULATION' WHERE id = '<ORG_ID>';
```

Then re-run the full onboarding ceremony (onboard -> compliance -> activate).
**Never mix CSIDs across environments.**

---

## Full Testing Sequence (Checklist)

```
UNIT TESTS
  [_] A1. Phase 1 unit tests pass (63/63)
  [_] A2. Phase 2 unit tests pass (240/240)
  [_] A3. TypeScript compiles clean

SETUP
  [_] B1. Dev server running
  [_] C1. Saudi org exists with SAUDI edition
  [_] C2. Saudi E-Invoice enabled (VAT, CR, Arabic fields filled)
  [_] C3. ZATCA Phase 2 toggle enabled
  [_] C4. Admin user created in Saudi org
  [_] C5. Environment set to SANDBOX

ONBOARDING
  [_] D1. Onboard: CSR generated, Compliance CSID received
  [_] D2. Compliance: All 6 test invoices passed
  [_] D3. Activate: Production CSID received, Phase 2 active
  [_] D4. Status endpoint confirms activation

INVOICE SUBMISSION
  [_] E1. B2C invoice: SIMPLIFIED, REPORTED status
  [_] E2. B2B invoice: STANDARD, CLEARED status
  [_] E3. Manual retry works for failed submissions
  [_] E4. Submissions list shows correct data

CREDIT/DEBIT NOTES
  [_] F1. Credit note submitted with BillingReference
  [_] F2. Debit note submitted with BillingReference

QUEUE & ASYNC
  [_] G1. Async clearance mode enabled
  [_] G2. B2B invoice returns PENDING in async mode
  [_] G3. Queue processing clears pending submissions
  [_] G5. Failed submissions retry with backoff

CERTIFICATE RENEWAL
  [_] H1. Renewal creates new cert, old one marked EXPIRED

ISOLATION
  [_] I1. India org cannot access ZATCA features
  [_] I2. India org invoice/credit note/POS works normally
  [_] I3. No ZATCA data created for India org

UI CHECKS
  [_] J. All items in UI Verification Checklist above
```
