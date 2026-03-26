import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { numberToWordsLocalized } from "@/lib/number-to-words";
import { getLocaleForCurrency } from "@/lib/currency";

const BRAND = "#b8860b"; // Gold

const fmt = (amount: number, locale: string) =>
  amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const s = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20, fontSize: 8, fontFamily: "Helvetica", color: "#333" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: BRAND },
  headerLeft: { width: "55%" },
  headerRight: { width: "40%", alignItems: "flex-end" },
  logo: { width: 70, height: 70, marginBottom: 5, objectFit: "contain" },
  orgName: { fontSize: 14, fontWeight: "bold", color: BRAND },
  orgText: { fontSize: 7, color: "#666", lineHeight: 1.5 },
  invoiceTitle: { fontSize: 18, fontWeight: "bold", color: BRAND, marginBottom: 3 },
  invoiceNumber: { fontSize: 10, fontWeight: "bold" },
  invoiceMeta: { fontSize: 7, color: "#666", marginTop: 2 },
  // Customer
  custRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, padding: 8, backgroundColor: "#fdf6e3", borderRadius: 4 },
  custBlock: { width: "48%" },
  custLabel: { fontSize: 7, color: "#999", marginBottom: 2, textTransform: "uppercase" },
  custName: { fontSize: 10, fontWeight: "bold" },
  custText: { fontSize: 7, color: "#555", lineHeight: 1.4 },
  // Table
  table: { marginBottom: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: BRAND, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 2 },
  th: { color: "#fff", fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  tableRowAlt: { backgroundColor: "#fefce8" },
  td: { fontSize: 7.5 },
  tdBold: { fontSize: 7.5, fontWeight: "bold" },
  tdRight: { fontSize: 7.5, textAlign: "right" },
  tdRightBold: { fontSize: 7.5, textAlign: "right", fontWeight: "bold" },
  // Widths — 11 columns
  colSl: { width: "3%" },
  colTag: { width: "10%" },
  colHuid: { width: "8%" },
  colPurity: { width: "6%" },
  colGross: { width: "7%" },
  colNet: { width: "7%" },
  colRate: { width: "9%" },
  colGold: { width: "11%" },
  colWaste: { width: "9%" },
  colMaking: { width: "11%" },
  colStone: { width: "8%" },
  colTotal: { width: "11%" },
  // Summary
  summaryBox: { flexDirection: "row", justifyContent: "flex-end", marginTop: 5 },
  summaryTable: { width: "45%", borderWidth: 0.5, borderColor: "#d1d5db", borderRadius: 4, overflow: "hidden" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  summaryLabel: { fontSize: 8, color: "#555" },
  summaryValue: { fontSize: 8, fontWeight: "bold", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: BRAND },
  totalLabel: { fontSize: 10, fontWeight: "bold", color: "#fff" },
  totalValue: { fontSize: 11, fontWeight: "bold", color: "#fff", textAlign: "right" },
  // Amount in words
  wordsBox: { marginTop: 8, padding: 6, backgroundColor: "#fdf6e3", borderRadius: 3 },
  wordsLabel: { fontSize: 6.5, color: "#999", textTransform: "uppercase" },
  wordsText: { fontSize: 8, fontWeight: "bold", marginTop: 1 },
  // Footer
  footer: { marginTop: 15, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  footerText: { fontSize: 7, color: "#999", textAlign: "center" },
  notes: { fontSize: 7, color: "#555", marginTop: 5 },
});

export interface JewelleryInvoiceItem {
  tagNumber: string | null;
  huidNumber: string | null;
  purity: string | null;
  metalType: string | null;
  grossWeight: number;
  netWeight: number;
  fineWeight: number;
  goldRate: number;
  wastagePercent: number;
  makingChargeType: string | null;
  makingChargeValue: number;
  stoneValue: number;
  unitPrice: number;
  total: number;
  description: string;
}

export interface JewelleryInvoicePDFProps {
  invoice: {
    invoiceNumber: string;
    issueDate: Date | string;
    customer: { name: string; address?: string | null; city?: string | null; state?: string | null; gstin?: string | null; phone?: string | null };
    organization: { name: string; address?: string | null; gstin?: string | null; vatNumber?: string | null; phone?: string | null };
    items: JewelleryInvoiceItem[];
    subtotal: number;
    totalCgst?: number;
    totalSgst?: number;
    totalIgst?: number;
    totalVat?: number;
    roundOffAmount?: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    notes?: string | null;
    paymentType?: string | null;
  };
  currencySymbol?: string;
  currency?: string;
  headerImageUrl?: string;
}

export function JewelleryInvoicePDF({ invoice, currencySymbol = "₹", currency, headerImageUrl }: JewelleryInvoicePDFProps) {
  const locale = getLocaleForCurrency(currency || "INR");
  // Helvetica doesn't support ₹ — use "Rs." for PDF rendering
  const pdfSymbol = currencySymbol === "₹" ? "Rs." : currencySymbol === "﷼" ? "SAR " : currencySymbol;
  const f = (n: number) => `${pdfSymbol}${fmt(n, locale)}`;
  const dateStr = format(new Date(invoice.issueDate), "dd MMM yyyy");

  const totalCgst = invoice.totalCgst || 0;
  const totalSgst = invoice.totalSgst || 0;
  const totalIgst = invoice.totalIgst || 0;
  const totalVat = invoice.totalVat || 0;
  const roundOff = invoice.roundOffAmount || 0;
  const totalTax = totalVat > 0 ? totalVat : totalCgst + totalSgst + totalIgst;

  const amountInWords = numberToWordsLocalized(invoice.total, currency || "INR");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {headerImageUrl && <Image src={headerImageUrl} style={s.logo} />}
            <Text style={s.orgName}>{invoice.organization.name}</Text>
            {invoice.organization.address && <Text style={s.orgText}>{invoice.organization.address}</Text>}
            {invoice.organization.gstin && <Text style={s.orgText}>GSTIN: {invoice.organization.gstin}</Text>}
            {invoice.organization.vatNumber && <Text style={s.orgText}>VAT: {invoice.organization.vatNumber}</Text>}
            {invoice.organization.phone && <Text style={s.orgText}>Phone: {invoice.organization.phone}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={s.invoiceMeta}>Date: {dateStr}</Text>
            <Text style={s.invoiceMeta}>Payment: {invoice.paymentType || "CASH"}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={s.custRow}>
          <View style={s.custBlock}>
            <Text style={s.custLabel}>Bill To</Text>
            <Text style={s.custName}>{invoice.customer.name}</Text>
            {invoice.customer.address && <Text style={s.custText}>{invoice.customer.address}</Text>}
            {invoice.customer.city && <Text style={s.custText}>{invoice.customer.city}{invoice.customer.state ? `, ${invoice.customer.state}` : ""}</Text>}
            {invoice.customer.gstin && <Text style={s.custText}>GSTIN: {invoice.customer.gstin}</Text>}
            {invoice.customer.phone && <Text style={s.custText}>Phone: {invoice.customer.phone}</Text>}
          </View>
          <View style={s.custBlock}>
            <Text style={s.custLabel}>Summary</Text>
            <Text style={s.custText}>Items: {invoice.items.length}</Text>
            <Text style={s.custText}>Total Gross Weight: {invoice.items.reduce((s, i) => s + i.grossWeight, 0).toFixed(2)}g</Text>
            <Text style={s.custText}>Total Fine Weight: {invoice.items.reduce((s, i) => s + i.fineWeight, 0).toFixed(3)}g</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colSl]}>#</Text>
            <Text style={[s.th, s.colTag]}>Tag</Text>
            <Text style={[s.th, s.colHuid]}>HUID</Text>
            <Text style={[s.th, s.colPurity]}>Purity</Text>
            <Text style={[s.th, s.colGross, { textAlign: "right" }]}>Gross</Text>
            <Text style={[s.th, s.colNet, { textAlign: "right" }]}>Net</Text>
            <Text style={[s.th, s.colRate, { textAlign: "right" }]}>Rate/g</Text>
            <Text style={[s.th, s.colGold, { textAlign: "right" }]}>Gold</Text>
            <Text style={[s.th, s.colWaste, { textAlign: "right" }]}>Wastage</Text>
            <Text style={[s.th, s.colMaking, { textAlign: "right" }]}>Making</Text>
            <Text style={[s.th, s.colStone, { textAlign: "right" }]}>Stones</Text>
            <Text style={[s.th, s.colTotal, { textAlign: "right" }]}>Total</Text>
          </View>
          {invoice.items.map((item, idx) => {
            const goldValue = item.netWeight * item.goldRate;
            const wastageValue = item.netWeight * (item.wastagePercent / 100) * item.goldRate;
            let makingCharges = 0;
            if (item.makingChargeType === "PER_GRAM") makingCharges = item.makingChargeValue * item.netWeight;
            else if (item.makingChargeType === "PERCENTAGE") makingCharges = goldValue * (item.makingChargeValue / 100);
            else makingCharges = item.makingChargeValue;

            return (
              <View key={idx} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.td, s.colSl]}>{idx + 1}</Text>
                <Text style={[s.tdBold, s.colTag]}>{item.tagNumber || "—"}</Text>
                <Text style={[s.td, s.colHuid]}>{item.huidNumber || "—"}</Text>
                <Text style={[s.td, s.colPurity]}>{item.purity || "—"}</Text>
                <Text style={[s.tdRight, s.colGross]}>{item.grossWeight.toFixed(2)}g</Text>
                <Text style={[s.tdRight, s.colNet]}>{item.netWeight.toFixed(2)}g</Text>
                <Text style={[s.tdRight, s.colRate]}>{f(item.goldRate)}</Text>
                <Text style={[s.tdRight, s.colGold]}>{f(goldValue)}</Text>
                <Text style={[s.tdRight, s.colWaste]}>{item.wastagePercent > 0 ? `${f(wastageValue)} (${item.wastagePercent}%)` : "—"}</Text>
                <Text style={[s.tdRight, s.colMaking]}>{makingCharges > 0 ? f(makingCharges) : "—"}</Text>
                <Text style={[s.tdRight, s.colStone]}>{item.stoneValue > 0 ? f(item.stoneValue) : "—"}</Text>
                <Text style={[s.tdRightBold, s.colTotal]}>{f(item.unitPrice)}</Text>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={s.summaryBox}>
          <View style={s.summaryTable}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Subtotal</Text>
              <Text style={s.summaryValue}>{f(invoice.subtotal)}</Text>
            </View>
            {totalCgst > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>CGST</Text>
                <Text style={s.summaryValue}>{f(totalCgst)}</Text>
              </View>
            )}
            {totalSgst > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>SGST</Text>
                <Text style={s.summaryValue}>{f(totalSgst)}</Text>
              </View>
            )}
            {totalIgst > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>IGST</Text>
                <Text style={s.summaryValue}>{f(totalIgst)}</Text>
              </View>
            )}
            {totalVat > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>VAT</Text>
                <Text style={s.summaryValue}>{f(totalVat)}</Text>
              </View>
            )}
            {Math.abs(roundOff) > 0.001 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Round Off</Text>
                <Text style={s.summaryValue}>{f(roundOff)}</Text>
              </View>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>TOTAL</Text>
              <Text style={s.totalValue}>{f(invoice.total)}</Text>
            </View>
            {invoice.balanceDue > 0 && invoice.balanceDue < invoice.total && (
              <>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Paid</Text>
                  <Text style={s.summaryValue}>{f(invoice.amountPaid)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { fontWeight: "bold", color: "#dc2626" }]}>Balance Due</Text>
                  <Text style={[s.summaryValue, { color: "#dc2626" }]}>{f(invoice.balanceDue)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Amount in Words */}
        <View style={s.wordsBox}>
          <Text style={s.wordsLabel}>Amount in Words</Text>
          <Text style={s.wordsText}>{amountInWords}</Text>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={{ marginTop: 8 }}>
            <Text style={[s.custLabel, { marginBottom: 2 }]}>Notes</Text>
            <Text style={s.notes}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Thank you for your purchase!</Text>
          <Text style={[s.footerText, { fontSize: 6, marginTop: 2 }]}>
            * Gold rates are applicable at the time of sale. Weights are in grams. All prices include applicable taxes unless specified.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
