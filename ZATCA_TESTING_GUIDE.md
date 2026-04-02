# ZATCA Phase 2 Testing Guide

## Prerequisites

1. **Neon dev branch active** — run `/neon status` to confirm you're on `zatca-phase2`, NOT production
2. **Dev server running** — `npm run dev` (should be on `http://localhost:3000`)
3. **ZATCA_ENCRYPTION_KEY** — add to `.env`:
   ```
   ZATCA_ENCRYPTION_KEY="<64-char hex string>"
   ```
   Generate one:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

---

## Step 1: Enable Saudi E-Invoice (Phase 1) for a Test Org

### Via Super Admin UI

1. Log in as **superadmin**
2. Go to **Admin > Organizations > [select org]**
3. Enable **"Enable Saudi E-Invoice"**
4. Fill in:
   - **VAT Number (TRN)**: `399999999900003` (test TRN)
   - **CR Number**: `1010010000` (test CR)
5. Fill in Arabic details:
   - **Arabic Name**: any Arabic text (e.g. `شركة اختبار`)
   - **Arabic Address**: any Arabic text
   - **Arabic City**: e.g. `الرياض`
6. Save

### Via API (alternative)

```bash
curl -X PUT http://localhost:3000/api/admin/organizations/<ORG_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "saudiEInvoiceEnabled": true,
    "vatNumber": "399999999900003",
    "commercialRegNumber": "1010010000",
    "arabicName": "شركة اختبار",
    "arabicAddress": "شارع الملك فهد",
    "arabicCity": "الرياض"
  }'
```

---

## Step 2: Enable ZATCA Phase 2 (Super Admin)

### Via Super Admin UI

1. Same org settings page
2. Under the Saudi E-Invoice section, enable **"ZATCA Phase 2 Integration"** toggle
3. Save

### Via API

```bash
curl -X PUT http://localhost:3000/api/admin/organizations/<ORG_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{ "zatcaPhase2Allowed": true }'
```

### Verify

```bash
curl http://localhost:3000/api/zatca/status \
  -H "Cookie: <session-cookie>"
```

Expected: `"phase2Allowed": true, "phase2Active": false`

---

## Step 3: Onboarding (Sandbox)

### 3a. Set Environment to Sandbox

Directly in DB (Prisma Studio or SQL):
```sql
UPDATE organizations SET "zatcaEnvironment" = 'SANDBOX' WHERE id = '<ORG_ID>';
```

Or via Prisma Studio:
```bash
npx prisma studio
```

### 3b. Start Onboarding

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

**Note**: In SANDBOX mode, ZATCA accepts any OTP. Use `123456`.

**Expected response**:
```json
{
  "success": true,
  "certificateId": "clxx...",
  "status": "COMPLIANCE_CSID_ISSUED",
  "message": "Compliance CSID obtained. Run compliance check next."
}
```

**If it fails**: Check that `ZATCA_ENCRYPTION_KEY` is set in `.env`.

---

## Step 4: Compliance Check

```bash
curl -X POST http://localhost:3000/api/zatca/compliance-check \
  -H "Cookie: <session-cookie>"
```

This auto-generates and submits 6 test invoices:
1. Standard Tax Invoice
2. Standard Credit Note
3. Standard Debit Note
4. Simplified Tax Invoice
5. Simplified Credit Note
6. Simplified Debit Note

**Expected response**:
```json
{
  "success": true,
  "message": "All 6 compliance test invoices passed. Ready to activate.",
  "results": [
    { "label": "Standard Invoice", "status": "PASSED" },
    { "label": "Standard Credit Note", "status": "PASSED" },
    ...
  ]
}
```

**If any fail**: Check the `errors` array in the failed result. Common issues:
- Invalid XML structure — check `ubl-xml.ts`
- Hash mismatch — check `xml-signing.ts`
- Missing required fields

---

## Step 5: Activate (Get Production CSID)

```bash
curl -X POST http://localhost:3000/api/zatca/activate \
  -H "Cookie: <session-cookie>"
```

**Expected response**:
```json
{
  "success": true,
  "message": "Production CSID obtained. ZATCA Phase 2 is now active.",
  "expiresAt": "2031-04-02T..."
}
```

### Verify

```bash
curl http://localhost:3000/api/zatca/status \
  -H "Cookie: <session-cookie>"
```

Expected: `"phase2Active": true`, certificate status: `"PRODUCTION_CSID_ISSUED"`

---

## Step 6: Test Invoice Creation (B2C — Simplified)

### 6a. Create a B2C Invoice (no buyer VAT number)

Create an invoice through the UI or API for a customer **without a VAT number**. This will be detected as `SIMPLIFIED` and reported to ZATCA asynchronously.

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "customerId": "<CUSTOMER_ID_WITHOUT_VAT>",
    "issueDate": "2026-04-02T10:00:00Z",
    "dueDate": "2026-05-02T10:00:00Z",
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

**Expected**: Response includes `zatcaSubmission` with status `PENDING` or `REPORTED`.

### 6b. Check Submission

```bash
curl http://localhost:3000/api/zatca/submissions \
  -H "Cookie: <session-cookie>"
```

Look for the invoice's submission record with status `REPORTED` or `PENDING`.

---

## Step 7: Test Invoice Creation (B2B — Standard / Clearance)

### 7a. Create a Customer with VAT Number

Ensure you have a customer with a valid test TRN (15 digits starting with 3, e.g. `399999999900003`).

### 7b. Create a B2B Invoice

Create an invoice for this customer. It will be detected as `STANDARD` and submitted for clearance.

