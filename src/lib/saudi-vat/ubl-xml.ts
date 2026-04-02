// ZATCA Phase 2 UBL 2.1 XML invoice generation
// Generates XML for Invoice (388), Credit Note (381), Debit Note (383)

import { create } from "xmlbuilder2";
import {
  ZATCA_NAMESPACES,
  ZATCA_DOC_TYPES,
  ZATCA_SUBTYPES,
  ZATCA_ALGORITHMS,
} from "./zatca-config";

// ─── Types ────────────────────────────────────────────────────────────────

export interface UBLPartyInfo {
  name: string;
  arabicName?: string;
  vatNumber: string;
  commercialRegNumber?: string;
  streetName: string;
  buildingNumber: string;    // 4 digits
  plotIdentification?: string; // 4 digits
  citySubdivision?: string;
  city: string;
  postalZone: string;        // 5 digits
  countryCode: string;       // "SA"
}

export interface UBLLineItem {
  id: string;                 // line number "1", "2", etc.
  name: string;
  quantity: number;
  unitPrice: number;          // price per unit (tax-exclusive)
  discount?: number;          // line-level discount amount
  vatRate: number;            // 15 or 0
  vatCategory: string;        // "S", "Z", "E", "O"
  vatAmount: number;
  lineExtensionAmount: number; // qty * unitPrice - discount
  taxExemptionReasonCode?: string;
  taxExemptionReason?: string;
}

export interface UBLInvoiceParams {
  // Document identification
  invoiceNumber: string;
  uuid: string;
  issueDate: string;          // YYYY-MM-DD
  issueTime: string;          // HH:MM:SS
  documentType: "388" | "381" | "383";
  invoiceSubtype: "0100000" | "0200000";

  // References
  icv: number;
  previousInvoiceHash: string; // base64 SHA-256
  billingReferenceId?: string; // original invoice number (for CN/DN)

  // Parties
  seller: UBLPartyInfo;
  buyer?: UBLPartyInfo;       // required for STANDARD, optional for SIMPLIFIED

  // Delivery
  deliveryDate: string;       // YYYY-MM-DD

  // Payment
  paymentMeansCode: string;   // "10" = cash, "30" = credit, "42" = bank transfer, etc.

  // Document-level allowances/charges
  documentDiscount?: number;

  // Line items
  items: UBLLineItem[];

  // Totals (pre-computed)
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  allowanceTotalAmount?: number;
  payableAmount: number;

  // Tax breakdown by category
  taxSubtotals: Array<{
    taxableAmount: number;
    taxAmount: number;
    taxCategory: string;     // "S", "Z", "E", "O"
    taxPercent: number;
    taxExemptionReasonCode?: string;
    taxExemptionReason?: string;
  }>;

  totalVat: number;
}

// ─── XML Generation ───────────────────────────────────────────────────────

