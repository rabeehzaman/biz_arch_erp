// ZATCA Phase 2 certificate management
// Key generation, CSR creation, private key encryption/decryption, cert parsing

import "reflect-metadata";
import crypto from "crypto";
import { Crypto } from "@peculiar/webcrypto";
import * as x509 from "@peculiar/x509";
import { getEncryptionKey } from "./zatca-config";

const peculiarCrypto = new Crypto();
x509.cryptoProvider.set(peculiarCrypto);

const ECDSA_ALG = { name: "ECDSA", namedCurve: "K-256", hash: "SHA-256" } as const;

// ─── Key Pair Generation ──────────────────────────────────────────────────

export interface ZatcaKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  privateKeyPem: string;
  publicKeyPem: string;
}

export async function generateKeyPair(): Promise<ZatcaKeyPair> {
  const keys = await peculiarCrypto.subtle.generateKey(
    ECDSA_ALG,
    true, // extractable
    ["sign", "verify"]
  );

  const privateKeyDer = await peculiarCrypto.subtle.exportKey("pkcs8", keys.privateKey);
  const publicKeyDer = await peculiarCrypto.subtle.exportKey("spki", keys.publicKey);

  const privateKeyPem = derToPem(privateKeyDer, "PRIVATE KEY");
  const publicKeyPem = derToPem(publicKeyDer, "PUBLIC KEY");

  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    privateKeyPem,
    publicKeyPem,
  };
}

// ─── CSR Generation ───────────────────────────────────────────────────────

export interface CSRParams {
  organizationName: string;      // O field
  organizationUnit: string;      // OU field (branch name)
  commonName: string;            // CN field (EGS device identifier)
  vatNumber: string;             // 2.5.4.97 custom OID
  serialNumber: string;          // SAN SN: "1-AppName|2-Version|3-Serial"
  title: string;                 // SAN title: invoice type flags e.g. "1100"
  registeredAddress: string;     // SAN registeredAddress
  businessCategory: string;      // SAN businessCategory
  isProduction: boolean;         // determines certificate template name
  environment?: "SANDBOX" | "SIMULATION" | "PRODUCTION"; // override template name per environment
}

/**
 * Generates a CSR for ZATCA onboarding using pkijs (pure JS, Vercel-compatible).
 * No OpenSSL CLI dependency — builds exact ASN.1 DER via pkijs/asn1js.
 */
