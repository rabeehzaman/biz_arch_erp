// ZATCA Phase 2 XML signing — 8-step XAdES-BES flow
// ECDSA-SHA256 on secp256k1, C14N via xmldsigjs (pure JS, Vercel-compatible)

import crypto from "crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { Crypto } from "@peculiar/webcrypto";
import { XmlCanonicalizer } from "xmldsigjs";
import { ZATCA_NAMESPACES, ZATCA_ALGORITHMS } from "./zatca-config";
import {
  importPrivateKey,
  parseCertificate,
  getCertificateHash,
  getCertificateIssuerName,
  getCertificateSerialNumber,
  extractPublicKeyDER,
  extractCertificateSignature,
} from "./certificate";

const peculiarCrypto = new Crypto();

// ─── Types ────────────────────────────────────────────────────────────────

export interface SigningResult {
  signedXml: string;
  invoiceHash: string;              // base64 SHA-256 (44-char string)
  invoiceHashBytes: Buffer;         // raw 32-byte SHA-256
  signatureValueBase64: string;     // ds:SignatureValue Base64 text (same sig used for QR tag 7)
  signatureBytes: Buffer;           // 64-byte P1363 signature
  publicKeyDER: Buffer;             // SubjectPublicKeyInfo raw DER (88 bytes)
  certSignatureDER: Buffer;         // CA cert signature raw DER (~72 bytes)
  certSignatureBytes: Buffer;       // alias for certSignatureDER
}

// ─── Main Signing Function ────────────────────────────────────────────────

export async function signInvoiceXML(
  invoiceXml: string,
  privateKeyPem: string,
  certificateBase64: string
): Promise<SigningResult> {
  const cert = parseCertificate(certificateBase64);

  // Step 2: Compute invoice hash using C14N (pure JS)
  const canonicalXml = stripForHashing(invoiceXml);
  const invoiceHashBytes = crypto.createHash("sha256").update(canonicalXml, "utf-8").digest();
  const invoiceHash = invoiceHashBytes.toString("base64");

  // Step 3: Build SignedProperties
  const signingTime = new Date().toISOString();
  const certHash = getCertificateHash(cert);
  const certIssuer = getCertificateIssuerName(cert);
  const certSerialHex = getCertificateSerialNumber(cert);
  const certSerial = BigInt("0x" + certSerialHex).toString(10);

  // Step 4: Compute SignedProperties digest
  // ZATCA SDK hashes a specific "for signing" format with xmlns declarations and
  // multi-line indentation. The embedded version in the final XML can differ.
  const certDigestBase64 = Buffer.from(certHash.toString("hex"), "utf-8").toString("base64");
  const signedPropertiesForHashing = buildSignedPropertiesForHashing(
    signingTime, certDigestBase64, certIssuer, certSerial
  );
  const signedPropertiesXml = buildSignedPropertiesXml(
    signingTime, certDigestBase64, certIssuer, certSerial
  );
  // ZATCA SDK encodes digests as base64(hex_of_sha256), not base64(raw_sha256)
  const signedPropsHash = sha256HexBase64(signedPropertiesForHashing);

  // Step 5: Assemble SignedInfo
  const signedInfoXml = buildSignedInfoXml(invoiceHash, signedPropsHash);

  // Step 6: Sign the raw invoice hash bytes, matching the official ZATCA SDK.
  // SDK uses createSign('sha256').update(Buffer.from(hash, "base64")).sign(key)
  // which is equivalent to ECDSA(SHA-256(raw_32_hash_bytes)).
  // WebCrypto subtle.sign with {hash: "SHA-256"} also does SHA-256 internally,
  // so we pass the raw hash bytes as input.
  const privateKey = await importPrivateKey(privateKeyPem);
  const signatureArrayBuffer = await peculiarCrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    invoiceHashBytes
  );
  const signatureP1363 = Buffer.from(signatureArrayBuffer);
  const signatureDER = p1363ToDerLocal(signatureP1363);
  const signatureValueBase64 = signatureDER.toString("base64");

  // Step 7: QR data extraction
  const publicKeyDER = extractPublicKeyDER(cert);
  const certSignatureDER = extractCertificateSignature(cert);

  // Step 8: Embed signature into XML using string replacement
  const signedXml = embedSignatureString(
    invoiceXml,
    signedInfoXml,
    signatureValueBase64,
    signedPropertiesXml,
    certificateBase64
  );

  return {
    signedXml,
    invoiceHash,
    invoiceHashBytes,
    signatureValueBase64,
    signatureBytes: signatureP1363,
    publicKeyDER,
    certSignatureDER,
    certSignatureBytes: certSignatureDER,
  };
}

