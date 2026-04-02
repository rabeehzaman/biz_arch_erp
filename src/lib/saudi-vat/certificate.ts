// ZATCA Phase 2 certificate management
// Key generation, CSR creation, private key encryption/decryption, cert parsing

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
}

export async function generateCSR(
  params: CSRParams,
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<string> {
  const templateName = params.isProduction
    ? "ZATCA-Code-Signing"
    : "PREZATCA-Code-Signing";

  // Build distinguished name with custom OID 2.5.4.97
  const name = [
    `CN=${params.commonName}`,
    `OU=${params.organizationUnit}`,
    `O=${params.organizationName}`,
    `C=SA`,
    `2.5.4.97=${params.vatNumber}`,
  ].join(",");

  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name,
    keys: { privateKey, publicKey },
    signingAlgorithm: ECDSA_ALG,
    extensions: [
      // Key usage
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.nonRepudiation
      ),
      // Subject Alternative Name with ZATCA-specific fields
      await buildSANExtension(params, templateName),
    ],
  });

  return Buffer.from(csr.rawData).toString("base64");
}

async function buildSANExtension(
  params: CSRParams,
  templateName: string
): Promise<x509.SubjectAlternativeNameExtension> {
  // SAN directory name contains ZATCA-specific fields
  const directoryNameAttrs: Record<string, string> = {};

  // SN = serial number (1-AppName|2-Version|3-Serial)
  directoryNameAttrs["2.5.4.5"] = params.serialNumber;
  // UID = VAT number
  directoryNameAttrs["0.9.2342.19200300.100.1.1"] = params.vatNumber;
  // title = invoice type flags
  directoryNameAttrs["2.5.4.12"] = params.title;
  // registeredAddress
  directoryNameAttrs["2.5.4.26"] = params.registeredAddress;
  // businessCategory
  directoryNameAttrs["2.5.4.15"] = params.businessCategory;

  // Build the GeneralName with DirectoryName containing these attributes
  const dirNameStr = Object.entries(directoryNameAttrs)
    .map(([oid, val]) => `${oid}=${val}`)
    .join(",");

  return new x509.SubjectAlternativeNameExtension([
    { type: "dn", value: dirNameStr } as unknown as x509.GeneralName,
  ], false);
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
  // SubjectPublicKeyInfo in DER format — used for QR Tag 8
  return Buffer.from(cert.publicKey.rawData);
}

export function extractCertificateSignature(cert: x509.X509Certificate): Buffer {
  // The CA's signature on the certificate — used for QR Tag 9
  return Buffer.from(cert.signature);
}

export function getCertificateHash(cert: x509.X509Certificate): Buffer {
  // SHA-256 of the DER-encoded certificate — used in XAdES SignedProperties
  const derBytes = Buffer.from(cert.rawData);
  return crypto.createHash("sha256").update(derBytes).digest();
}

export function getCertificateIssuerName(cert: x509.X509Certificate): string {
  return cert.issuer;
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
  return Buffer.from(b64, "base64").buffer;
}
