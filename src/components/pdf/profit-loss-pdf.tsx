import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { ProfitLossData } from "@/lib/reports/profit-loss";

interface ProfitLossPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: ProfitLossData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Profit & Loss",
    period: "Period",
    to: "to",
    revenue: "Revenue",
    expenses: "Expenses",
    totalRevenue: "Total Revenue",
    totalExpenses: "Total Expenses",
    netIncome: "Net Income",
    account: "Account",
    amount: "Amount",
    totals: "Totals",
    noData: "No data for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "الأرباح والخسائر",
    period: "الفترة",
    to: "إلى",
    revenue: "الإيرادات",
    expenses: "المصروفات",
    totalRevenue: "إجمالي الإيرادات",
    totalExpenses: "إجمالي المصروفات",
    netIncome: "صافي الدخل",
    account: "الحساب",
    amount: "المبلغ",
    totals: "الإجمالي",
    noData: "لا توجد بيانات لهذه الفترة.",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
  },
};

const safeBrandColor = (brandColor?: string | null): string => {
  if (brandColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor)) return brandColor;
  return "#0f172a";
};

const formatAmount = (amount: number, currency: string = "INR"): string => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch { return amount.toFixed(2); }
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
    heroValueGreen: { fontSize: 12, fontWeight: "bold", color: "#15803d", textAlign: isRTL ? "right" : "left" },
    heroValueRed: { fontSize: 12, fontWeight: "bold", color: "#dc2626", textAlign: isRTL ? "right" : "left" },
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
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colCode: { width: "12%", paddingRight: 4 },
    colName: { width: "58%", paddingRight: 4 },
    colAmount: { width: "30%", textAlign: isRTL ? "left" : "right" },
    netIncomeBar: { marginTop: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function ProfitLossPDF({ organization, data, fromDate, toDate, lang }: ProfitLossPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

  const renderSection = (title: string, rows: typeof data.revenue, total: number, color: string) => (
    <>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colCode]}>{""}</Text>
          <Text style={[styles.tableHeaderText, styles.colName]}>{l.account}</Text>
          <Text style={[styles.tableHeaderText, styles.colAmount, styles.alignRight]}>{l.amount}</Text>
        </View>
        {rows.map((row, i) => (
          <View key={row.account.code} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
            <Text style={[styles.cellText, styles.colCode]}>{row.account.code}</Text>
            <Text style={[styles.cellText, styles.colName]}>{row.account.name}</Text>
            <Text style={[styles.cellText, styles.colAmount, styles.alignRight]}>{formatAmount(row.amount, currency)}</Text>
          </View>
        ))}
        <View style={styles.tableTotalsRow} wrap={false}>
          <Text style={[styles.cellTextBold, { width: "70%", paddingRight: 4 }]}>{title}</Text>
          <Text style={[styles.cellTextBold, styles.colAmount, styles.alignRight, { color }]}>{formatAmount(total, currency)}</Text>
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
            <Text style={styles.heroLabel}>{l.totalRevenue}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(data.totalRevenue, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalExpenses}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.totalExpenses, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netIncome}</Text>
            <Text style={data.netIncome >= 0 ? styles.heroValueGreen : styles.heroValueRed}>{formatAmount(data.netIncome, currency)}</Text>
          </View>
        </View>

        {renderSection(l.revenue, data.revenue, data.totalRevenue, "#15803d")}
        {renderSection(l.expenses, data.expenses, data.totalExpenses, "#dc2626")}

        <View style={styles.netIncomeBar} wrap={false}>
          <Text style={{ fontSize: 11, fontWeight: "bold", fontFamily: ARABIC_FONT_FAMILY }}>{l.netIncome}</Text>
          <Text style={{ fontSize: 13, fontWeight: "bold", color: data.netIncome >= 0 ? "#15803d" : "#dc2626", fontFamily: ARABIC_FONT_FAMILY }}>{formatAmount(data.netIncome, currency)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{l.title} — {l.generatedOn} {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
