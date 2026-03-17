import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { SalesByItemData } from "@/lib/reports/sales-by-item";

interface SalesByItemPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: SalesByItemData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Sales by Item",
    period: "Period",
    to: "to",
    qtySold: "Qty Sold",
    revenue: "Revenue",
    cost: "Cost",
    profit: "Profit",
    margin: "Margin %",
    product: "Product",
    sku: "SKU",
    totals: "Totals",
    noData: "No sales data found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "المبيعات حسب الصنف",
    period: "الفترة",
    to: "إلى",
    qtySold: "الكمية المباعة",
    revenue: "الإيرادات",
    cost: "التكلفة",
    profit: "الربح",
    margin: "هامش الربح %",
    product: "المنتج",
    sku: "رمز المنتج",
    totals: "الإجمالي",
    noData: "لا توجد بيانات مبيعات لهذه الفترة.",
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
    heroCard: { width: "23.5%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 10 },
    heroLabel: { fontSize: 8, color: "#64748b", marginBottom: 6, textAlign: isRTL ? "right" : "left" },
    heroValue: { fontSize: 12, fontWeight: "bold", color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    heroValueGreen: { fontSize: 12, fontWeight: "bold", color: "#15803d", textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 12, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden" },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colProduct: { width: "22%", paddingRight: 4 },
    colSku: { width: "10%", paddingRight: 4 },
    colQty: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colRevenue: { width: "16%", textAlign: isRTL ? "left" : "right" },
    colCost: { width: "16%", textAlign: isRTL ? "left" : "right" },
    colProfit: { width: "16%", textAlign: isRTL ? "left" : "right" },
    colMargin: { width: "10%", textAlign: isRTL ? "left" : "right" },
    emptyState: { padding: 14, textAlign: "center", color: "#64748b", fontSize: 8.2 },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function SalesByItemPDF({ organization, data, fromDate, toDate, lang }: SalesByItemPDFProps) {
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
            <Text style={styles.heroLabel}>{l.qtySold}</Text>
            <Text style={styles.heroValue}>{data.totals.qtySold.toLocaleString("en-US")}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.revenue}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(data.totals.revenue, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.cost}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.totals.cost, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.profit}</Text>
            <Text style={data.totals.profit >= 0 ? styles.heroValueGreen : styles.heroValueRed}>
              {formatAmount(data.totals.profit, currency)}
            </Text>
          </View>
        </View>

        {data.rows.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noData}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colProduct]}>{l.product}</Text>
              <Text style={[styles.tableHeaderText, styles.colSku]}>{l.sku}</Text>
              <Text style={[styles.tableHeaderText, styles.colQty, styles.alignRight]}>{l.qtySold}</Text>
              <Text style={[styles.tableHeaderText, styles.colRevenue, styles.alignRight]}>{l.revenue}</Text>
              <Text style={[styles.tableHeaderText, styles.colCost, styles.alignRight]}>{l.cost}</Text>
              <Text style={[styles.tableHeaderText, styles.colProfit, styles.alignRight]}>{l.profit}</Text>
              <Text style={[styles.tableHeaderText, styles.colMargin, styles.alignRight]}>{l.margin}</Text>
            </View>
            {data.rows.map((row, i) => (
              <View key={row.productId} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.cellText, styles.colProduct]}>{row.productName}</Text>
                <Text style={[styles.cellText, styles.colSku]}>{row.sku || "-"}</Text>
                <Text style={[styles.cellText, styles.colQty, styles.alignRight]}>{row.qtySold}</Text>
                <Text style={[styles.cellText, styles.colRevenue, styles.alignRight]}>{formatAmount(row.revenue, currency)}</Text>
                <Text style={[styles.cellText, styles.colCost, styles.alignRight]}>{formatAmount(row.cost, currency)}</Text>
                <Text style={[styles.cellText, styles.colProfit, styles.alignRight, { color: row.profit >= 0 ? "#15803d" : "#dc2626" }]}>{formatAmount(row.profit, currency)}</Text>
                <Text style={[styles.cellText, styles.colMargin, styles.alignRight, { color: row.margin >= 0 ? "#15803d" : "#dc2626" }]}>{row.margin.toFixed(1)}%</Text>
              </View>
            ))}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, { width: "32%", paddingRight: 4 }]}>{l.totals} ({data.rows.length})</Text>
              <Text style={[styles.cellTextBold, styles.colQty, styles.alignRight]}>{data.totals.qtySold}</Text>
              <Text style={[styles.cellTextBold, styles.colRevenue, styles.alignRight]}>{formatAmount(data.totals.revenue, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colCost, styles.alignRight]}>{formatAmount(data.totals.cost, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colProfit, styles.alignRight, { color: data.totals.profit >= 0 ? "#15803d" : "#dc2626" }]}>{formatAmount(data.totals.profit, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colMargin, styles.alignRight, { color: data.totals.margin >= 0 ? "#15803d" : "#dc2626" }]}>{data.totals.margin.toFixed(1)}%</Text>
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
