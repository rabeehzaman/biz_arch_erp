// ZATCA Phase 2 XML signing — 8-step XAdES-BES flow
// ECDSA-SHA256 on secp256k1 with C14N 1.1

import crypto from "crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { Crypto } from "@peculiar/webcrypto";
import * as x509 from "@peculiar/x509";
import { ZATCA_NAMESPACES, ZATCA_ALGORITHMS } from "./zatca-config";
import {
  importPrivateKey,
  parseCertificate,
  getCertificateHash,
  getCertificateIssuerName,
  getCertificateSerialNumber,
  extractPublicKeyDER,
  extractCertificateSignature,
  derToP1363,
} from "./certificate";

const peculiarCrypto = new Crypto();

// ─── Types ────────────────────────────────────────────────────────────────

export interface SigningResult {
  signedXml: string;
  invoiceHash: string;        // base64 SHA-256 of canonical invoice (for ZATCA API)
  invoiceHashBytes: Buffer;   // raw bytes (for QR tag 6)
  signatureBytes: Buffer;     // DER signature bytes
  publicKeyDER: Buffer;       // SubjectPublicKeyInfo (for QR tag 8)
  certSignatureBytes: Buffer; // CA signature from certificate (for QR tag 9)
}

// ─── Main Signing Function ────────────────────────────────────────────────

/**
 * Signs a ZATCA invoice XML following the 8-step flow.
 * Returns signed XML + data needed for QR code generation.
 */
export async function signInvoiceXML(
  invoiceXml: string,
  privateKeyPem: string,
  certificateBase64: string
): Promise<SigningResult> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(invoiceXml, "application/xml");
  const cert = parseCertificate(certificateBase64);

  // Step 1: XML is already built with all elements except signature values

  // Step 2: Compute invoice hash
  // Remove: ext:UBLExtensions, cac:Signature, cac:AdditionalDocumentReference[QR]
  const invoiceHashBytes = computeInvoiceHash(doc);
  const invoiceHash = invoiceHashBytes.toString("base64");

  // Step 3: Build SignedProperties
  const signingTime = new Date().toISOString();
  const certHash = getCertificateHash(cert);
  const certIssuer = getCertificateIssuerName(cert);
  const certSerial = getCertificateSerialNumber(cert);

  // Step 4: Compute SignedProperties digest
  const signedPropertiesXml = buildSignedPropertiesXml(
    signingTime,
    certHash.toString("base64"),
    certIssuer,
    certSerial
  );
  const signedPropsHash = sha256Base64(signedPropertiesXml);

  // Step 5: Assemble SignedInfo
  const signedInfoXml = buildSignedInfoXml(invoiceHash, signedPropsHash);

  // Step 6: Sign the SignedInfo
  const privateKey = await importPrivateKey(privateKeyPem);
  const signedInfoBytes = Buffer.from(signedInfoXml, "utf-8");
  const signatureArrayBuffer = await peculiarCrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signedInfoBytes
  );
  // WebCrypto returns IEEE P1363 format; convert to DER for XML
  const signatureP1363 = Buffer.from(signatureArrayBuffer);
  const signatureDER = p1363ToDerLocal(signatureP1363);
  const signatureBase64 = signatureDER.toString("base64");

  // Step 7: QR data extraction
  const publicKeyDER = extractPublicKeyDER(cert);
  const certSignatureBytes = extractCertificateSignature(cert);

  // Step 8: Embed signature into XML
  const certBase64Content = certificateBase64;
  const signedXml = embedSignature(
    doc,
    signedInfoXml,
    signatureBase64,
    signedPropertiesXml,
    certBase64Content
  );

  return {
    signedXml,
    invoiceHash,
    invoiceHashBytes,
    signatureBytes: signatureP1363, // P1363 for QR tag 7
    publicKeyDER,
    certSignatureBytes,
  };
}

// ─── Step 2: Invoice Hash Computation ─────────────────────────────────────

function computeInvoiceHash(doc: Document): Buffer {
  // Clone the document to avoid modifying the original
  const serializer = new XMLSerializer();
  const xmlStr = serializer.serializeToString(doc);
  const cloneDoc = new DOMParser().parseFromString(xmlStr, "application/xml");
  const root = cloneDoc.documentElement;

  // Remove ext:UBLExtensions
  removeElementByTagNS(root, ZATCA_NAMESPACES.EXT, "UBLExtensions");

  // Remove cac:Signature
  removeElementByTagNS(root, ZATCA_NAMESPACES.CAC, "Signature");

  // Remove cac:AdditionalDocumentReference where cbc:ID = "QR"
  removeAdditionalDocRef(root, "QR");

  // Canonicalize (simplified C14N — serialize without extra whitespace)
  const canonical = serializer.serializeToString(cloneDoc);

  return crypto.createHash("sha256").update(canonical, "utf-8").digest();
}

function removeElementByTagNS(root: Element, ns: string, localName: string) {
  const elements = root.getElementsByTagNameNS(ns, localName);
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements.item(i);
    if (el?.parentNode) {
      el.parentNode.removeChild(el);
    }
  }
}

