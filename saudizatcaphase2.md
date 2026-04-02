# ZATCA Phase 2 e-invoicing: complete implementation guide for Next.js

**ZATCA's Integration Phase requires your EGS to generate UBL 2.1 XML invoices, sign them with ECDSA-SHA256 (secp256k1) via XAdES-BES, and submit them to ZATCA's API for clearance (B2B) or reporting (B2C) — all achievable on Vercel serverless with zero native dependencies.** Your existing Phase 1 infrastructure (VAT calculation, hash chain, UUID/ICV sequencing, bilingual PDFs) provides a strong foundation; the gaps are UBL XML generation, PKI/signing, enhanced QR codes, and API integration. This guide covers every technical detail needed to bridge those gaps using your exact stack.

The onboarding flow follows a strict sequence: generate an ECDSA keypair → create a CSR with ZATCA-specific OIDs → exchange an OTP for a Compliance CSID → pass 6 compliance test invoices → receive a Production CSID valid for up to 5 years. Once live, B2B standard invoices require synchronous clearance before delivery to the buyer, while B2C simplified invoices are reported asynchronously within 24 hours. The entire signing and submission pipeline — XML generation, canonicalization, ECDSA signing, and ZATCA API call — takes under 1 second of CPU time and fits comfortably within Vercel's function limits.

---

## 1. API endpoints, authentication, and request formats

ZATCA operates three environments with identical endpoint paths but different base URLs. **Never mix CSIDs across environments** — a sandbox CSID will not authenticate against production.

| Environment | Base URL | Purpose |
|---|---|---|
| **Developer Sandbox** | `https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal` | Code testing with fake CSIDs |
| **Simulation** | `https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/` | UAT with real company credentials |
| **Production** | `https://gw-fatoora.zatca.gov.sa/e-invoicing/core/` | Live tax reporting — every invoice is legal |

Five endpoints exist under each base URL, all using `POST`:

- `/compliance` — Request a Compliance CSID (CCSID)
- `/compliance/invoices` — Submit test invoices for compliance verification
- `/production/csids` — Request or renew a Production CSID (PCSID)
- `/invoices/clearance/single` — B2B standard invoice clearance (synchronous)
- `/invoices/reporting/single` — B2C simplified invoice reporting (synchronous)

Authentication uses **HTTP Basic Auth** with the CSID certificate as the username and the secret as the password: `Authorization: Basic base64(binarySecurityToken:secret)`. The sole exception is the initial `/compliance` call, which uses an `OTP` header instead. All requests require these headers:

```
Accept: application/json
Content-Type: application/json
Accept-Version: V2
Accept-Language: en
```

The request body wraps the **Base64-encoded signed XML** in JSON:

```json
{
  "invoiceHash": "<SHA-256 hash of invoice, Base64-encoded>",
  "uuid": "<UUID v4>",
  "invoice": "<Base64-encoded signed XML>"
}
```

Responses return a `validationResults` object containing `infoMessages`, `warningMessages`, and `errorMessages` arrays, plus `reportingStatus` or `clearanceStatus` fields. **HTTP 200** means accepted; **202** means accepted with warnings (do not resubmit); **400** means rejected with errors that must be fixed; **303** signals that clearance is temporarily switched off (fall back to reporting); **429** indicates rate limiting.

ZATCA validates against a three-tier pyramid: XSD structural compliance, EN 16931 business rules (`BR-xx` codes), and KSA-specific rules (`BR-KSA-xx` codes). A single error in any tier rejects the entire invoice.

---

## 2. Onboarding from OTP to Production CSID

The onboarding ceremony follows six precise steps, and every detail of the CSR matters.

**Step 1: Generate OTP.** Log into the FATOORA portal (`https://fatoora.zatca.gov.sa/`) with ERAD credentials. Click "Onboard new solution unit/device" and generate OTP codes — one per EGS unit. **OTPs expire after 1 hour.**

**Step 2: Generate ECDSA keypair.** The required algorithm is **ECDSA on the secp256k1 curve** (256-bit). In Node.js:

