import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { BalanceSheetData } from "@/lib/reports/balance-sheet";

interface BalanceSheetPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: BalanceSheetData;
  asOfDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Balance Sheet",
    asOf: "As of",
    assets: "Assets",
    liabilities: "Liabilities",
    equity: "Equity",
    totalAssets: "Total Assets",
    totalLiabilities: "Total Liabilities",
    totalEquity: "Total Equity",
    retainedEarnings: "Retained Earnings (computed)",
    totalLiabilitiesAndEquity: "Total Liabilities + Equity",
    account: "Account",
    balance: "Balance",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "الميزانية العمومية",
    asOf: "كما في",
    assets: "الأصول",
    liabilities: "الالتزامات",
    equity: "حقوق الملكية",
    totalAssets: "إجمالي الأصول",
    totalLiabilities: "إجمالي الالتزامات",
    totalEquity: "إجمالي حقوق الملكية",
    retainedEarnings: "الأرباح المحتجزة (محسوبة)",
    totalLiabilitiesAndEquity: "إجمالي الالتزامات + حقوق الملكية",
    account: "الحساب",
    balance: "الرصيد",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
  },
};

const safeBrandColor = (brandColor?: string | null): string => {
  if (brandColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor)) return brandColor;
  return "#0f172a";
};

const formatAmount = (amount: number, currency: string = "INR"): string => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount); }
  catch { return amount.toFixed(2); }
};

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
    heroValueBlue: { fontSize: 12, fontWeight: "bold", color: "#2563eb", textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 12, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
    heroValuePurple: { fontSize: 12, fontWeight: "bold", color: "#7c3aed", textAlign: isRTL ? "right" : "left" },
    sectionTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 6, marginTop: 12, textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden", marginBottom: 10 },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    cellItalic: { fontSize: 7.8, color: "#64748b", fontStyle: "italic", textAlign: isRTL ? "right" : "left" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colCode: { width: "12%", paddingRight: 4 },
    colName: { width: "58%", paddingRight: 4 },
    colBalance: { width: "30%", textAlign: isRTL ? "left" : "right" },
    summaryBar: { marginTop: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-around" },
    summaryItem: { alignItems: "center" },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function BalanceSheetPDF({ organization, data, asOfDate, lang }: BalanceSheetPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

  const renderSection = (title: string, rows: typeof data.assets, total: number, color: string, extraRows?: { label: string; amount: number }[]) => (
    <>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colCode]}>{""}</Text>
          <Text style={[styles.tableHeaderText, styles.colName]}>{l.account}</Text>
          <Text style={[styles.tableHeaderText, styles.colBalance, styles.alignRight]}>{l.balance}</Text>
        </View>
        {rows.map((row, i) => (
          <View key={row.account.code} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
            <Text style={[styles.cellText, styles.colCode]}>{row.account.code}</Text>
            <Text style={[styles.cellText, styles.colName]}>{row.account.name}</Text>
            <Text style={[styles.cellText, styles.colBalance, styles.alignRight]}>{formatAmount(row.balance, currency)}</Text>
          </View>
        ))}
        {extraRows?.map((er, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={[styles.cellItalic, { width: "70%", paddingRight: 4 }]}>{er.label}</Text>
            <Text style={[styles.cellItalic, styles.colBalance, styles.alignRight]}>{formatAmount(er.amount, currency)}</Text>
          </View>
        ))}
        <View style={styles.tableTotalsRow} wrap={false}>
          <Text style={[styles.cellTextBold, { width: "70%", paddingRight: 4 }]}>{title}</Text>
          <Text style={[styles.cellTextBold, styles.colBalance, styles.alignRight, { color }]}>{formatAmount(total, currency)}</Text>
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
              <Text style={styles.reportSubtitle}>{l.asOf}: {asOfDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalAssets}</Text>
            <Text style={styles.heroValueBlue}>{formatAmount(data.totalAssets, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalLiabilities}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.totalLiabilities, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalEquity}</Text>
            <Text style={styles.heroValuePurple}>{formatAmount(data.totalEquity, currency)}</Text>
          </View>
        </View>

        {renderSection(l.assets, data.assets, data.totalAssets, "#2563eb")}
        {renderSection(l.liabilities, data.liabilities, data.totalLiabilities, "#dc2626")}
        {renderSection(l.equity, data.equity, data.totalEquity, "#7c3aed", [
          { label: l.retainedEarnings, amount: data.retainedEarnings },
        ])}

        <View style={styles.summaryBar} wrap={false}>
          <View style={styles.summaryItem}>
            <Text style={{ fontSize: 8, color: "#64748b", fontFamily: ARABIC_FONT_FAMILY }}>{l.totalAssets}</Text>
            <Text style={{ fontSize: 11, fontWeight: "bold", fontFamily: ARABIC_FONT_FAMILY }}>{formatAmount(data.totalAssets, currency)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={{ fontSize: 8, color: "#64748b", fontFamily: ARABIC_FONT_FAMILY }}>{l.totalLiabilitiesAndEquity}</Text>
            <Text style={{ fontSize: 11, fontWeight: "bold", fontFamily: ARABIC_FONT_FAMILY }}>{formatAmount(data.totalLiabilitiesAndEquity, currency)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{l.title} — {l.generatedOn} {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