// ─── Step 2: Invoice Hash — C14N via xmldsigjs (pure JS) ────────────────

/**
 * Remove UBLExtensions, cac:Signature, and QR AdditionalDocumentReference,
 * then canonicalize using xmldsigjs.XmlCanonicalizer (pure JS, Vercel-compatible).
 * Applies ZATCA whitespace patches for hash compatibility.
 */
function stripForHashing(xmlStr: string): string {
  // Step 1: DOM-based removal of 3 elements
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  const root = doc.documentElement;

  // Remove ext:UBLExtensions
  const ublExts = root.getElementsByTagNameNS(ZATCA_NAMESPACES.EXT, "UBLExtensions");
  for (let i = ublExts.length - 1; i >= 0; i--) {
    ublExts.item(i)?.parentNode?.removeChild(ublExts.item(i)!);
  }

  // Remove cac:Signature
  const cacSigs = root.getElementsByTagNameNS(ZATCA_NAMESPACES.CAC, "Signature");
  for (let i = cacSigs.length - 1; i >= 0; i--) {
    cacSigs.item(i)?.parentNode?.removeChild(cacSigs.item(i)!);
  }

  // Remove cac:AdditionalDocumentReference[QR]
  const addDocRefs = root.getElementsByTagNameNS(ZATCA_NAMESPACES.CAC, "AdditionalDocumentReference");
  for (let i = addDocRefs.length - 1; i >= 0; i--) {
    const ref = addDocRefs.item(i);
    if (!ref) continue;
    const ids = ref.getElementsByTagNameNS(ZATCA_NAMESPACES.CBC, "ID");
    if (ids.length > 0 && ids.item(0)?.textContent?.trim() === "QR") {
      ref.parentNode?.removeChild(ref);
    }
  }

  // Step 2: Canonicalize with xmldsigjs (pure JS, Vercel-compatible)
  const canonicalizer = new XmlCanonicalizer(false, false);
  return canonicalizer.Canonicalize(doc);
}

/**
 * Canonicalize ds:SignedInfo XML using C14N 1.1 (via xmldsigjs).
 * Per ZATCA spec, the ECDSA signature is over this canonical form.
 */
function canonicalizeSignedInfo(signedInfoXml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(signedInfoXml, "application/xml");
  const canonicalizer = new XmlCanonicalizer(false, false);
  return canonicalizer.Canonicalize(doc);
}

/**
 * Recompute the invoice hash from any XML (e.g., the final submitted XML).
 * Strips elements and canonicalizes, then hashes.
 */
export function recomputeHash(xml: string): string {
  const canonical = stripForHashing(xml);
  return crypto.createHash("sha256").update(canonical, "utf-8").digest("base64");
}

// ─── Step 3 & 4: SignedProperties ─────────────────────────────────────────

/**
 * SignedProperties XML for hashing — must include xmlns declarations and
 * specific indentation to match the official ZATCA SDK's expected format.
 * The SDK hashes this exact format to compute xadesSignedPropertiesDigestValue.
 */