export function generateInvoiceXML(params: UBLInvoiceParams): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" });

  const inv = doc.ele(ZATCA_NAMESPACES.INVOICE, "Invoice");
  inv.att("xmlns:cac", ZATCA_NAMESPACES.CAC);
  inv.att("xmlns:cbc", ZATCA_NAMESPACES.CBC);
  inv.att("xmlns:ext", ZATCA_NAMESPACES.EXT);

  // 1. UBLExtensions — signature placeholder (populated by signing step)
  buildUBLExtensions(inv);

  // 2. ProfileID
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:ProfileID").txt("reporting:1.0");

  // 3. ID
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt(params.invoiceNumber);

  // 4. UUID
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:UUID").txt(params.uuid);

  // 5. IssueDate
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:IssueDate").txt(params.issueDate);

  // 6. IssueTime
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:IssueTime").txt(params.issueTime);

  // 7. InvoiceTypeCode
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:InvoiceTypeCode")
    .att("name", params.invoiceSubtype)
    .txt(params.documentType);

  // 8. DocumentCurrencyCode
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:DocumentCurrencyCode").txt("SAR");

  // 9. TaxCurrencyCode
  inv.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxCurrencyCode").txt("SAR");

  // 10. BillingReference (only for credit/debit notes)
  if (params.billingReferenceId && params.documentType !== "388") {
    const billingRef = inv.ele(ZATCA_NAMESPACES.CAC, "cac:BillingReference");
    const invoiceDocRef = billingRef.ele(ZATCA_NAMESPACES.CAC, "cac:InvoiceDocumentReference");
    invoiceDocRef.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt(params.billingReferenceId);
  }

  // 11. AdditionalDocumentReference — ICV
  buildAdditionalDocRef(inv, "ICV", String(params.icv));

  // 11. AdditionalDocumentReference — PIH
  buildAdditionalDocRefBinary(inv, "PIH", params.previousInvoiceHash);

  // 11. AdditionalDocumentReference — QR (placeholder, filled after signing)
  buildAdditionalDocRefBinary(inv, "QR", "");

  // 12. Signature reference
  const sigRef = inv.ele(ZATCA_NAMESPACES.CAC, "cac:Signature");
  sigRef.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("urn:oasis:names:specification:ubl:signature:Invoice");
  sigRef.ele(ZATCA_NAMESPACES.CBC, "cbc:SignatureMethod").txt("urn:oasis:names:specification:ubl:dsig:enveloped:xades");

  // 13. AccountingSupplierParty
  buildParty(inv, "cac:AccountingSupplierParty", params.seller);

  // 14. AccountingCustomerParty
  if (params.buyer) {
    buildParty(inv, "cac:AccountingCustomerParty", params.buyer);
  } else {
    // SIMPLIFIED: minimal buyer
    const custParty = inv.ele(ZATCA_NAMESPACES.CAC, "cac:AccountingCustomerParty");
    const party = custParty.ele(ZATCA_NAMESPACES.CAC, "cac:Party");
    const partyId = party.ele(ZATCA_NAMESPACES.CAC, "cac:PartyIdentification");
    partyId.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("NA");
  }

  // 15. Delivery
  const delivery = inv.ele(ZATCA_NAMESPACES.CAC, "cac:Delivery");
  delivery.ele(ZATCA_NAMESPACES.CBC, "cbc:ActualDeliveryDate").txt(params.deliveryDate);

  // 16. PaymentMeans
  const paymentMeans = inv.ele(ZATCA_NAMESPACES.CAC, "cac:PaymentMeans");
  paymentMeans.ele(ZATCA_NAMESPACES.CBC, "cbc:PaymentMeansCode").txt(params.paymentMeansCode);

  // 17. Document-level AllowanceCharge (discount)
  if (params.documentDiscount && params.documentDiscount > 0) {
    const ac = inv.ele(ZATCA_NAMESPACES.CAC, "cac:AllowanceCharge");
    ac.ele(ZATCA_NAMESPACES.CBC, "cbc:ChargeIndicator").txt("false");
    ac.ele(ZATCA_NAMESPACES.CBC, "cbc:AllowanceChargeReason").txt("Discount");
    ac.ele(ZATCA_NAMESPACES.CBC, "cbc:Amount")
      .att("currencyID", "SAR")
      .txt(formatDecimal(params.documentDiscount));
    // Tax category for the discount
    const acTaxCat = ac.ele(ZATCA_NAMESPACES.CAC, "cac:TaxCategory");
    acTaxCat.ele(ZATCA_NAMESPACES.CBC, "cbc:ID")
      .att("schemeID", "UN/ECE 5305")
      .att("schemeAgencyID", "6")
      .txt("S");
    acTaxCat.ele(ZATCA_NAMESPACES.CBC, "cbc:Percent").txt("15");
    const acTaxScheme = acTaxCat.ele(ZATCA_NAMESPACES.CAC, "cac:TaxScheme");
    acTaxScheme.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("VAT");
  }

  // 18. TaxTotal — two elements required
  // First: tax amount in document currency (no subtotals)
  const taxTotal1 = inv.ele(ZATCA_NAMESPACES.CAC, "cac:TaxTotal");
  taxTotal1.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(params.totalVat));

  // Second: tax amount in SAR with TaxSubtotal breakdowns
  const taxTotal2 = inv.ele(ZATCA_NAMESPACES.CAC, "cac:TaxTotal");
  taxTotal2.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(params.totalVat));

  for (const sub of params.taxSubtotals) {
    const taxSubtotal = taxTotal2.ele(ZATCA_NAMESPACES.CAC, "cac:TaxSubtotal");
    taxSubtotal.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxableAmount")
      .att("currencyID", "SAR")
      .txt(formatDecimal(sub.taxableAmount));
    taxSubtotal.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxAmount")
      .att("currencyID", "SAR")
      .txt(formatDecimal(sub.taxAmount));
    const taxCat = taxSubtotal.ele(ZATCA_NAMESPACES.CAC, "cac:TaxCategory");
    taxCat.ele(ZATCA_NAMESPACES.CBC, "cbc:ID")
      .att("schemeID", "UN/ECE 5305")
      .att("schemeAgencyID", "6")
      .txt(sub.taxCategory);
    taxCat.ele(ZATCA_NAMESPACES.CBC, "cbc:Percent").txt(String(sub.taxPercent));
    if (sub.taxExemptionReasonCode) {
      taxCat.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxExemptionReasonCode").txt(sub.taxExemptionReasonCode);
    }
    if (sub.taxExemptionReason) {
      taxCat.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxExemptionReason").txt(sub.taxExemptionReason);
    }
    const taxScheme = taxCat.ele(ZATCA_NAMESPACES.CAC, "cac:TaxScheme");
    taxScheme.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("VAT");
  }

  // 19. LegalMonetaryTotal
  const lmt = inv.ele(ZATCA_NAMESPACES.CAC, "cac:LegalMonetaryTotal");
  lmt.ele(ZATCA_NAMESPACES.CBC, "cbc:LineExtensionAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(params.lineExtensionAmount));
  lmt.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxExclusiveAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(params.taxExclusiveAmount));
  lmt.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxInclusiveAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(params.taxInclusiveAmount));
  if (params.allowanceTotalAmount != null && params.allowanceTotalAmount > 0) {
    lmt.ele(ZATCA_NAMESPACES.CBC, "cbc:AllowanceTotalAmount")
      .att("currencyID", "SAR")
      .txt(formatDecimal(params.allowanceTotalAmount));
  }
  lmt.ele(ZATCA_NAMESPACES.CBC, "cbc:PayableAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(params.payableAmount));

  // 20. InvoiceLine items
  for (const item of params.items) {
    buildInvoiceLine(inv, item);
  }

  return doc.end({ prettyPrint: false });
}

