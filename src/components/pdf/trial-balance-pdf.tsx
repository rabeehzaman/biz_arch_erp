import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { TrialBalanceData } from "@/lib/reports/trial-balance";

interface TrialBalancePDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: TrialBalanceData;
  asOfDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: { title: "Trial Balance", asOf: "As of", code: "Code", account: "Account", type: "Type", debit: "Debit", credit: "Credit", totals: "Totals", balanced: "Balanced", unbalanced: "Unbalanced", page: "Page", generatedOn: "Generated on" },
  ar: { title: "ميزان المراجعة", asOf: "كما في", code: "الرمز", account: "الحساب", type: "النوع", debit: "مدين", credit: "دائن", totals: "الإجمالي", balanced: "متوازن", unbalanced: "غير متوازن", page: "صفحة", generatedOn: "تاريخ الإنشاء" },
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
    badge: { marginBottom: 14, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: isRTL ? "flex-end" : "flex-start" },
    heroStats: { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 18 },
    heroCard: { width: "48%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 10 },
    heroLabel: { fontSize: 8, color: "#64748b", marginBottom: 6, textAlign: isRTL ? "right" : "left" },
    heroValue: { fontSize: 12, fontWeight: "bold", color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden" },
    tableHeader: { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: brandColor, paddingVertical: 8, paddingHorizontal: 8 },
    tableHeaderText: { color: "#ffffff", fontSize: 7.4, fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    tableRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
    tableRowAlt: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    tableTotalsRow: { flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 2, borderTopColor: brandColor, backgroundColor: "#f1f5f9" },
    cellText: { fontSize: 7.8, color: "#0f172a", textAlign: isRTL ? "right" : "left" },
    cellTextBold: { fontSize: 7.8, color: "#0f172a", fontWeight: "bold", textAlign: isRTL ? "right" : "left" },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colCode: { width: "10%", paddingRight: 4 },
    colName: { width: "35%", paddingRight: 4 },
    colType: { width: "15%", paddingRight: 4 },
    colDebit: { width: "20%", textAlign: isRTL ? "left" : "right" },
    colCredit: { width: "20%", textAlign: isRTL ? "left" : "right" },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function TrialBalancePDF({ organization, data, asOfDate, lang }: TrialBalancePDFProps) {
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
              <Text style={styles.reportSubtitle}>{l.asOf}: {asOfDate}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: data.isBalanced ? "#dcfce7" : "#fee2e2" }]}>
          <Text style={{ fontSize: 8, fontWeight: "bold", color: data.isBalanced ? "#15803d" : "#dc2626", fontFamily: ARABIC_FONT_FAMILY }}>{data.isBalanced ? l.balanced : l.unbalanced}</Text>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.debit}</Text>
            <Text style={styles.heroValue}>{formatAmount(data.totalDebit, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.credit}</Text>
            <Text style={styles.heroValue}>{formatAmount(data.totalCredit, currency)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colCode]}>{l.code}</Text>
            <Text style={[styles.tableHeaderText, styles.colName]}>{l.account}</Text>
            <Text style={[styles.tableHeaderText, styles.colType]}>{l.type}</Text>
            <Text style={[styles.tableHeaderText, styles.colDebit, styles.alignRight]}>{l.debit}</Text>
            <Text style={[styles.tableHeaderText, styles.colCredit, styles.alignRight]}>{l.credit}</Text>
          </View>
          {data.accounts.map((row, i) => (
            <View key={row.account.code} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
              <Text style={[styles.cellText, styles.colCode]}>{row.account.code}</Text>
              <Text style={[styles.cellText, styles.colName]}>{row.account.name}</Text>
              <Text style={[styles.cellText, styles.colType]}>{row.account.accountType}</Text>
              <Text style={[styles.cellText, styles.colDebit, styles.alignRight]}>{row.debit > 0 ? formatAmount(row.debit, currency) : "-"}</Text>
              <Text style={[styles.cellText, styles.colCredit, styles.alignRight]}>{row.credit > 0 ? formatAmount(row.credit, currency) : "-"}</Text>
            </View>
          ))}
          <View style={styles.tableTotalsRow} wrap={false}>
            <Text style={[styles.cellTextBold, { width: "60%", paddingRight: 4 }]}>{l.totals}</Text>
            <Text style={[styles.cellTextBold, styles.colDebit, styles.alignRight]}>{formatAmount(data.totalDebit, currency)}</Text>
            <Text style={[styles.cellTextBold, styles.colCredit, styles.alignRight]}>{formatAmount(data.totalCredit, currency)}</Text>
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
