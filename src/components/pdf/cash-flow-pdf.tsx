import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { CashFlowData } from "@/lib/reports/cash-flow";

interface CashFlowPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: CashFlowData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Cash Flow Statement",
    period: "Period",
    to: "to",
    totalInflow: "Total Inflow",
    totalOutflow: "Total Outflow",
    netCashFlow: "Net Cash Flow",
    category: "Category",
    inflow: "Inflow",
    outflow: "Outflow",
    net: "Net",
    count: "Count",
    totals: "Totals",
    noData: "No cash flow data for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "قائمة التدفقات النقدية",
    period: "الفترة",
    to: "إلى",
    totalInflow: "إجمالي الوارد",
    totalOutflow: "إجمالي الصادر",
    netCashFlow: "صافي التدفق النقدي",
    category: "الفئة",
    inflow: "وارد",
    outflow: "صادر",
    net: "الصافي",
    count: "العدد",
    totals: "الإجمالي",
    noData: "لا توجد بيانات تدفق نقدي لهذه الفترة.",
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
    heroValueGreen: { fontSize: 12, fontWeight: "bold", color: "#15803d", textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 12, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    heroValueBlue: { fontSize: 12, fontWeight: "bold", color: "#2563eb", textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden" },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    cellGreen: { fontSize: 7.8, color: "#15803d", textAlign: isRTL ? "left" : "right" },
    cellRed: { fontSize: 7.8, color: "#dc2626", textAlign: isRTL ? "left" : "right" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colCategory: { width: "28%", paddingRight: 4 },
    colInflow: { width: "20%", textAlign: isRTL ? "left" : "right" },
    colOutflow: { width: "20%", textAlign: isRTL ? "left" : "right" },
    colNet: { width: "20%", textAlign: isRTL ? "left" : "right" },
    colCount: { width: "12%", textAlign: isRTL ? "left" : "right" },
    emptyState: { padding: 14, textAlign: "center", color: "#64748b", fontSize: 8.2 },
    netCashFlowBar: { marginTop: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function CashFlowPDF({ organization, data, fromDate, toDate, lang }: CashFlowPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

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
            <Text style={styles.heroLabel}>{l.totalInflow}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(data.totalInflow, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalOutflow}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.totalOutflow, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netCashFlow}</Text>
            <Text style={data.netCashFlow >= 0 ? styles.heroValueGreen : styles.heroValueRed}>{formatAmount(data.netCashFlow, currency)}</Text>
          </View>
        </View>

        {data.summary.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noData}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colCategory]}>{l.category}</Text>
              <Text style={[styles.tableHeaderText, styles.colInflow, styles.alignRight]}>{l.inflow}</Text>
              <Text style={[styles.tableHeaderText, styles.colOutflow, styles.alignRight]}>{l.outflow}</Text>
              <Text style={[styles.tableHeaderText, styles.colNet, styles.alignRight]}>{l.net}</Text>
              <Text style={[styles.tableHeaderText, styles.colCount, styles.alignRight]}>{l.count}</Text>
            </View>
            {data.summary.map((row, i) => (
              <View key={row.type} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.cellText, styles.colCategory]}>{row.type}</Text>
                <Text style={[styles.cellGreen, styles.colInflow, styles.alignRight]}>{row.inflow > 0 ? formatAmount(row.inflow, currency) : "-"}</Text>
                <Text style={[styles.cellRed, styles.colOutflow, styles.alignRight]}>{row.outflow > 0 ? formatAmount(row.outflow, currency) : "-"}</Text>
                <Text style={[styles.cellText, styles.colNet, styles.alignRight, { color: row.net >= 0 ? "#15803d" : "#dc2626" }]}>{formatAmount(row.net, currency)}</Text>
                <Text style={[styles.cellText, styles.colCount, styles.alignRight]}>{row.count}</Text>
              </View>
            ))}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, styles.colCategory]}>{l.totals}</Text>
              <Text style={[styles.cellTextBold, styles.colInflow, styles.alignRight, { color: "#15803d" }]}>{formatAmount(data.totalInflow, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colOutflow, styles.alignRight, { color: "#dc2626" }]}>{formatAmount(data.totalOutflow, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colNet, styles.alignRight, { color: data.netCashFlow >= 0 ? "#15803d" : "#dc2626" }]}>{formatAmount(data.netCashFlow, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colCount, styles.alignRight]}>{data.transactionCount}</Text>
            </View>
          </View>
        )}

        <View style={styles.netCashFlowBar} wrap={false}>
          <Text style={{ fontSize: 11, fontWeight: "bold", fontFamily: ARABIC_FONT_FAMILY }}>{l.netCashFlow}</Text>
          <Text style={{ fontSize: 13, fontWeight: "bold", color: data.netCashFlow >= 0 ? "#15803d" : "#dc2626", fontFamily: ARABIC_FONT_FAMILY }}>{formatAmount(data.netCashFlow, currency)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{l.title} — {l.generatedOn} {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