**Default (sync clearance)**: The response will include `zatcaSubmission` with status `CLEARED` if successful.

**Async clearance mode**: If `zatcaClearanceAsync` is enabled on the org, the invoice returns with status `PENDING` and is processed by the queue.

### 7c. Test Async Clearance

1. Enable async mode:
   ```sql
   UPDATE organizations SET "zatcaClearanceAsync" = true WHERE id = '<ORG_ID>';
   ```
2. Create a B2B invoice — should return with `PENDING` status
3. Process the queue:
   ```bash
   curl -X POST http://localhost:3000/api/zatca/process-queue \
     -H "Cookie: <session-cookie>"
   ```
4. Check submissions — should now be `CLEARED`

---

## Step 8: Test Credit Note

1. Create a credit note linked to an existing invoice
2. Check that `zatcaSubmission` is returned in the response
3. Verify in submissions list:
   ```bash
   curl "http://localhost:3000/api/zatca/submissions?documentType=CREDIT_NOTE" \
     -H "Cookie: <session-cookie>"
   ```

---

## Step 9: Test Debit Note

1. Create a debit note linked to a purchase invoice
2. Check that `zatcaSubmission` is returned
3. Verify in submissions list:
   ```bash
   curl "http://localhost:3000/api/zatca/submissions?documentType=DEBIT_NOTE" \
     -H "Cookie: <session-cookie>"
   ```

---

## Step 10: Test Manual Retry

1. Find a `FAILED` or `REJECTED` submission ID from the submissions list
2. Retry:
   ```bash
   curl -X POST "http://localhost:3000/api/zatca/submit/<DOCUMENT_ID>?type=invoice" \
     -H "Cookie: <session-cookie>"
   ```

---

## Step 11: Test Queue Processing

Process all pending submissions at once:

```bash
curl -X POST http://localhost:3000/api/zatca/process-queue \
  -H "Cookie: <session-cookie>"
```

**Expected response**:
```json
{
  "processed": 5,
  "succeeded": 4,
  "failed": 1
}
```

---

## Step 12: Test Certificate Renewal

```bash
curl -X POST http://localhost:3000/api/zatca/renew \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{ "otp": "123456" }'
```

**Expected**: New certificate created, old one marked as `EXPIRED`.

---

## Step 13: Verify Zero Impact on Non-ZATCA Orgs

1. Switch to an org that does NOT have `zatcaPhase2Allowed` enabled
2. Create invoices, credit notes, debit notes normally
3. Verify:
   - No `zatcaSubmission` in responses
   - No errors or slowdowns
   - Invoice creation works exactly as before

---

## Checking Results in Database

### View certificates
```bash
npx prisma studio
```
Open `ZatcaCertificate` table — check `status`, `isActive`, `expiresAt`.

### View submissions
Open `ZatcaSubmission` table — check:
- `status` — PENDING / CLEARED / REPORTED / REJECTED / FAILED
- `errorMessages` — JSON array of ZATCA errors
- `warningMessages` — JSON array of warnings
- `clearedXml` — populated only for CLEARED B2B invoices
- `attemptCount` — retry count
- `signedXml` — the signed UBL XML sent to ZATCA

---

## Common Issues & Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `ZATCA_ENCRYPTION_KEY not set` | Missing env var | Add to `.env` |
| `ZATCA Phase 2 not enabled` | `zatcaPhase2Allowed` is false | Enable via super admin UI |
| `No compliance CSID found` | Onboarding not done | Run `/api/zatca/onboard` first |
| `Compliance check must pass first` | Trying to activate before compliance | Run `/api/zatca/compliance-check` |
| `Active certificate missing production CSID` | Not activated yet | Run `/api/zatca/activate` |
| `invalid-invoice-hash` | XML modified after hashing | Check `xml-signing.ts` — ensure 3 elements are removed before hashing |
| `QR code failures` | Wrong tag count or encoding | Check `qr-code.ts` — Phase 2 needs 9 tags |
| `Address validation errors` | BuildingNumber not 4 digits | Ensure org/customer addresses have proper formatting |
| Sandbox returns auth errors | Wrong environment or expired OTP | Verify `zatcaEnvironment = SANDBOX` and use OTP `123456` |

---

## Testing Sequence Summary

```
1. Enable Saudi E-Invoice (Phase 1)     → Super admin UI
2. Enable ZATCA Phase 2 Allowed         → Super admin UI toggle
3. Onboard (sandbox, OTP: 123456)       → POST /api/zatca/onboard
4. Compliance check (6 test invoices)   → POST /api/zatca/compliance-check
5. Activate (get production CSID)       → POST /api/zatca/activate
6. Create B2C invoice (simplified)      → Verify REPORTED status
7. Create B2B invoice (standard)        → Verify CLEARED status
8. Create credit note                   → Verify submission
9. Create debit note                    → Verify submission
10. Test async clearance mode           → Toggle + queue processing
11. Test manual retry                   → POST /api/zatca/submit/[id]
12. Test certificate renewal            → POST /api/zatca/renew
13. Verify non-ZATCA orgs unaffected    → Create invoices on other orgs
```

---

## Moving to Simulation / Production

Once sandbox testing passes:

1. Change environment:
   ```sql
   UPDATE organizations SET "zatcaEnvironment" = 'SIMULATION' WHERE id = '<ORG_ID>';
   ```
2. Get a real OTP from FATOORA portal (`fatoora.zatca.gov.sa`)
3. Repeat onboarding → compliance → activation cycle
4. For production: change to `'PRODUCTION'` and repeat with production OTP
