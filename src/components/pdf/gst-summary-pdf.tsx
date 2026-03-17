import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";

interface GSTSection {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GSTSummaryData {
  sales: GSTSection;
  salesReturns: GSTSection;
  purchases: GSTSection;
  purchaseReturns: GSTSection;
  netOutputGST: GSTSection;
  netInputGST: GSTSection;
  totalLiability: { cgst: number; sgst: number; igst: number };
}

interface GSTSummaryPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: GSTSummaryData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "GST Summary",
    period: "Period",
    to: "to",
    outputGST: "Output GST",
    inputGST: "Input GST",
    totalLiability: "Total GST Liability",
    section: "Section",
    taxableAmount: "Taxable Amount",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    totalGST: "Total GST",
    sales: "Sales",
    salesReturns: "Sales Returns",
    netOutputGST: "Net Output GST",
    purchases: "Purchases",
    purchaseReturns: "Purchase Returns",
    netInputGST: "Net Input GST",
    outputGSTSection: "Output GST (Sales)",
    inputGSTSection: "Input GST (Purchases)",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "ملخص ضريبة السلع والخدمات",
    period: "الفترة",
    to: "إلى",
    outputGST: "ضريبة المخرجات",
    inputGST: "ضريبة المدخلات",
    totalLiability: "إجمالي الالتزام الضريبي",
    section: "القسم",
    taxableAmount: "المبلغ الخاضع للضريبة",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    totalGST: "إجمالي الضريبة",
    sales: "المبيعات",
    salesReturns: "مرتجعات المبيعات",
    netOutputGST: "صافي ضريبة المخرجات",
    purchases: "المشتريات",
    purchaseReturns: "مرتجعات المشتريات",
    netInputGST: "صافي ضريبة المدخلات",
    outputGSTSection: "ضريبة المخرجات (المبيعات)",
    inputGSTSection: "ضريبة المدخلات (المشتريات)",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
  },
};

const safeBrandColor = (bc?: string | null): string => (bc && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(bc) ? bc : "#0f172a");
const formatAmount = (n: number, c: string = "INR"): string => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); } catch { return n.toFixed(2); } };

const gstTotal = (s: GSTSection) => s.cgst + s.sgst + s.igst;

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
    colSection: { width: "22%", paddingRight: 4 },
    colTaxable: { width: "20%", textAlign: isRTL ? "left" : "right" },
    colCGST: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colSGST: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colIGST: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colTotalGST: { width: "16%", textAlign: isRTL ? "left" : "right" },
    liabilityBar: { marginTop: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function GSTSummaryPDF({ organization, data, fromDate, toDate, lang }: GSTSummaryPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

  const outputRows = [
    { label: l.sales, section: data.sales, isNeg: false },
    { label: l.salesReturns, section: data.salesReturns, isNeg: true },
  ];

  const inputRows = [
    { label: l.purchases, section: data.purchases, isNeg: false },
    { label: l.purchaseReturns, section: data.purchaseReturns, isNeg: true },
  ];

  const renderGSTTable = (title: string, rows: typeof outputRows, netLabel: string, netSection: GSTSection, color: string) => (
    <>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colSection]}>{l.section}</Text>
          <Text style={[styles.tableHeaderText, styles.colTaxable, styles.alignRight]}>{l.taxableAmount}</Text>
          <Text style={[styles.tableHeaderText, styles.colCGST, styles.alignRight]}>{l.cgst}</Text>
          <Text style={[styles.tableHeaderText, styles.colSGST, styles.alignRight]}>{l.sgst}</Text>
          <Text style={[styles.tableHeaderText, styles.colIGST, styles.alignRight]}>{l.igst}</Text>
          <Text style={[styles.tableHeaderText, styles.colTotalGST, styles.alignRight]}>{l.totalGST}</Text>
        </View>
        {rows.map((row, i) => {
          const sign = row.isNeg ? -1 : 1;
          const cellStyle = row.isNeg ? styles.cellTextNeg : styles.cellText;
          return (
            <View key={row.label} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
              <Text style={[cellStyle, styles.colSection]}>{row.label}</Text>
              <Text style={[cellStyle, styles.colTaxable, styles.alignRight]}>{formatAmount(sign * row.section.taxableAmount, currency)}</Text>
              <Text style={[cellStyle, styles.colCGST, styles.alignRight]}>{formatAmount(sign * row.section.cgst, currency)}</Text>
              <Text style={[cellStyle, styles.colSGST, styles.alignRight]}>{formatAmount(sign * row.section.sgst, currency)}</Text>
              <Text style={[cellStyle, styles.colIGST, styles.alignRight]}>{formatAmount(sign * row.section.igst, currency)}</Text>
              <Text style={[cellStyle, styles.colTotalGST, styles.alignRight]}>{formatAmount(sign * gstTotal(row.section), currency)}</Text>
            </View>
          );
        })}
        <View style={styles.tableTotalsRow} wrap={false}>
          <Text style={[styles.cellTextBold, styles.colSection]}>{netLabel}</Text>
          <Text style={[styles.cellTextBold, styles.colTaxable, styles.alignRight, { color }]}>{formatAmount(netSection.taxableAmount, currency)}</Text>
          <Text style={[styles.cellTextBold, styles.colCGST, styles.alignRight, { color }]}>{formatAmount(netSection.cgst, currency)}</Text>
          <Text style={[styles.cellTextBold, styles.colSGST, styles.alignRight, { color }]}>{formatAmount(netSection.sgst, currency)}</Text>
          <Text style={[styles.cellTextBold, styles.colIGST, styles.alignRight, { color }]}>{formatAmount(netSection.igst, currency)}</Text>
          <Text style={[styles.cellTextBold, styles.colTotalGST, styles.alignRight, { color }]}>{formatAmount(gstTotal(netSection), currency)}</Text>
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
            <Text style={styles.heroLabel}>{l.outputGST}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(gstTotal(data.netOutputGST), currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.inputGST}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(gstTotal(data.netInputGST), currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalLiability}</Text>
            <Text style={(data.totalLiability.cgst + data.totalLiability.sgst + data.totalLiability.igst) >= 0 ? styles.heroValueRed : styles.heroValueGreen}>{formatAmount(data.totalLiability.cgst + data.totalLiability.sgst + data.totalLiability.igst, currency)}</Text>
          </View>
        </View>

        {renderGSTTable(l.outputGSTSection, outputRows, l.netOutputGST, data.netOutputGST, "#dc2626")}
        {renderGSTTable(l.inputGSTSection, inputRows, l.netInputGST, data.netInputGST, "#15803d")}

        <View style={styles.liabilityBar} wrap={false}>
          <Text style={{ fontSize: 11, fontWeight: "bold", fontFamily: ARABIC_FONT_FAMILY }}>{l.totalLiability}</Text>
          <Text style={{ fontSize: 13, fontWeight: "bold", color: (data.totalLiability.cgst + data.totalLiability.sgst + data.totalLiability.igst) >= 0 ? "#dc2626" : "#15803d", fontFamily: ARABIC_FONT_FAMILY }}>{formatAmount(data.totalLiability.cgst + data.totalLiability.sgst + data.totalLiability.igst, currency)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{l.title} — {l.generatedOn} {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