```typescript
import { Crypto } from '@peculiar/webcrypto';
const crypto = new Crypto();
const keys = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'K-256', hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);
```

**Step 3: Generate CSR with custom OIDs.** The CSR must include these fields:

| Field | OID | Value | Example |
|---|---|---|---|
| Country (C) | 2.5.4.6 | Always `SA` | `SA` |
| Organization (O) | 2.5.4.10 | Company name | `Acme Corp` |
| Org Unit (OU) | 2.5.4.11 | Branch name | `Main Branch` |
| Common Name (CN) | 2.5.4.3 | EGS device identifier | `EGS1-886431145` |
| **organizationIdentifier (UID)** | **2.5.4.97** | **15-digit VAT number** | **`399999999800003`** |
| Serial Number (SN) | SAN | `1-Name\|2-Version\|3-Serial` | `1-MyApp\|2-1.0\|3-abc123` |
| title | SAN | Invoice type flags (TSCZ) | `1100` (both Standard+Simplified) |
| registeredAddress | SAN (2.5.4.26) | Branch address | `Riyadh` |
| businessCategory | SAN (2.5.4.15) | Industry | `Technology` |
| certificateTemplateName | 1.3.6.1.4.1.311.20.2 | **`ZATCA-Code-Signing`** for prod; `PREZATCA-Code-Signing` for simulation | |

The **`title` field** is critical — it determines how many compliance invoices are required. `1000` = standard only (3 tests), `0100` = simplified only (3 tests), **`1100` = both (6 tests)**. For a SaaS handling both B2B and B2C, use `1100`.

**Step 4: Exchange CSR for Compliance CSID.** POST the Base64-encoded CSR to `/compliance` with the OTP header. ZATCA returns `binarySecurityToken` (the certificate), `secret`, and `requestID`.

**Step 5: Submit 6 compliance test invoices.** Using CCSID auth, submit to `/compliance/invoices`:

1. Standard Tax Invoice (388, subtype 0100000)
2. Standard Credit Note (381, subtype 0100000)
3. Standard Debit Note (383, subtype 0100000)
4. Simplified Tax Invoice (388, subtype 0200000)
5. Simplified Credit Note (381, subtype 0200000)
6. Simplified Debit Note (383, subtype 0200000)

All six must pass with zero errors.

**Step 6: Get Production CSID.** POST `{ "compliance_request_id": "<requestID>" }` to `/production/csids` with CCSID auth. ZATCA's CA issues a production certificate valid for **up to 60 months (5 years)**. Set a renewal reminder 30 days before expiry. Renewal follows the same flow: new OTP → new CSR → ZATCA revokes old cert and issues new one.

---

## 3. UBL 2.1 XML structure with all required elements

Every ZATCA document uses the `<Invoice>` root element — even credit and debit notes. The `InvoiceTypeCode` value (388, 381, or 383) differentiates them. Seven namespaces are mandatory:

```xml
<Invoice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
  xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
  xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
```

The **7-position subtype code** in `<cbc:InvoiceTypeCode name="0100000">` encodes: positions 1–2 = `01` (standard) or `02` (simplified); position 3 = third-party; position 4 = nominal supply; position 5 = export; position 6 = summary; position 7 = self-billed.

**Standard vs. Simplified field differences:** Standard (01xxxxx) requires full buyer details — name, VAT number, postal address with **4-digit building number** and **4-digit plot identification** — all mandatory. Simplified (02xxxxx) makes buyer details optional. Both require the seller's complete address, delivery date, and payment means.

The complete element ordering within `<Invoice>` follows this sequence:

