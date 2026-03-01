/**
 * Saudi e-Invoice (ZATCA Phase 1) Test Suite
 * Headless unit tests for all Saudi VAT logic — no database required.
 * Run with: npx tsx src/__tests__/saudi-vat.test.ts
 */

import { validateTRN, calculateLineVAT, calculateDocumentVAT, determineSaudiInvoiceType } from "@/lib/saudi-vat/calculator";
import { SAUDI_VAT_RATE, VATCategory } from "@/lib/saudi-vat/constants";
import { computeInvoiceHash, generateInvoiceUUID, GENESIS_INVOICE_HASH } from "@/lib/saudi-vat/invoice-hash";
import { generateTLVQRCode } from "@/lib/saudi-vat/qr-code";

// ─── Simple Test Harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Expected: ${JSON.stringify(expected)}`);
    console.error(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ──`);
}

// ─── Constants ─────────────────────────────────────────────────────────────

section("Constants");
assertEq(SAUDI_VAT_RATE, 15, "Default VAT rate is 15%");
assert(GENESIS_INVOICE_HASH.length === 64, "Genesis hash is 64 chars");
assert(/^0+$/.test(GENESIS_INVOICE_HASH), "Genesis hash is all zeros");

// ─── TRN Validation ────────────────────────────────────────────────────────

section("TRN Validation");
assert(validateTRN("300000000000003"), "Valid TRN starting with 3, 15 digits");
assert(validateTRN("312345678901234"), "Valid TRN - another example");
assert(!validateTRN("200000000000003"), "Reject TRN not starting with 3");
assert(!validateTRN("30000000000000"),  "Reject TRN with 14 digits");
assert(!validateTRN("3000000000000031"), "Reject TRN with 16 digits");
assert(!validateTRN("3000000000000X5"), "Reject TRN with non-digit char");
assert(!validateTRN(""),                "Reject empty TRN");

// ─── Line VAT Calculation ──────────────────────────────────────────────────

section("Line VAT Calculation - Standard Rate (15%)");
{
  const result = calculateLineVAT({ taxableAmount: 1000, vatRate: 15 });
  assertEq(result.vatRate, 15, "vatRate is 15");
  assertEq(result.vatAmount, 150, "vatAmount = 1000 * 15% = 150");
  assertEq(result.totalWithVat, 1150, "totalWithVat = 1000 + 150 = 1150");
  assertEq(result.vatCategory, "S", "category defaults to S for 15%");
}

section("Line VAT Calculation - Zero Rate (0%)");
{
  const result = calculateLineVAT({ taxableAmount: 500, vatRate: 0 });
  assertEq(result.vatRate, 0, "vatRate is 0");
  assertEq(result.vatAmount, 0, "vatAmount = 0 for zero-rated");
  assertEq(result.totalWithVat, 500, "totalWithVat = taxableAmount for zero-rated");
  assertEq(result.vatCategory, "Z", "category defaults to Z for 0%");
}

section("Line VAT Calculation - Exempt");
{
  const result = calculateLineVAT({ taxableAmount: 200, vatRate: 15, vatCategory: "E" as VATCategory });
  assertEq(result.vatAmount, 0, "vatAmount = 0 for exempt");
  assertEq(result.vatCategory, "E", "category is E");
  assertEq(result.totalWithVat, 200, "totalWithVat = taxableAmount for exempt");
}

section("Line VAT Calculation - Rounding");
{
  // 333.33 * 15% = 49.9995 → rounds to 50.00
  const result = calculateLineVAT({ taxableAmount: 333.33, vatRate: 15 });
  assert(result.vatAmount === 50.00, `VAT rounds correctly: ${result.vatAmount}`);
  assertEq(result.totalWithVat, 383.33, "totalWithVat rounds correctly");
}

section("Line VAT Calculation - Zero taxable amount");
{
  const result = calculateLineVAT({ taxableAmount: 0, vatRate: 15 });
  assertEq(result.vatAmount, 0, "Zero taxable → zero VAT");
  assertEq(result.totalWithVat, 0, "Zero taxable → zero total");
}

// ─── Document VAT Calculation ──────────────────────────────────────────────

section("Document VAT Calculation");
{
  const lines = [
    calculateLineVAT({ taxableAmount: 1000, vatRate: 15 }),
    calculateLineVAT({ taxableAmount: 500, vatRate: 15 }),
    calculateLineVAT({ taxableAmount: 200, vatRate: 0 }),
  ];
  const doc = calculateDocumentVAT(lines);
  assertEq(doc.totalVat, 225, "totalVat = 150 + 75 + 0 = 225");
  assertEq(doc.totalExclVat, 1700, "totalExclVat = 1000 + 500 + 200 = 1700");
  assertEq(doc.totalInclVat, 1925, "totalInclVat = 1700 + 225 = 1925");
}

{
  const lines = [calculateLineVAT({ taxableAmount: 100, vatRate: 15 })];
  const doc = calculateDocumentVAT(lines);
  assertEq(doc.totalVat, 15, "Single line: 100 * 15% = 15 VAT");
  assertEq(doc.totalExclVat, 100, "Single line: excl = 100");
  assertEq(doc.totalInclVat, 115, "Single line: incl = 115");
}

// ─── Invoice Type Determination ────────────────────────────────────────────

section("Invoice Type Determination");
assertEq(
  determineSaudiInvoiceType("300000000000003"),
  "STANDARD",
  "Valid buyer TRN → STANDARD invoice (B2B)"
);
assertEq(
  determineSaudiInvoiceType(null),
  "SIMPLIFIED",
  "Null buyer VAT → SIMPLIFIED invoice (B2C)"
);
assertEq(
  determineSaudiInvoiceType(undefined),
  "SIMPLIFIED",
  "Undefined buyer VAT → SIMPLIFIED"
);
assertEq(
  determineSaudiInvoiceType(""),
  "SIMPLIFIED",
  "Empty buyer VAT → SIMPLIFIED"
);
assertEq(
  determineSaudiInvoiceType("200000000000003"),
  "SIMPLIFIED",
  "Invalid buyer TRN (not starting with 3) → SIMPLIFIED"
);

// ─── Invoice Hash ──────────────────────────────────────────────────────────

section("Invoice Hash (SHA-256 chain)");
{
  const hash1 = computeInvoiceHash({
    invoiceNumber: "INV-001",
    issueDate: "2024-01-01T10:00:00.000Z",
    sellerVatNumber: "300000000000003",
    totalInclVat: "1150.00",
    totalVat: "150.00",
  });
  assert(hash1.length === 64, `Hash is 64 hex chars: ${hash1.length}`);
  assert(/^[0-9a-f]{64}$/.test(hash1), "Hash is lowercase hex");

  // Same input → same hash (deterministic)
  const hash1b = computeInvoiceHash({
    invoiceNumber: "INV-001",
    issueDate: "2024-01-01T10:00:00.000Z",
    sellerVatNumber: "300000000000003",
    totalInclVat: "1150.00",
    totalVat: "150.00",
  });
  assertEq(hash1, hash1b, "Hash is deterministic for same input");

  // Different input → different hash
  const hash2 = computeInvoiceHash({
    invoiceNumber: "INV-002",
    issueDate: "2024-01-02T10:00:00.000Z",
    sellerVatNumber: "300000000000003",
    totalInclVat: "2300.00",
    totalVat: "300.00",
  });
  assert(hash1 !== hash2, "Different inputs produce different hashes");
}

// ─── UUID Generation ───────────────────────────────────────────────────────

section("Invoice UUID");
{
  const uuid1 = generateInvoiceUUID();
  const uuid2 = generateInvoiceUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(uuid1), `Valid UUID v4: ${uuid1}`);
  assert(uuid1 !== uuid2, "Each call generates a unique UUID");
}

// ─── TLV QR Code ───────────────────────────────────────────────────────────

section("TLV QR Code Generation");
{
  const tlv = generateTLVQRCode({
    sellerName: "Test Seller شركة اختبار",
    vatNumber: "300000000000003",
    timestamp: "2024-01-01T10:00:00Z",
    totalWithVat: "1150.00",
    totalVat: "150.00",
  });

  // Must be a non-empty Base64 string
  assert(tlv.length > 0, "TLV is non-empty");
  assert(/^[A-Za-z0-9+/]+=*$/.test(tlv), "TLV is valid Base64");

  // Decode and verify structure
  const decoded = Buffer.from(tlv, "base64");
  let offset = 0;

  const tags: Array<{ tag: number; value: string }> = [];
  while (offset < decoded.length) {
    const tag = decoded[offset++];
    const len = decoded[offset++];
    const value = decoded.slice(offset, offset + len).toString("utf8");
    offset += len;
    tags.push({ tag, value });
  }

  assertEq(tags.length, 5, "QR code has exactly 5 TLV tags");
  assertEq(tags[0].tag, 1, "Tag 1 = seller name");
  assert(tags[0].value.includes("Test Seller"), "Tag 1 value contains seller name");
  assertEq(tags[1].tag, 2, "Tag 2 = VAT number");
  assertEq(tags[1].value, "300000000000003", "Tag 2 value is correct TRN");
  assertEq(tags[2].tag, 3, "Tag 3 = timestamp");
  assert(tags[2].value.startsWith("2024-01-01"), "Tag 3 value is timestamp");
  assertEq(tags[3].tag, 4, "Tag 4 = total incl. VAT");
  assertEq(tags[3].value, "1150.00", "Tag 4 value is total with VAT");
  assertEq(tags[4].tag, 5, "Tag 5 = total VAT");
  assertEq(tags[4].value, "150.00", "Tag 5 value is VAT amount");
}

// ─── Integration: Full Invoice VAT Calculation ─────────────────────────────

section("Integration: Multi-line invoice VAT");
{
  // Simulate creating an invoice with 3 items
  const items = [
    { quantity: 2, unitPrice: 500, discount: 0, vatRate: 15 },    // taxable: 1000
    { quantity: 1, unitPrice: 300, discount: 10, vatRate: 15 },   // taxable: 270 (10% disc)
    { quantity: 5, unitPrice: 100, discount: 0, vatRate: 0 },     // taxable: 500, zero-rated
  ];

  const lineResults = items.map(item => {
    const taxableAmount = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return calculateLineVAT({ taxableAmount, vatRate: item.vatRate });
  });

  const doc = calculateDocumentVAT(lineResults);

  assertEq(lineResults[0].vatAmount, 150, "Line 1: 1000 * 15% = 150 VAT");
  assertEq(lineResults[1].vatAmount, 40.5, "Line 2: 270 * 15% = 40.50 VAT");
  assertEq(lineResults[2].vatAmount, 0, "Line 3: zero-rated = 0 VAT");
  assertEq(doc.totalVat, 190.5, "Total VAT = 150 + 40.50 = 190.50");
  assertEq(doc.totalExclVat, 1770, "Total excl VAT = 1000 + 270 + 500 = 1770");
  assertEq(doc.totalInclVat, 1960.5, "Total incl VAT = 1770 + 190.50 = 1960.50");

  // Generate QR for this invoice
  const tlv = generateTLVQRCode({
    sellerName: "شركة الاختبار",
    vatNumber: "300000000000003",
    timestamp: new Date().toISOString(),
    totalWithVat: doc.totalInclVat.toFixed(2),
    totalVat: doc.totalVat.toFixed(2),
  });
  assert(tlv.length > 0, "QR code generated for multi-line invoice");

  // Generate hash chain
  const hash = computeInvoiceHash({
    invoiceNumber: "INV-20240101-001",
    issueDate: new Date().toISOString(),
    sellerVatNumber: "300000000000003",
    totalInclVat: doc.totalInclVat.toFixed(2),
    totalVat: doc.totalVat.toFixed(2),
  });
  assert(hash.length === 64, "Invoice hash generated for integrated invoice");
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\nAll tests passed!`);
  process.exit(0);
}