function buildSignedPropertiesForHashing(
  signingTime: string,
  certDigestBase64: string,
  issuerName: string,
  serialNumber: string
): string {
  const S = " ";
  return [
    `<xades:SignedProperties xmlns:xades="${ZATCA_NAMESPACES.XADES}" Id="xadesSignedProperties">`,
    `${S.repeat(36)}<xades:SignedSignatureProperties>`,
    `${S.repeat(40)}<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `${S.repeat(40)}<xades:SigningCertificate>`,
    `${S.repeat(44)}<xades:Cert>`,
    `${S.repeat(48)}<xades:CertDigest>`,
    `${S.repeat(52)}<ds:DigestMethod xmlns:ds="${ZATCA_NAMESPACES.DS}" Algorithm="${ZATCA_ALGORITHMS.DIGEST}"/>`,
    `${S.repeat(52)}<ds:DigestValue xmlns:ds="${ZATCA_NAMESPACES.DS}">${certDigestBase64}</ds:DigestValue>`,
    `${S.repeat(48)}</xades:CertDigest>`,
    `${S.repeat(48)}<xades:IssuerSerial>`,
    `${S.repeat(52)}<ds:X509IssuerName xmlns:ds="${ZATCA_NAMESPACES.DS}">${escapeXml(issuerName)}</ds:X509IssuerName>`,
    `${S.repeat(52)}<ds:X509SerialNumber xmlns:ds="${ZATCA_NAMESPACES.DS}">${serialNumber}</ds:X509SerialNumber>`,
    `${S.repeat(48)}</xades:IssuerSerial>`,
    `${S.repeat(44)}</xades:Cert>`,
    `${S.repeat(40)}</xades:SigningCertificate>`,
    `${S.repeat(36)}</xades:SignedSignatureProperties>`,
    `${S.repeat(32)}</xades:SignedProperties>`,
  ].join("\n");
}

/**
 * SignedProperties XML for embedding — same indentation as the "for hashing" version,
 * but without xmlns declarations (they're inherited from parent elements).
 * The SDK validator extracts this, re-adds xmlns, and hashes — so the indentation
 * must match the "for hashing" format exactly.
 */
function buildSignedPropertiesXml(
  signingTime: string,
  certDigestBase64: string,
  issuerName: string,
  serialNumber: string
): string {
  const S = " ";
  return [
    `<xades:SignedProperties Id="xadesSignedProperties">`,
    `${S.repeat(36)}<xades:SignedSignatureProperties>`,
    `${S.repeat(40)}<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `${S.repeat(40)}<xades:SigningCertificate>`,
    `${S.repeat(44)}<xades:Cert>`,
    `${S.repeat(48)}<xades:CertDigest>`,
    `${S.repeat(52)}<ds:DigestMethod Algorithm="${ZATCA_ALGORITHMS.DIGEST}"/>`,
    `${S.repeat(52)}<ds:DigestValue>${certDigestBase64}</ds:DigestValue>`,
    `${S.repeat(48)}</xades:CertDigest>`,
    `${S.repeat(48)}<xades:IssuerSerial>`,
    `${S.repeat(52)}<ds:X509IssuerName>${escapeXml(issuerName)}</ds:X509IssuerName>`,
    `${S.repeat(52)}<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>`,
    `${S.repeat(48)}</xades:IssuerSerial>`,
    `${S.repeat(44)}</xades:Cert>`,
    `${S.repeat(40)}</xades:SigningCertificate>`,
    `${S.repeat(36)}</xades:SignedSignatureProperties>`,
    `${S.repeat(32)}</xades:SignedProperties>`,
  ].join("\n");
}

// ─── Step 5: SignedInfo ───────────────────────────────────────────────────

