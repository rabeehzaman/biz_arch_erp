import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { ARAgingData } from "@/lib/reports/ar-aging";

interface ARAgingPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: ARAgingData;
  asOfDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Accounts Receivable Aging",
    asOf: "As of",
    current: "Current",
    days1to30: "1-30 Days",
    days31to60: "31-60 Days",
    days61to90: "61-90 Days",
    over90: "90+ Days",
    total: "Total",
    customer: "Customer",
    totals: "Totals",
    noData: "No outstanding receivables.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "تقادم الذمم المدينة",
    asOf: "كما في",
    current: "جاري",
    days1to30: "١-٣٠ يوم",
    days31to60: "٣١-٦٠ يوم",
    days61to90: "٦١-٩٠ يوم",
    over90: "٩٠+ يوم",
    total: "الإجمالي",
    customer: "العميل",
    totals: "الإجمالي",
    noData: "لا توجد مستحقات معلقة.",
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
    heroStats: { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 6 },
    heroCard: { width: "18%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 8 },
    heroCardWide: { width: "18%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 8 },
    heroLabel: { fontSize: 7, color: "#64748b", marginBottom: 4, textAlign: isRTL ? "right" : "left" },
    heroValue: { fontSize: 10, fontWeight: "bold", color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    heroValueGreen: { fontSize: 10, fontWeight: "bold", color: "#15803d", textAlign: isRTL ? "right" : "left" },
    heroValueAmber: { fontSize: 10, fontWeight: "bold", color: "#d97706", textAlign: isRTL ? "right" : "left" },
    heroValueOrange: { fontSize: 10, fontWeight: "bold", color: "#ea580c", textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 10, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    heroValueDarkRed: { fontSize: 10, fontWeight: "bold", color: "#991b1b", textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden" },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colCustomer: { width: "22%", paddingRight: 4 },
    colCurrent: { width: "13%", textAlign: isRTL ? "left" : "right" },
    col1to30: { width: "13%", textAlign: isRTL ? "left" : "right" },
    col31to60: { width: "13%", textAlign: isRTL ? "left" : "right" },
    col61to90: { width: "13%", textAlign: isRTL ? "left" : "right" },
    colOver90: { width: "13%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "13%", textAlign: isRTL ? "left" : "right" },
    emptyState: { padding: 14, textAlign: "center", color: "#64748b", fontSize: 8.2 },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function ARAgingPDF({ organization, data, asOfDate, lang }: ARAgingPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.headerBand}>
          <View style={styles.headerTop}>
            <View style={styles.orgBlock}>
              <Text style={styles.orgName}>{isRTL ? organization.arabicName || organization.name : organization.name}</Text>
            </View>
            <View style={styles.reportBlock}>
              <Text style={styles.reportTitle}>{l.title}</Text>
              <Text style={styles.reportSubtitle}>{l.asOf}: {asOfDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.current}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(data.totals.current, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.days1to30}</Text>
            <Text style={styles.heroValueAmber}>{formatAmount(data.totals.days1to30, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.days31to60}</Text>
            <Text style={styles.heroValueOrange}>{formatAmount(data.totals.days31to60, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.days61to90}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.totals.days61to90, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.over90}</Text>
            <Text style={styles.heroValueDarkRed}>{formatAmount(data.totals.over90, currency)}</Text>
          </View>
        </View>

        {data.customers.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noData}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colCustomer]}>{l.customer}</Text>
              <Text style={[styles.tableHeaderText, styles.colCurrent, styles.alignRight]}>{l.current}</Text>
              <Text style={[styles.tableHeaderText, styles.col1to30, styles.alignRight]}>{l.days1to30}</Text>
              <Text style={[styles.tableHeaderText, styles.col31to60, styles.alignRight]}>{l.days31to60}</Text>
              <Text style={[styles.tableHeaderText, styles.col61to90, styles.alignRight]}>{l.days61to90}</Text>
              <Text style={[styles.tableHeaderText, styles.colOver90, styles.alignRight]}>{l.over90}</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal, styles.alignRight]}>{l.total}</Text>
            </View>
            {data.customers.map((row, i) => (
              <View key={row.customerId} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.cellText, styles.colCustomer]}>{row.customerName}</Text>
                <Text style={[styles.cellText, styles.colCurrent, styles.alignRight]}>{row.buckets.current > 0 ? formatAmount(row.buckets.current, currency) : "-"}</Text>
                <Text style={[styles.cellText, styles.col1to30, styles.alignRight]}>{row.buckets.days1to30 > 0 ? formatAmount(row.buckets.days1to30, currency) : "-"}</Text>
                <Text style={[styles.cellText, styles.col31to60, styles.alignRight]}>{row.buckets.days31to60 > 0 ? formatAmount(row.buckets.days31to60, currency) : "-"}</Text>
                <Text style={[styles.cellText, styles.col61to90, styles.alignRight]}>{row.buckets.days61to90 > 0 ? formatAmount(row.buckets.days61to90, currency) : "-"}</Text>
                <Text style={[styles.cellText, styles.colOver90, styles.alignRight]}>{row.buckets.over90 > 0 ? formatAmount(row.buckets.over90, currency) : "-"}</Text>
                <Text style={[styles.cellTextBold, styles.colTotal, styles.alignRight]}>{formatAmount(row.buckets.total, currency)}</Text>
              </View>
            ))}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, styles.colCustomer]}>{l.totals}</Text>
              <Text style={[styles.cellTextBold, styles.colCurrent, styles.alignRight]}>{formatAmount(data.totals.current, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.col1to30, styles.alignRight]}>{formatAmount(data.totals.days1to30, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.col31to60, styles.alignRight]}>{formatAmount(data.totals.days31to60, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.col61to90, styles.alignRight]}>{formatAmount(data.totals.days61to90, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colOver90, styles.alignRight]}>{formatAmount(data.totals.over90, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colTotal, styles.alignRight]}>{formatAmount(data.totals.total, currency)}</Text>
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{l.title} — {l.generatedOn} {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