export async function generateCSR(
  params: CSRParams,
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<string> {
  const pkijs = await import("pkijs");
  const asn1js = await import("asn1js");

  // Register our WebCrypto engine with pkijs
  const pkijsCrypto = new Crypto();
  pkijs.setEngine("peculiar", pkijsCrypto as unknown as globalThis.Crypto, pkijsCrypto.subtle as unknown as SubtleCrypto);

  // Template name per environment
  const env = params.environment || (params.isProduction ? "PRODUCTION" : "SIMULATION");
  const templateName = env === "PRODUCTION"
    ? "ZATCA-Code-Signing"
    : env === "SANDBOX"
      ? "TSTZATCA-Code-Signing"
      : "PREZATCA-Code-Signing";

  // 1. Build Subject DN: C=SA, OU, O, CN — each in its own RDN (SET)
  const csr = new pkijs.CertificationRequest();
  csr.version = 0;

  // pkijs stores each RDN separately in typesAndValues, BUT serializes them
  // all into one SET. To get separate SETs (standard X.509 DN encoding),
  // we override toSchema() by building the raw ASN.1 SEQUENCE of SETs.
  const subjectSets = [
    { oid: "2.5.4.6",  value: new asn1js.PrintableString({ value: "SA" }) },
    { oid: "2.5.4.11", value: new asn1js.Utf8String({ value: params.organizationUnit }) },
    { oid: "2.5.4.10", value: new asn1js.Utf8String({ value: params.organizationName }) },
    { oid: "2.5.4.3",  value: new asn1js.Utf8String({ value: params.commonName }) },
  ];

  // Build raw DER: SEQUENCE { SET { SEQUENCE { OID, value } }, SET { ... }, ... }
  const rdnSeqDer = new asn1js.Sequence({
    value: subjectSets.map((attr) =>
      new asn1js.Set({
        value: [
          new asn1js.Sequence({
            value: [
              new asn1js.ObjectIdentifier({ value: attr.oid }),
              attr.value,
            ],
          }),
        ],
      })
    ),
  }).toBER(false);

  // Parse back — pkijs.RelativeDistinguishedNames.fromBER understands separate SETs
  const rdnAsn1 = asn1js.fromBER(rdnSeqDer);
  csr.subject = new pkijs.RelativeDistinguishedNames({ schema: rdnAsn1.result });

  // 2. Set public key — export SPKI DER from WebCrypto and parse into pkijs
  // (pkijs.importKey() doesn't handle secp256k1 correctly — truncates the key)
  const spkiDer = await pkijsCrypto.subtle.exportKey("spki", publicKey);
  const spkiAsn1 = asn1js.fromBER(spkiDer);
  csr.subjectPublicKeyInfo = new pkijs.PublicKeyInfo({ schema: spkiAsn1.result });

  // 3. Build extensions

  // Extension 1: certificateTemplateName (OID 1.3.6.1.4.1.311.20.2)
  // Value is a bare PrintableString (not wrapped in SEQUENCE)
  const templateStr = new asn1js.PrintableString({ value: templateName });
  const certTemplateExt = new pkijs.Extension({
    extnID: "1.3.6.1.4.1.311.20.2",
    critical: false,
    extnValue: new asn1js.OctetString({ valueHex: templateStr.toBER(false) }).valueBlock.valueHexView.buffer as ArrayBuffer,
  });

  // Extension 2: subjectAltName (OID 2.5.29.17) with DirectoryName
  // Build the 5 SAN attributes as a DirectoryName
  const sanDirAttrs = [
    { oid: "2.5.4.4", value: params.serialNumber },         // SN (surname — matches OpenSSL's SN mapping)
    { oid: "0.9.2342.19200300.100.1.1", value: params.vatNumber }, // UID
    { oid: "2.5.4.12", value: params.title },                // title
    { oid: "2.5.4.26", value: params.registeredAddress },    // registeredAddress
    { oid: "2.5.4.15", value: params.businessCategory },     // businessCategory
  ];

  // Build DirectoryName with each attribute in its own SET (same fix as Subject DN)
  const dirNameSeqDer = new asn1js.Sequence({
    value: sanDirAttrs.map((attr) =>
      new asn1js.Set({
        value: [
          new asn1js.Sequence({
            value: [
              new asn1js.ObjectIdentifier({ value: attr.oid }),
              new asn1js.Utf8String({ value: attr.value }),
            ],
          }),
        ],
      })
    ),
  }).toBER(false);
  const dirNameAsn1 = asn1js.fromBER(dirNameSeqDer);
  const dirName = new pkijs.RelativeDistinguishedNames({ schema: dirNameAsn1.result });

  // GeneralName type 4 = directoryName
  const generalName = new pkijs.GeneralName({
    type: 4,
    value: dirName,
  });

  const sanNames = new pkijs.GeneralNames({ names: [generalName] });
  const sanExt = new pkijs.Extension({
    extnID: "2.5.29.17",
    critical: false,
    extnValue: sanNames.toSchema().toBER(false),
  });

  // 4. Wrap extensions in extensionRequest attribute (OID 1.2.840.113549.1.9.14)
  const extensions = new pkijs.Extensions({
    extensions: [certTemplateExt, sanExt],
  });

  csr.attributes = [
    new pkijs.Attribute({
      type: "1.2.840.113549.1.9.14", // extensionRequest
      values: [extensions.toSchema()],
    }),
  ];

  // 5. Sign the CSR with ECDSA-SHA256
  await csr.sign(privateKey, "SHA-256");

  // 6. Export to PEM, then double-base64 encode (ZATCA format)
  const csrDer = csr.toSchema(true).toBER(false);
  const csrBase64Lines = Buffer.from(csrDer).toString("base64").match(/.{1,64}/g)!.join("\n");
  const csrPem = `-----BEGIN CERTIFICATE REQUEST-----\n${csrBase64Lines}\n-----END CERTIFICATE REQUEST-----\n`;

  return Buffer.from(csrPem).toString("base64");
}

// ─── Private Key Encryption (AES-256-GCM) ─────────────────────────────────

export interface EncryptedKey {
  encrypted: string; // base64
  iv: string;        // hex
  tag: string;       // hex
}

export function encryptPrivateKey(privateKeyPem: string): EncryptedKey {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(privateKeyPem, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decryptPrivateKey(encData: EncryptedKey): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encData.iv, "hex");
  const tag = Buffer.from(encData.tag, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encData.encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── Import Private Key from PEM ──────────────────────────────────────────

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem, "PRIVATE KEY");
  return peculiarCrypto.subtle.importKey(
    "pkcs8",
    der,
    ECDSA_ALG,
    true,
    ["sign"]
  );
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem, "PUBLIC KEY");
  return peculiarCrypto.subtle.importKey(
    "spki",
    der,
    ECDSA_ALG,
    true,
    ["verify"]
  );
}

// ─── Certificate Parsing ──────────────────────────────────────────────────

export function parseCertificate(certBase64: string): x509.X509Certificate {
  const certDer = Buffer.from(certBase64, "base64");
  return new x509.X509Certificate(certDer);
}