1. `ext:UBLExtensions` — contains the XAdES signature (see Section 4)
2. `cbc:ProfileID` — `"reporting:1.0"`
3. `cbc:ID` — human-readable invoice number
4. `cbc:UUID` — UUID v4
5. `cbc:IssueDate` — `YYYY-MM-DD` format (BR-KSA-F-01, now an error if wrong)
6. `cbc:IssueTime` — `HH:MM:SS`
7. `cbc:InvoiceTypeCode` — with `name` attribute for subtype
8. `cbc:DocumentCurrencyCode` — `SAR` (or foreign currency)
9. `cbc:TaxCurrencyCode` — always `SAR`
10. `cac:BillingReference` — **only for credit/debit notes (381/383)**
11. `cac:AdditionalDocumentReference` — ICV, PIH, and QR entries
12. `cac:Signature` — signature method reference
13. `cac:AccountingSupplierParty` — seller details
14. `cac:AccountingCustomerParty` — buyer details
15. `cac:Delivery` — `ActualDeliveryDate` and optional `LatestDeliveryDate`
16. `cac:PaymentMeans` — payment method code
17. `cac:AllowanceCharge` — document-level discounts/charges
18. `cac:TaxTotal` — **two elements required** (see below)
19. `cac:LegalMonetaryTotal` — all monetary totals
20. `cac:InvoiceLine` — one or more line items

**Tax handling requires two `TaxTotal` elements.** The first contains only the tax amount in document currency. The second contains tax amount in SAR plus `TaxSubtotal` breakdowns per category. Each subtotal specifies `TaxableAmount`, `TaxAmount`, and a `TaxCategory` with ID, Percent, and TaxScheme:

```xml
<cac:TaxSubtotal>
  <cbc:TaxableAmount currencyID="SAR">900.00</cbc:TaxableAmount>
  <cbc:TaxAmount currencyID="SAR">135.00</cbc:TaxAmount>
  <cac:TaxCategory>
    <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>
    <cbc:Percent>15</cbc:Percent>
    <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
  </cac:TaxCategory>
</cac:TaxSubtotal>
```

**Four tax category codes** map to your existing VAT categories: **`S`** = standard 15%, **`Z`** = zero-rated 0%, **`E`** = exempt, **`O`** = out-of-scope. Categories Z, E, and O require `TaxExemptionReasonCode` (e.g., `VATEX-SA-32` for zero-rated exports, `VATEX-SA-EDU` for education exemptions, `VATEX-SA-OOS` for out-of-scope).

**Discounts operate at three levels.** Document-level uses `cac:AllowanceCharge` as a child of `Invoice` with `ChargeIndicator=false` for discounts. Line-level uses the same element under `cac:InvoiceLine`. Price-level uses `cac:AllowanceCharge` under `cac:Price` — only discounts allowed here (BR-KSA-EN16931-06 prohibits charges at price level). The arithmetic must satisfy: `LineExtensionAmount = Qty × PriceAmount`; `TaxExclusiveAmount = Σ(LineExtensionAmount) − doc_allowances + doc_charges`; `TaxInclusiveAmount = TaxExclusiveAmount + TaxTotal`; `PayableAmount = TaxInclusiveAmount − PrepaidAmount`.

**Billing reference for credit/debit notes** is straightforward:

```xml
<cac:BillingReference>
  <cac:InvoiceDocumentReference>
    <cbc:ID>ORIGINAL-INV-001</cbc:ID>
  </cac:InvoiceDocumentReference>
</cac:BillingReference>
```

**Three AdditionalDocumentReference entries** carry ZATCA-specific data: ICV (the sequential counter stored in `cbc:UUID`), PIH (the Base64-encoded SHA-256 hash of the previous invoice stored in `EmbeddedDocumentBinaryObject`), and QR (the Base64-encoded TLV buffer).

---

## 4. Digital signing with XAdES-BES and ECDSA-SHA256

The signing process is the most complex piece. ZATCA requires **ECDSA-SHA256 on secp256k1** wrapped in an **XAdES-BES (B-B level)** enveloped signature, using **XML Canonicalization 1.1** (`http://www.w3.org/2006/12/xml-c14n11`).

The signature lives inside `ext:UBLExtensions > ext:UBLExtension > ext:ExtensionContent > sig:UBLDocumentSignatures > sac:SignatureInformation > ds:Signature`. A corresponding `cac:Signature` element in the invoice body references it.

**The complete signing flow has 8 steps:**