function buildSignedInfoXml(
  invoiceDigest: string,
  signedPropsDigest: string
): string {
  return [
    `<ds:SignedInfo>`,
    `<ds:CanonicalizationMethod Algorithm="${ZATCA_ALGORITHMS.CANONICALIZATION}"/>`,
    `<ds:SignatureMethod Algorithm="${ZATCA_ALGORITHMS.SIGNATURE}"/>`,
    `<ds:Reference Id="invoiceSignedData" URI="">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">`,
    `<ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>`,
    `</ds:Transform>`,
    `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">`,
    `<ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>`,
    `</ds:Transform>`,
    `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">`,
    `<ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>`,
    `</ds:Transform>`,
    `<ds:Transform Algorithm="${ZATCA_ALGORITHMS.CANONICALIZATION}"/>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${ZATCA_ALGORITHMS.DIGEST}"/>`,
    `<ds:DigestValue>${invoiceDigest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `<ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">`,
    `<ds:DigestMethod Algorithm="${ZATCA_ALGORITHMS.DIGEST}"/>`,
    `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join("");
}

// ─── Step 8: Embed Signature using string replacement ────────────────────

function embedSignatureString(
  invoiceXml: string,
  signedInfoXml: string,
  signatureBase64: string,
  signedPropertiesXml: string,
  certBase64: string
): string {
  const dsSignature = [
    `<ds:Signature xmlns:ds="${ZATCA_NAMESPACES.DS}" Id="signature">`,
    signedInfoXml,
    `<ds:SignatureValue>${signatureBase64}</ds:SignatureValue>`,
    `<ds:KeyInfo>`,
    `<ds:X509Data>`,
    `<ds:X509Certificate>${certBase64}</ds:X509Certificate>`,
    `</ds:X509Data>`,
    `</ds:KeyInfo>`,
    `<ds:Object>`,
    `<xades:QualifyingProperties xmlns:xades="${ZATCA_NAMESPACES.XADES}" Target="signature">`,
    signedPropertiesXml,
    `</xades:QualifyingProperties>`,
    `</ds:Object>`,
    `</ds:Signature>`,
  ].join("");

  return invoiceXml.replace(
    "</sac:SignatureInformation>",
    dsSignature + "</sac:SignatureInformation>"
  );
}

// ─── QR Embedding ────────────────────────────────────────────────────────

export function embedQRInXml(signedXml: string, qrBase64: string): string {
  // Handle both self-closing and empty element (compact vs indented XML)
  const selfClosing = signedXml.replace(
    /<cbc:EmbeddedDocumentBinaryObject\s+mimeCode="text\/plain"\/>/,
    `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrBase64}</cbc:EmbeddedDocumentBinaryObject>`
  );
  if (selfClosing !== signedXml) return selfClosing;
  // Fallback: empty element with open/close tags
  return signedXml.replace(
    /(<cbc:EmbeddedDocumentBinaryObject\s+mimeCode="text\/plain">)\s*(<\/cbc:EmbeddedDocumentBinaryObject>)/,
    `$1${qrBase64}$2`
  );
}

// ─── QR Data Extraction from Signed XML ──────────────────────────────────

/**
 * Extract QR tag values from the signed XML per ZATCA spec (page 61).
 * Tags 6-7 are read from ds:SignedInfo/ds:DigestValue and ds:SignatureValue.
 * This ensures QR content exactly matches the signed XML.
 */
export function extractQRDataFromSignedXml(signedXml: string): {
  digestValue: string;         // Tag 6: ds:DigestValue (invoice hash Base64)
  signatureValue: string;      // Tag 7: ds:SignatureValue (ECDSA signature Base64)
} {
  // Extract ds:DigestValue from the first Reference (invoiceSignedData)
  const digestMatch = signedXml.match(
    /Id="invoiceSignedData"[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/
  );
  const digestValue = digestMatch?.[1] || "";

  // Extract ds:SignatureValue
  const sigMatch = signedXml.match(
    /<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/
  );
  const signatureValue = sigMatch?.[1] || "";

  return { digestValue, signatureValue };
}

// ─── Utilities ────────────────────────────────────────────────────────────

function sha256Base64(data: string): string {
  return crypto.createHash("sha256").update(data, "utf-8").digest("base64");
}

/** SHA-256 → hex string → Base64 encode (ZATCA SDK format for SignedProperties/cert digests) */
function sha256HexBase64(data: string): string {
  const hex = crypto.createHash("sha256").update(data, "utf-8").digest("hex");
  return Buffer.from(hex, "utf-8").toString("base64");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function p1363ToDerLocal(p1363: Buffer): Buffer {
  const r = p1363.subarray(0, 32);
  const s = p1363.subarray(32, 64);
  const rDer = toSignedDerInt(r);
  const sDer = toSignedDerInt(s);
  const totalLen = 2 + rDer.length + 2 + sDer.length;
  return Buffer.concat([
    Buffer.from([0x30, totalLen]),
    Buffer.from([0x02, rDer.length]),
    rDer,
    Buffer.from([0x02, sDer.length]),
    sDer,
  ]);
}

function toSignedDerInt(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0x00) i++;
  const trimmed = buf.subarray(i);
  if (trimmed[0] & 0x80) {
    return Buffer.concat([Buffer.from([0x00]), trimmed]);
  }
  return trimmed;
}
