// Saudi ZATCA Phase 1 QR Code - TLV encoding
// Each field: Tag (1 byte) + Length (1 byte) + Value (UTF-8 bytes)
// Result is Base64-encoded for storage and QR code generation

export interface QRCodeInput {
  sellerName: string;        // Tag 1: Seller name (Arabic preferred)
  vatNumber: string;         // Tag 2: Seller VAT registration number (TRN)
  timestamp: string;         // Tag 3: Invoice date/time ISO 8601 (e.g. "2024-01-15T14:30:00Z")
  totalWithVat: string;      // Tag 4: Invoice total (including VAT), 2 decimal places
  totalVat: string;          // Tag 5: Total VAT amount, 2 decimal places
}

function encodeTLV(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

export function generateTLVQRCode(data: QRCodeInput): string {
  const tag1 = encodeTLV(1, data.sellerName);
  const tag2 = encodeTLV(2, data.vatNumber);
  const tag3 = encodeTLV(3, data.timestamp);
  const tag4 = encodeTLV(4, data.totalWithVat);
  const tag5 = encodeTLV(5, data.totalVat);

  const totalLength = tag1.length + tag2.length + tag3.length + tag4.length + tag5.length;
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of [tag1, tag2, tag3, tag4, tag5]) {
    combined.set(part, offset);
    offset += part.length;
  }

  return Buffer.from(combined).toString("base64");
}

// Generate QR code as data URL (SVG-based) for embedding in PDFs
// Requires 'qrcode' npm package
export async function generateQRCodeDataURL(tlvBase64: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(tlvBase64, {
    errorCorrectionLevel: "M",
    type: "image/png",
    width: 150,
    margin: 1,
  });
}

// Generate QR code as SVG string
export async function generateQRCodeSVG(tlvBase64: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toString(tlvBase64, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 150,
    margin: 1,
  });
}

// ─── ZATCA Phase 2: Enhanced 9-Tag QR Code ────────────────────────────────

export interface EnhancedQRCodeInput extends QRCodeInput {
  invoiceHash: Buffer;          // Tag 6: SHA-256 raw bytes (32 bytes)
  ecdsaSignature: Buffer;       // Tag 7: IEEE P1363 r||s (64 bytes)
  publicKey: Buffer;            // Tag 8: DER SubjectPublicKeyInfo (~88 bytes)
  certificateSignature: Buffer; // Tag 9: IEEE P1363 of CA signature (64 bytes)
}

function encodeTLVBinary(tag: number, value: Buffer): Uint8Array {
  // Support lengths > 127 bytes using multi-byte length encoding
  const lenBytes = encodeTLVLength(value.length);
  const tlv = new Uint8Array(1 + lenBytes.length + value.length);
  tlv[0] = tag;
  tlv.set(lenBytes, 1);
  tlv.set(value, 1 + lenBytes.length);
  return tlv;
}

function encodeTLVLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length]);
  }
  // Multi-byte: 0x81 for 1 extra byte, 0x82 for 2 extra bytes
  if (length < 256) {
    return new Uint8Array([0x81, length]);
  }
  return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
}

export function generateEnhancedTLVQRCode(data: EnhancedQRCodeInput): string {
  const tag1 = encodeTLV(1, data.sellerName);
  const tag2 = encodeTLV(2, data.vatNumber);
  const tag3 = encodeTLV(3, data.timestamp);
  const tag4 = encodeTLV(4, data.totalWithVat);
  const tag5 = encodeTLV(5, data.totalVat);
  const tag6 = encodeTLVBinary(6, data.invoiceHash);
  const tag7 = encodeTLVBinary(7, data.ecdsaSignature);
  const tag8 = encodeTLVBinary(8, data.publicKey);
  const tag9 = encodeTLVBinary(9, data.certificateSignature);

  const parts = [tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9];
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  return Buffer.from(combined).toString("base64");
}