**Step 1 — Build the invoice XML** with all elements populated except `ds:SignatureValue`, `ds:DigestValue` entries, and the QR `EmbeddedDocumentBinaryObject`.

**Step 2 — Compute the invoice hash.** Remove three elements via XPath transforms: `ext:UBLExtensions`, `cac:Signature`, and `cac:AdditionalDocumentReference[cbc:ID='QR']`. Canonicalize the remaining XML with C14N 1.1. Compute SHA-256. This Base64-encoded hash becomes the first `ds:DigestValue` (Id="invoiceSignedData") and is also sent to ZATCA's API.

**Step 3 — Populate XAdES SignedProperties.** The `xades:SignedProperties` element (Id="xadesSignedProperties") requires:
- `xades:SigningTime` — ISO 8601 timestamp from your server clock
- `xades:SigningCertificate` with `CertDigest` (SHA-256 of the DER-encoded certificate) and `IssuerSerial` (X509IssuerName + X509SerialNumber)
- No unsigned properties are needed at B-B level

**Step 4 — Compute the SignedProperties digest.** Canonicalize the `SignedProperties` element, SHA-256 hash it, Base64-encode. This becomes the second `ds:DigestValue` (URI="#xadesSignedProperties").

**Step 5 — Assemble `ds:SignedInfo`** with both Reference elements, the CanonicalizationMethod (`xml-c14n11`), and SignatureMethod (`ecdsa-sha256`).

**Step 6 — Sign.** Canonicalize `ds:SignedInfo`, then ECDSA-sign with the private key using SHA-256. Base64-encode the result into `ds:SignatureValue`.

**Step 7 — Generate the enhanced QR code** (see Section 5).

**Step 8 — Embed everything.** Insert the complete `ds:Signature` block, the signing certificate in `ds:X509Certificate`, and the QR Base64 string.

**On signature encoding:** The `ds:SignatureValue` in the XML uses standard XMLDSIG encoding (ASN.1/DER then Base64). However, **QR code tags 7 and 9 use IEEE P1363 format** — raw r‖s concatenation, 32+32 = 64 bytes for secp256k1. Converting from DER to P1363 requires parsing the ASN.1 structure and extracting the r and s integers.

---

## 5. Enhanced 9-tag QR code byte-level specification

Phase 2 extends the QR from 5 TLV tags to 9. Each tag is encoded as `[tag_byte][length_byte][value_bytes]`, concatenated, then Base64-encoded. The QR uses **Model 2 with error correction level M (15%)**, maximum **~700 Base64 characters**, minimum print size **2×2 cm**.

| Tag | Field | Data Type | Length | Encoding |
|---|---|---|---|---|
| 1 | Seller name | UTF-8 string | Variable | UTF-8 bytes |
| 2 | VAT number | UTF-8 string | 15 bytes | UTF-8 of 15-digit TRN |
| 3 | Timestamp | UTF-8 string | Variable | ISO 8601 `2024-01-15T14:30:00Z` |
| 4 | Total with VAT | UTF-8 string | Variable | Decimal `"2100.99"` |
| 5 | VAT total | UTF-8 string | Variable | Decimal `"315.15"` |
| **6** | **Invoice hash** | **Raw bytes** | **32 bytes** | **SHA-256 raw output (not hex string)** |
| **7** | **ECDSA signature** | **Raw bytes** | **64 bytes** | **IEEE P1363: r(32) ‖ s(32), big-endian** |
| **8** | **Public key** | **Raw bytes** | **~88 bytes** | **DER SubjectPublicKeyInfo from certificate** |
| **9** | **CA certificate signature** | **Raw bytes** | **64 bytes** | **IEEE P1363 of ZATCA CA's signature on the cert** |

Tag 6 is the same hash computed in signing Step 2. Tag 7 is the ECDSA signature of that hash using the taxpayer's private key, encoded as IEEE P1363. Tag 8 is the public key extracted from the signing certificate in DER SubjectPublicKeyInfo format. Tag 9 is extracted from the X.509 certificate's "Signature Value" field — this is **ZATCA's CA signature** proving the certificate was legitimately issued. If the certificate stores it in DER format, convert to IEEE P1363.