export function extractPublicKeyDER(cert: x509.X509Certificate): Buffer {
  // Full SubjectPublicKeyInfo in DER format (88 bytes for secp256k1)
  // This matches @fidm/x509's cert.publicKeyRaw which also returns full SPKI
  return Buffer.from(cert.publicKey.rawData);
}

export function extractCertificateSignature(cert: x509.X509Certificate): Buffer {
  // The CA's signature on the certificate — used for QR Tag 9
  // Return raw DER bytes as-is (30 44 02 20... format, ~70-72 bytes)
  return Buffer.from(cert.signature);
}

export function getCertificateHash(cert: x509.X509Certificate): Buffer {
  // SHA-256 of the base64-encoded certificate body — matches ZATCA SDK behavior.
  // ZATCA SDK hashes the base64 TEXT of the cert (not the raw DER bytes).
  const certBase64 = Buffer.from(cert.rawData).toString("base64");
  return crypto.createHash("sha256").update(certBase64).digest();
}

export function getCertificateIssuerName(cert: x509.X509Certificate): string {
  // @peculiar/x509 returns issuer in ASN.1 order (least specific first):
  //   DC=local, DC=gov, DC=extgazt, CN=PRZEINVOICESCA4-CA
  // ZATCA SDK expects RFC 2253 reverse order (most specific first):
  //   CN=PRZEINVOICESCA4-CA, DC=extgazt, DC=gov, DC=local
  return cert.issuer.split(", ").reverse().join(", ");
}

export function getCertificateSerialNumber(cert: x509.X509Certificate): string {
  return cert.serialNumber;
}

export function isCertificateExpiring(cert: x509.X509Certificate, daysThreshold: number): boolean {
  const expiryDate = cert.notAfter;
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= daysThreshold;
}

// ─── DER/IEEE P1363 Signature Conversion ──────────────────────────────────

/**
 * Convert DER-encoded ECDSA signature to IEEE P1363 format (r || s).
 * ZATCA QR tags 7 and 9 require IEEE P1363 (64 bytes for secp256k1).
 */
export function derToP1363(derSignature: Buffer): Buffer {
  // DER structure: 0x30 [total_len] 0x02 [r_len] [r_bytes] 0x02 [s_len] [s_bytes]
  let offset = 2; // skip 0x30 and total length

  // Parse r
  if (derSignature[offset] !== 0x02) throw new Error("Invalid DER: expected 0x02 for r");
  offset++;
  const rLen = derSignature[offset++];
  let rBytes = derSignature.subarray(offset, offset + rLen);
  offset += rLen;

  // Parse s
  if (derSignature[offset] !== 0x02) throw new Error("Invalid DER: expected 0x02 for s");
  offset++;
  const sLen = derSignature[offset++];
  let sBytes = derSignature.subarray(offset, offset + sLen);

  // Strip leading zero padding (DER uses signed integers)
  if (rBytes.length > 32 && rBytes[0] === 0x00) rBytes = rBytes.subarray(1);
  if (sBytes.length > 32 && sBytes[0] === 0x00) sBytes = sBytes.subarray(1);

  // Pad to 32 bytes each (secp256k1)
  const result = Buffer.alloc(64);
  rBytes.copy(result, 32 - rBytes.length);
  sBytes.copy(result, 64 - sBytes.length);

  return result;
}

/**
 * Convert IEEE P1363 signature (r || s) to DER encoding.
 * Used when the XML ds:SignatureValue needs DER format.
 */
export function p1363ToDer(p1363: Buffer): Buffer {
  const r = p1363.subarray(0, 32);
  const s = p1363.subarray(32, 64);

  // Add leading 0x00 if high bit is set (DER signed integer)
  const rDer = r[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), r]) : trimLeadingZeros(r);
  const sDer = s[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), s]) : trimLeadingZeros(s);

  const totalLen = 2 + rDer.length + 2 + sDer.length;
  return Buffer.concat([
    Buffer.from([0x30, totalLen]),
    Buffer.from([0x02, rDer.length]),
    rDer,
    Buffer.from([0x02, sDer.length]),
    sDer,
  ]);
}

function trimLeadingZeros(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0x00 && !(buf[i + 1] & 0x80)) i++;
  return i > 0 ? buf.subarray(i) : buf;
}

// ─── PEM Utilities ────────────────────────────────────────────────────────

function derToPem(der: ArrayBuffer, label: string): string {
  const b64 = Buffer.from(der).toString("base64");
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function pemToDer(pem: string, label: string): ArrayBuffer {
  const b64 = pem
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s/g, "");
  const buf = Buffer.from(b64, "base64");
  // .buffer returns the entire underlying ArrayBuffer pool; slice to get only our data
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