// ─── Helper Builders ──────────────────────────────────────────────────────

function buildUBLExtensions(parent: ReturnType<typeof create>) {
  const ext = parent.ele(ZATCA_NAMESPACES.EXT, "ext:UBLExtensions");
  const ublExt = ext.ele(ZATCA_NAMESPACES.EXT, "ext:UBLExtension");
  const extContent = ublExt.ele(ZATCA_NAMESPACES.EXT, "ext:ExtensionURI").txt("urn:oasis:names:specification:ubl:dsig:enveloped:xades");
  const extContent2 = ublExt.ele(ZATCA_NAMESPACES.EXT, "ext:ExtensionContent");
  // Signature block placeholder — populated by xml-signing.ts
  const ublDocSigs = extContent2.ele(ZATCA_NAMESPACES.SIG, "sig:UBLDocumentSignatures");
  ublDocSigs.att("xmlns:sig", ZATCA_NAMESPACES.SIG);
  ublDocSigs.att("xmlns:sac", ZATCA_NAMESPACES.SAC);
  ublDocSigs.att("xmlns:sbc", ZATCA_NAMESPACES.SBC);
  const sigInfo = ublDocSigs.ele(ZATCA_NAMESPACES.SAC, "sac:SignatureInformation");
  sigInfo.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("urn:oasis:names:specification:ubl:signature:1");
  sigInfo.ele(ZATCA_NAMESPACES.SBC, "sbc:ReferencedSignatureID").txt("urn:oasis:names:specification:ubl:signature:Invoice");
  // ds:Signature element will be inserted here by signing step
}

function buildAdditionalDocRef(parent: ReturnType<typeof create>, id: string, value: string) {
  const ref = parent.ele(ZATCA_NAMESPACES.CAC, "cac:AdditionalDocumentReference");
  ref.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt(id);
  ref.ele(ZATCA_NAMESPACES.CBC, "cbc:UUID").txt(value);
}

function buildAdditionalDocRefBinary(parent: ReturnType<typeof create>, id: string, value: string) {
  const ref = parent.ele(ZATCA_NAMESPACES.CAC, "cac:AdditionalDocumentReference");
  ref.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt(id);
  const attach = ref.ele(ZATCA_NAMESPACES.CAC, "cac:Attachment");
  attach.ele(ZATCA_NAMESPACES.CBC, "cbc:EmbeddedDocumentBinaryObject")
    .att("mimeCode", "text/plain")
    .txt(value);
}

