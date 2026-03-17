import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { PurchasesByItemData } from "@/lib/reports/purchases-by-item";

interface PurchasesByItemPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: PurchasesByItemData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Purchases by Item",
    period: "Period",
    to: "to",
    qtyPurchased: "Qty Purchased",
    amount: "Amount",
    tax: "Tax",
    total: "Total",
    product: "Product",
    sku: "SKU",
    totals: "Totals",
    noData: "No purchase data found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "المشتريات حسب الصنف",
    period: "الفترة",
    to: "إلى",
    qtyPurchased: "الكمية المشتراة",
    amount: "المبلغ",
    tax: "الضريبة",
    total: "الإجمالي",
    product: "المنتج",
    sku: "رمز المنتج",
    totals: "الإجمالي",
    noData: "لا توجد بيانات مشتريات لهذه الفترة.",
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
    heroValue: { fontSize: 12, fontWeight: "bold", color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 12, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    heroValueSlate: { fontSize: 12, fontWeight: "bold", color: "#475569", textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden" },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colProduct: { width: "26%", paddingRight: 4 },
    colSku: { width: "12%", paddingRight: 4 },
    colQty: { width: "12%", textAlign: isRTL ? "left" : "right" },
    colAmount: { width: "18%", textAlign: isRTL ? "left" : "right" },
    colTax: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "18%", textAlign: isRTL ? "left" : "right" },
    emptyState: { padding: 14, textAlign: "center", color: "#64748b", fontSize: 8.2 },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function PurchasesByItemPDF({ organization, data, fromDate, toDate, lang }: PurchasesByItemPDFProps) {
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
            <Text style={styles.heroLabel}>{l.qtyPurchased}</Text>
            <Text style={styles.heroValue}>{data.totals.qtyPurchased.toLocaleString("en-US")}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.amount}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.totals.amount, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.tax}</Text>
            <Text style={styles.heroValueSlate}>{formatAmount(data.totals.tax, currency)}</Text>
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
              <Text style={[styles.tableHeaderText, styles.colQty, styles.alignRight]}>{l.qtyPurchased}</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount, styles.alignRight]}>{l.amount}</Text>
              <Text style={[styles.tableHeaderText, styles.colTax, styles.alignRight]}>{l.tax}</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal, styles.alignRight]}>{l.total}</Text>
            </View>
            {data.rows.map((row, i) => (
              <View key={row.productId} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.cellText, styles.colProduct]}>{row.productName}</Text>
                <Text style={[styles.cellText, styles.colSku]}>{row.sku || "-"}</Text>
                <Text style={[styles.cellText, styles.colQty, styles.alignRight]}>{row.qtyPurchased}</Text>
                <Text style={[styles.cellText, styles.colAmount, styles.alignRight]}>{formatAmount(row.amount, currency)}</Text>
                <Text style={[styles.cellText, styles.colTax, styles.alignRight]}>{formatAmount(row.tax, currency)}</Text>
                <Text style={[styles.cellText, styles.colTotal, styles.alignRight]}>{formatAmount(row.total, currency)}</Text>
              </View>
            ))}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, { width: "38%", paddingRight: 4 }]}>{l.totals} ({data.rows.length})</Text>
              <Text style={[styles.cellTextBold, styles.colQty, styles.alignRight]}>{data.totals.qtyPurchased}</Text>
              <Text style={[styles.cellTextBold, styles.colAmount, styles.alignRight]}>{formatAmount(data.totals.amount, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colTax, styles.alignRight]}>{formatAmount(data.totals.tax, currency)}</Text>
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