function removeAdditionalDocRef(root: Element, refId: string) {
  const refs = root.getElementsByTagNameNS(ZATCA_NAMESPACES.CAC, "AdditionalDocumentReference");
  for (let i = refs.length - 1; i >= 0; i--) {
    const ref = refs.item(i);
    if (!ref) continue;
    const ids = ref.getElementsByTagNameNS(ZATCA_NAMESPACES.CBC, "ID");
    if (ids.length > 0 && ids.item(0)?.textContent === refId) {
      ref.parentNode?.removeChild(ref);
    }
  }
}

// ─── Step 3 & 4: SignedProperties ─────────────────────────────────────────

function buildSignedPropertiesXml(
  signingTime: string,
  certDigestBase64: string,
  issuerName: string,
  serialNumber: string
): string {
  return [
    `<xades:SignedProperties xmlns:xades="${ZATCA_NAMESPACES.XADES}" Id="xadesSignedProperties">`,
    `<xades:SignedSignatureProperties>`,
    `<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `<xades:SigningCertificate>`,
    `<xades:Cert>`,
    `<xades:CertDigest>`,
    `<ds:DigestMethod xmlns:ds="${ZATCA_NAMESPACES.DS}" Algorithm="${ZATCA_ALGORITHMS.DIGEST}"/>`,
    `<ds:DigestValue xmlns:ds="${ZATCA_NAMESPACES.DS}">${certDigestBase64}</ds:DigestValue>`,
    `</xades:CertDigest>`,
    `<xades:IssuerSerial>`,
    `<ds:X509IssuerName xmlns:ds="${ZATCA_NAMESPACES.DS}">${escapeXml(issuerName)}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber xmlns:ds="${ZATCA_NAMESPACES.DS}">${serialNumber}</ds:X509SerialNumber>`,
    `</xades:IssuerSerial>`,
    `</xades:Cert>`,
    `</xades:SigningCertificate>`,
    `</xades:SignedSignatureProperties>`,
    `</xades:SignedProperties>`,
  ].join("");
}

// ─── Step 5: SignedInfo ───────────────────────────────────────────────────

function buildSignedInfoXml(
  invoiceDigest: string,
  signedPropsDigest: string
): string {
  return [
    `<ds:SignedInfo xmlns:ds="${ZATCA_NAMESPACES.DS}">`,
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

// ─── Step 8: Embed Signature into XML ─────────────────────────────────────

function embedSignature(
  doc: Document,
  signedInfoXml: string,
  signatureBase64: string,
  signedPropertiesXml: string,
  certBase64: string
): string {
  // Build the complete ds:Signature block
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

  // Find the SignatureInformation element and insert ds:Signature
  const serializer = new XMLSerializer();
  let xmlStr = serializer.serializeToString(doc);

  // Insert ds:Signature before the closing </sac:SignatureInformation>
  const sigInfoCloseTag = "</sac:SignatureInformation>";
  xmlStr = xmlStr.replace(sigInfoCloseTag, dsSignature + sigInfoCloseTag);

  return xmlStr;
}

// ─── Update QR in Signed XML ──────────────────────────────────────────────

/**
 * Replace the empty QR placeholder in the signed XML with the actual QR data.
 * Called after enhanced QR code is generated.
 */
export function embedQRInXml(signedXml: string, qrBase64: string): string {
  // The QR AdditionalDocumentReference has an empty EmbeddedDocumentBinaryObject
  // Replace it with the actual QR data
  const parser = new DOMParser();
  const doc = parser.parseFromString(signedXml, "application/xml");
  const root = doc.documentElement;

  const refs = root.getElementsByTagNameNS(ZATCA_NAMESPACES.CAC, "AdditionalDocumentReference");
  for (let i = 0; i < refs.length; i++) {
    const ref = refs.item(i);
    if (!ref) continue;
    const ids = ref.getElementsByTagNameNS(ZATCA_NAMESPACES.CBC, "ID");
    if (ids.length > 0 && ids.item(0)?.textContent === "QR") {
      const binObjs = ref.getElementsByTagNameNS(ZATCA_NAMESPACES.CBC, "EmbeddedDocumentBinaryObject");
      if (binObjs.length > 0) {
        binObjs.item(0)!.textContent = qrBase64;
      }
      break;
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

// ─── Utilities ────────────────────────────────────────────────────────────

function sha256Base64(data: string): string {
  return crypto.createHash("sha256").update(data, "utf-8").digest("base64");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert IEEE P1363 signature (r || s) to DER encoding.
 * WebCrypto ECDSA returns P1363; XML ds:SignatureValue needs DER.
 */
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
  // Strip leading zeros but keep at least one byte
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0x00) i++;
  const trimmed = buf.subarray(i);
  // Add leading 0x00 if high bit set (DER signed integer)
  if (trimmed[0] & 0x80) {
    return Buffer.concat([Buffer.from([0x00]), trimmed]);
  }
  return trimmed;
}