**The full 9-tag QR is mandatory only for Simplified (B2C) invoices.** For Standard (B2B) invoices, **ZATCA generates and inserts the QR during clearance** — your system doesn't need to produce it pre-submission, though you can include a placeholder.

```typescript
function encodeTLV(tag: number, value: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from([tag]),
    Buffer.from([value.length]),
    value,
  ]);
}

const tlvBuffer = Buffer.concat([
  encodeTLV(1, Buffer.from(sellerName, 'utf-8')),
  encodeTLV(2, Buffer.from(vatNumber, 'utf-8')),
  encodeTLV(3, Buffer.from(timestamp, 'utf-8')),
  encodeTLV(4, Buffer.from(totalWithVat, 'utf-8')),
  encodeTLV(5, Buffer.from(vatTotal, 'utf-8')),
  encodeTLV(6, invoiceHashBytes),         // 32 bytes raw SHA-256
  encodeTLV(7, signatureIEEE),            // 64 bytes r‖s
  encodeTLV(8, publicKeyDER),             // ~88 bytes SubjectPublicKeyInfo
  encodeTLV(9, certSignatureIEEE),        // 64 bytes r‖s
]);
const qrBase64 = tlvBuffer.toString('base64');
```

---

## 6. Clearance and reporting flows in practice

**B2B clearance is a hard gate.** Standard tax invoices must be cleared synchronously by ZATCA before the PDF is generated for the buyer. The API call to `/invoices/clearance/single` returns the invoice XML modified with ZATCA's cryptographic stamp and QR code. **The cleared XML — not your original — is what you share with the buyer.** Typical API response time is 1–5 seconds.

**B2C reporting is fire-and-forget within 24 hours.** Your EGS signs the invoice locally, generates the 9-tag QR, delivers it to the customer immediately, then reports to `/invoices/reporting/single` within the deadline. ZATCA validates and returns status but does not modify the XML.

**When clearance is rejected (HTTP 400):** you must create a new invoice with a **new UUID, new ICV (incremented), new timestamp, and new hash**. The Previous Invoice Hash (PIH) must reference the hash of the rejected invoice — ZATCA tracks rejected document hashes in the chain. For B2B rejections, update the date (the original was never a valid invoice). For B2C rejections, keep the original transaction date.

**A critical architectural insight**: ZATCA's stamp and QR modifications are not part of the invoice hash. This means your system can continue generating the next invoice's PIH from the pre-clearance XML without waiting for the clearance response. This enables pipelining.

**Invoice cancellation does not exist.** Once issued, invoices cannot be voided or deleted. The only correction mechanism is **credit notes** (to reduce) or **debit notes** (to increase). These follow the same clearance/reporting flow as regular invoices and must include a `BillingReference` to the original invoice.

**If ZATCA's API is down:** B2C invoices can continue being issued offline and queued for reporting. For B2B, ZATCA may return HTTP 303 ("clearance switched off") — your system should automatically fall back to the reporting endpoint. Notify ZATCA of system failures at `https://zatca.gov.sa/en/E-Invoicing/FailureNotifications/`. Once resolved, all queued transactions must be submitted.

---

## 7. Recommended Node.js packages and why node-forge won't work

**`node-forge` does not support ECDSA/ECC at all** — confirmed across multiple GitHub issues. It only handles RSA. This eliminates it entirely for ZATCA Phase 2, which mandates secp256k1.

The recommended pure-JavaScript stack for Vercel compatibility:

| Purpose | Package | Why |
|---|---|---|
| secp256k1 ECDSA | `@peculiar/webcrypto` | Extends WebCrypto with K-256 curve. Pure JS. |
| CSR generation | `@peculiar/x509` v2+ | Supports custom OIDs including 2.5.4.97. Pure JS/TS. |
| X.509 parsing | `@peculiar/x509` | Parse ZATCA certificates, extract fields |
| CMS/PKCS#7 | `pkijs` | Full RFC 5652 CMS implementation. Pure JS. |
| XML generation | `xmlbuilder2` | Excellent multi-namespace support for UBL 2.1 |
| XML signatures | `xmldsigjs` | C14N + XMLDSIG. Pure JS. By PeculiarVentures. |
| XAdES-BES | `xadesjs` | Extends xmldsigjs with XAdES properties |
| DOM parsing | `@xmldom/xmldom` | Required by xml signing libraries. Pure JS. |
| QR generation | `qrcode` (existing) | Already in your stack |