function buildParty(
  parent: ReturnType<typeof create>,
  elementName: string,
  info: UBLPartyInfo
) {
  const accountingParty = parent.ele(ZATCA_NAMESPACES.CAC, elementName);
  const party = accountingParty.ele(ZATCA_NAMESPACES.CAC, "cac:Party");

  // PartyIdentification — Commercial Registration
  if (info.commercialRegNumber) {
    const partyId = party.ele(ZATCA_NAMESPACES.CAC, "cac:PartyIdentification");
    partyId.ele(ZATCA_NAMESPACES.CBC, "cbc:ID")
      .att("schemeID", "CRN")
      .txt(info.commercialRegNumber);
  }

  // PostalAddress
  const address = party.ele(ZATCA_NAMESPACES.CAC, "cac:PostalAddress");
  address.ele(ZATCA_NAMESPACES.CBC, "cbc:StreetName").txt(info.streetName);
  address.ele(ZATCA_NAMESPACES.CBC, "cbc:BuildingNumber").txt(info.buildingNumber);
  if (info.plotIdentification) {
    address.ele(ZATCA_NAMESPACES.CBC, "cbc:PlotIdentification").txt(info.plotIdentification);
  }
  if (info.citySubdivision) {
    address.ele(ZATCA_NAMESPACES.CBC, "cbc:CitySubdivisionName").txt(info.citySubdivision);
  }
  address.ele(ZATCA_NAMESPACES.CBC, "cbc:CityName").txt(info.city);
  address.ele(ZATCA_NAMESPACES.CBC, "cbc:PostalZone").txt(info.postalZone);
  const country = address.ele(ZATCA_NAMESPACES.CAC, "cac:Country");
  country.ele(ZATCA_NAMESPACES.CBC, "cbc:IdentificationCode").txt(info.countryCode);

  // PartyTaxScheme — VAT TRN
  const taxScheme = party.ele(ZATCA_NAMESPACES.CAC, "cac:PartyTaxScheme");
  taxScheme.ele(ZATCA_NAMESPACES.CBC, "cbc:CompanyID").txt(info.vatNumber);
  const taxSchemeInner = taxScheme.ele(ZATCA_NAMESPACES.CAC, "cac:TaxScheme");
  taxSchemeInner.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("VAT");

  // PartyLegalEntity — name
  const legalEntity = party.ele(ZATCA_NAMESPACES.CAC, "cac:PartyLegalEntity");
  legalEntity.ele(ZATCA_NAMESPACES.CBC, "cbc:RegistrationName").txt(info.name);
}

function buildInvoiceLine(parent: ReturnType<typeof create>, item: UBLLineItem) {
  const line = parent.ele(ZATCA_NAMESPACES.CAC, "cac:InvoiceLine");
  line.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt(item.id);
  line.ele(ZATCA_NAMESPACES.CBC, "cbc:InvoicedQuantity")
    .att("unitCode", "PCE")
    .txt(String(item.quantity));
  line.ele(ZATCA_NAMESPACES.CBC, "cbc:LineExtensionAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(item.lineExtensionAmount));

  // Line-level TaxTotal
  const lineTaxTotal = line.ele(ZATCA_NAMESPACES.CAC, "cac:TaxTotal");
  lineTaxTotal.ele(ZATCA_NAMESPACES.CBC, "cbc:TaxAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(item.vatAmount));
  lineTaxTotal.ele(ZATCA_NAMESPACES.CBC, "cbc:RoundingAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(item.lineExtensionAmount + item.vatAmount));

  // Item details
  const itemEl = line.ele(ZATCA_NAMESPACES.CAC, "cac:Item");
  itemEl.ele(ZATCA_NAMESPACES.CBC, "cbc:Name").txt(item.name);

  // Item ClassifiedTaxCategory
  const classifiedTax = itemEl.ele(ZATCA_NAMESPACES.CAC, "cac:ClassifiedTaxCategory");
  classifiedTax.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt(item.vatCategory);
  classifiedTax.ele(ZATCA_NAMESPACES.CBC, "cbc:Percent").txt(String(item.vatRate));
  const taxScheme = classifiedTax.ele(ZATCA_NAMESPACES.CAC, "cac:TaxScheme");
  taxScheme.ele(ZATCA_NAMESPACES.CBC, "cbc:ID").txt("VAT");

  // Price
  const price = line.ele(ZATCA_NAMESPACES.CAC, "cac:Price");
  price.ele(ZATCA_NAMESPACES.CBC, "cbc:PriceAmount")
    .att("currencyID", "SAR")
    .txt(formatDecimal(item.unitPrice));

  // Line-level discount under Price/AllowanceCharge
  if (item.discount && item.discount > 0) {
    const priceAC = price.ele(ZATCA_NAMESPACES.CAC, "cac:AllowanceCharge");
    priceAC.ele(ZATCA_NAMESPACES.CBC, "cbc:ChargeIndicator").txt("false");
    priceAC.ele(ZATCA_NAMESPACES.CBC, "cbc:AllowanceChargeReason").txt("Line Discount");
    priceAC.ele(ZATCA_NAMESPACES.CBC, "cbc:Amount")
      .att("currencyID", "SAR")
      .txt(formatDecimal(item.discount));
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────

function formatDecimal(n: number): string {
  return n.toFixed(2);
}
