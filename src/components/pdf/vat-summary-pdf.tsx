import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { VATSummaryData } from "@/lib/reports/vat-summary";

interface VATSummaryPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: VATSummaryData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "VAT Summary",
    period: "Period",
    to: "to",
    outputVAT: "Output VAT",
    inputVAT: "Input VAT",
    netVATPayable: "Net VAT Payable",
    section: "Section",
    taxableAmount: "Taxable Amount",
    vatAmount: "VAT Amount",
    sales: "Sales",
    salesReturns: "Sales Returns",
    netOutputVAT: "Net Output VAT",
    purchases: "Purchases",
    purchaseReturns: "Purchase Returns",
    netInputVAT: "Net Input VAT",
    outputVATSection: "Output VAT (Sales)",
    inputVATSection: "Input VAT (Purchases)",
    totals: "Totals",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "ملخص ضريبة القيمة المضافة",
    period: "الفترة",
    to: "إلى",
    outputVAT: "ضريبة المخرجات",
    inputVAT: "ضريبة المدخلات",
    netVATPayable: "صافي الضريبة المستحقة",
    section: "القسم",
    taxableAmount: "المبلغ الخاضع للضريبة",
    vatAmount: "مبلغ الضريبة",
    sales: "المبيعات",
    salesReturns: "مرتجعات المبيعات",
    netOutputVAT: "صافي ضريبة المخرجات",
    purchases: "المشتريات",
    purchaseReturns: "مرتجعات المشتريات",
    netInputVAT: "صافي ضريبة المدخلات",
    outputVATSection: "ضريبة المخرجات (المبيعات)",
    inputVATSection: "ضريبة المدخلات (المشتريات)",
    totals: "الإجمالي",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
  },
};

const safeBrandColor = (bc?: string | null): string => (bc && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(bc) ? bc : "#0f172a");
const formatAmount = (n: number, c: string = "INR"): string => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); } catch { return n.toFixed(2); } };

const buildStyles = (brandColor: string, isRTL: boolean) =>
  StyleSheet.create({
    page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontSize: 9, fontFamily: ARABIC_FONT_FAMILY, color: "#0f172a", backgroundColor: "#ffffff" },
    headerBand: { backgroundColor: brandColor, borderRadius: 12, padding: 18, marginBottom: 18 },
    headerTop: { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start" },
    orgBlock: { width: "52%" },
    orgName: { fontSize: 18, fontWeight: "bold", color: "#ffffff", marginBottom: 4, textAlign: isRTL ? "right" : "left" },
    reportBlock: { width: "42%", alignItems: isRTL ? "flex-start" : "flex-end" },
    reportTitle: { fontSize: 16, fontWeight: "bold", color: "#ffffff", marginBottom: 3, textAlign: isRTL ? "left" : "right" },
    reportSubtitle: { fontSize: 9, color: "#dbeafe", marginBottom: 2, textAlign: isRTL ? "left" : "right" },
    heroStats: { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 18 },
    heroCard: { width: "31%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 10 },
    heroLabel: { fontSize: 8, color: "#64748b", marginBottom: 6, textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 12, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    heroValueGreen: { fontSize: 12, fontWeight: "bold", color: "#15803d", textAlign: isRTL ? "right" : "left" },
    heroValueBlue: { fontSize: 12, fontWeight: "bold", color: "#2563eb", textAlign: isRTL ? "right" : "left" },
    sectionTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 6, marginTop: 12, textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden", marginBottom: 14 },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    cellTextNeg: { fontSize: 7.8, color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colSection: { width: "40%", paddingRight: 4 },
    colTaxable: { width: "30%", textAlign: isRTL ? "left" : "right" },
    colVAT: { width: "30%", textAlign: isRTL ? "left" : "right" },
    netVATBar: { marginTop: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function VATSummaryPDF({ organization, data, fromDate, toDate, lang }: VATSummaryPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

  const outputRows = [
    { label: l.sales, taxable: data.sales.taxableAmount, vat: data.sales.vatAmount, isNeg: false },
    { label: l.salesReturns, taxable: -data.salesReturns.taxableAmount, vat: -data.salesReturns.vatAmount, isNeg: true },
  ];

  const inputRows = [
    { label: l.purchases, taxable: data.purchases.taxableAmount, vat: data.purchases.vatAmount, isNeg: false },
    { label: l.purchaseReturns, taxable: -data.purchaseReturns.taxableAmount, vat: -data.purchaseReturns.vatAmount, isNeg: true },
  ];

  const renderVATTable = (title: string, rows: typeof outputRows, netLabel: string, netTaxable: number, netVAT: number, color: string) => (
    <>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colSection]}>{l.section}</Text>
          <Text style={[styles.tableHeaderText, styles.colTaxable, styles.alignRight]}>{l.taxableAmount}</Text>
          <Text style={[styles.tableHeaderText, styles.colVAT, styles.alignRight]}>{l.vatAmount}</Text>
        </View>
        {rows.map((row, i) => (
          <View key={row.label} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
            <Text style={[row.isNeg ? styles.cellTextNeg : styles.cellText, styles.colSection]}>{row.label}</Text>
            <Text style={[row.isNeg ? styles.cellTextNeg : styles.cellText, styles.colTaxable, styles.alignRight]}>{formatAmount(row.taxable, currency)}</Text>
            <Text style={[row.isNeg ? styles.cellTextNeg : styles.cellText, styles.colVAT, styles.alignRight]}>{formatAmount(row.vat, currency)}</Text>
          </View>
        ))}
        <View style={styles.tableTotalsRow} wrap={false}>
          <Text style={[styles.cellTextBold, styles.colSection]}>{netLabel}</Text>
          <Text style={[styles.cellTextBold, styles.colTaxable, styles.alignRight, { color }]}>{formatAmount(netTaxable, currency)}</Text>
          <Text style={[styles.cellTextBold, styles.colVAT, styles.alignRight, { color }]}>{formatAmount(netVAT, currency)}</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerBand}>
          <View style={styles.headerTop}>
            <View style={styles.orgBlock}>
              <Text style={styles.orgName}>{isRTL ? organization.arabicName || organization.name : organization.name}</Text>
            </View>
            <View style={styles.reportBlock}>
              <Text style={styles.reportTitle}>{l.title}</Text>
              <Text style={styles.reportSubtitle}>{l.period}: {fromDate} {l.to} {toDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.outputVAT}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.netOutputVAT.vatAmount, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.inputVAT}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(data.netInputVAT.vatAmount, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netVATPayable}</Text>
            <Text style={data.netVATPayable >= 0 ? styles.heroValueRed : styles.heroValueGreen}>{formatAmount(data.netVATPayable, currency)}</Text>
          </View>
        </View>

        {renderVATTable(l.outputVATSection, outputRows, l.netOutputVAT, data.netOutputVAT.taxableAmount, data.netOutputVAT.vatAmount, "#dc2626")}
        {renderVATTable(l.inputVATSection, inputRows, l.netInputVAT, data.netInputVAT.taxableAmount, data.netInputVAT.vatAmount, "#15803d")}

        <View style={styles.netVATBar} wrap={false}>
          <Text style={{ fontSize: 11, fontWeight: "bold", fontFamily: ARABIC_FONT_FAMILY }}>{l.netVATPayable}</Text>
          <Text style={{ fontSize: 13, fontWeight: "bold", color: data.netVATPayable >= 0 ? "#dc2626" : "#15803d", fontFamily: ARABIC_FONT_FAMILY }}>{formatAmount(data.netVATPayable, currency)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{l.title} — {l.generatedOn} {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