The **`zatca-xml-js`** package on GitHub (by wes4m, MIT license) is the best TypeScript reference implementation. It handles invoice XML templating, signing with xmldsigjs, and ZATCA API calls. However, it has two limitations: it shells out to OpenSSL for key/CSR generation (incompatible with Vercel), and the author explicitly states it only supports simplified invoices. **Use it as a reference, not a dependency** — replace its OpenSSL calls with `@peculiar/x509` + `@peculiar/webcrypto`.

CSR generation without OpenSSL:

```typescript
import * as x509 from '@peculiar/x509';
import { Crypto } from '@peculiar/webcrypto';

const crypto = new Crypto();
x509.cryptoProvider.set(crypto);

const alg = { name: 'ECDSA', namedCurve: 'K-256', hash: 'SHA-256' };
const keys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);

const csr = await x509.Pkcs10CertificateRequestGenerator.create({
  name: 'CN=EGS1-Unit,OU=Main Branch,O=Acme Corp,C=SA,2.5.4.97=399999999800003',
  keys,
  signingAlgorithm: alg,
  extensions: [
    new x509.KeyUsagesExtension(
      x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.nonRepudiation
    ),
  ],
  // SAN with custom OIDs for SN, title, registeredAddress, businessCategory
  // may require ASN1 manual construction for ZATCA-specific SAN fields
});

const csrBase64 = Buffer.from(csr.rawData).toString('base64');
```

For C14N canonicalization, `xml-crypto` handles Inclusive C14N and Exclusive C14N in pure JavaScript. The `xmldsigjs` library also provides built-in C14N 1.1 support as part of its signing pipeline. No native `libxml` bindings are needed.

---

## 8. Vercel serverless architecture fits comfortably

**Timeout is not a concern.** Vercel Pro with Fluid Compute (default for new projects since April 2025) measures only active CPU time. The entire clearance pipeline — XML generation (~50ms), signing (~10–50ms), Base64 encoding (~5ms) — consumes well under 1 second of CPU. Network I/O waiting for ZATCA's API (1–5 seconds) does not count against the limit. Even without Fluid Compute, the 300-second wall-clock limit on Hobby plans is more than sufficient.

**Zero native dependencies are required.** Every package in the recommended stack is pure JavaScript. This avoids the `libxmljs2` trap entirely — that C++ addon requires `node-gyp` and won't reliably deploy on Vercel. The `@xmldom/xmldom` + `xmlbuilder2` + `xmldsigjs` combination provides full XML processing without any native bindings. Vercel's 250MB bundle limit is not remotely a concern.

**For the B2C reporting queue, use Upstash QStash** (push-based, event-driven) as the primary mechanism with a Vercel Cron safety net:

```
Invoice Created → POST to QStash with /api/zatca/report endpoint
  → QStash delivers webhook → handler reports to ZATCA
  → Automatic retries with exponential backoff on failure
  → Dead letter queue for permanent failures
```

QStash integrates natively via the Vercel marketplace, costs $1/100K requests (500/day free), and provides at-least-once delivery with configurable retries. A Vercel Cron job running every minute on Pro plan catches any missed invoices by querying Prisma for unreported records.

**Store certificates and private keys in Vercel environment variables** (Base64-encoded strings, scoped to Production). ECDSA private keys are small (~100 bytes) — well within the 4KB env var limit. For multi-tenant SaaS with per-organization EGS units, store credentials in your PostgreSQL database (encrypted at rest) and cache in Upstash Redis with TTL matching certificate expiry.

```typescript
// Multi-tenant credential retrieval
async function getOrgCredentials(organizationId: string) {
  const cached = await redis.get(`zatca:creds:${organizationId}`);
  if (cached) return JSON.parse(cached);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      zatcaPrivateKey: true,
      zatcaCertificate: true,
      zatcaSecret: true,
      zatcaCertExpiry: true,
    },
  });

  await redis.set(`zatca:creds:${organizationId}`, JSON.stringify(org), {
    ex: 3600, // 1 hour cache
  });
  return org;
}
```

---

## 9. Edge cases that will bite you in production

**Phase 1 to Phase 2 hash chain transition.** Phase 1 did not require hash chains or PIH — those were generation-only features in your system. The first Phase 2 invoice uses an initial PIH value of `NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==` (the Base64 SHA-256 of "0") or simply a predefined initial hash. **The chain effectively resets.** Your existing ICV counter can continue from where it left off — there is no ZATCA requirement to restart from 1, only that values are sequential and non-repeating per EGS unit.

**Multi-currency invoices require SAR tax amounts.** Set `DocumentCurrencyCode` to the foreign currency (USD, EUR, etc.) and `TaxCurrencyCode` to `SAR`. The VAT amount must always be converted to SAR using the Saudi Central Bank (SAMA) exchange rate on the date of supply. When `DocumentCurrencyCode ≠ SAR`, ZATCA rule BR-KSA validates that the two `TaxTotal` elements show different amounts.

**Common rejection reasons from real deployments**, ranked by frequency:

- **`invalid-invoice-hash`** — the hash sent in the API body doesn't match the computed hash of the XML. Almost always caused by modifying XML content after hash calculation, whitespace changes during serialization, or double Base64 encoding
- **QR code failures** — Phase 2 requires all 9 TLV tags; Phase 1's 5-tag QR is rejected. Timestamp in QR must match invoice issue time exactly
- **Arithmetic precision errors** — BR-CO-15 (total with VAT ≠ total without VAT + VAT), BR-CO-17 (category tax amount ≠ taxable × rate rounded to 2 decimals). Always use `ROUND(TaxableAmount × Rate, 2)` and round at the document level
- **Address validation** — BuildingNumber must be exactly 4 digits (BR-KSA-37), PlotIdentification must be exactly 4 digits (BR-KSA-64), PostalZone must be 5 digits
- **Date format** — must be `YYYY-MM-DD` (BR-KSA-F-01, now an error, previously a warning)
- **Missing exemption reason codes** — categories Z, E, and O require both `TaxExemptionReasonCode` and `TaxExemptionReason`

**Invoice sequencing after rejections.** ZATCA stores hashes of rejected documents. If Document 2 is rejected and Document 3 is accepted, Document 3's PIH must reference Document 2's hash (the rejected one). When resubmitting the corrected version as Document 4, its PIH references Document 3's hash. Never skip a rejected invoice in the chain.

---

## Conclusion: what to build and in what order

Your Phase 1 infrastructure handles roughly 40% of the Phase 2 requirements. The migration path should follow this sequence: **First**, implement UBL 2.1 XML generation using `xmlbuilder2` — map your existing Prisma Invoice/CreditNote/DebitNote models to the XML schema above. **Second**, build the PKI layer with `@peculiar/webcrypto` + `@peculiar/x509` for key/CSR generation and `xmldsigjs`/`xadesjs` for signing. **Third**, implement the 9-tag QR encoder replacing your current 5-tag TLV function. **Fourth**, build the ZATCA API client with proper error handling, the 303 fallback, and retry logic. **Fifth**, set up the QStash reporting queue for B2C invoices. **Sixth**, run through the full onboarding cycle in the simulation environment before going live.

The most underappreciated gotcha is hash chain integrity across rejections and the three-element exclusion (UBLExtensions, Signature, QR) before hashing. Get the hash computation exactly right in isolation before integrating the full signing flow. The `zatca-xml-js` repository remains the single best reference for seeing how all the pieces connect in TypeScript — study its signing module, then rebuild with the serverless-compatible packages listed above.