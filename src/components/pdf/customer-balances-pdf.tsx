import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { CustomerBalancesData } from "@/lib/reports/customer-balances";

interface CustomerBalancesPDFProps {
  organization: { name: string; arabicName?: string | null; brandColor?: string | null; currency?: string | null };
  data: CustomerBalancesData;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Customer Balances",
    totalCustomers: "Total Customers",
    totalReceivable: "Total Receivable",
    totalAdvances: "Total Advances",
    netBalance: "Net Balance",
    name: "Name",
    email: "Email",
    phone: "Phone",
    balance: "Balance",
    invoices: "Invoices",
    status: "Status",
    totals: "Totals",
    active: "Active",
    inactive: "Inactive",
    noData: "No customer data found.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "أرصدة العملاء",
    totalCustomers: "إجمالي العملاء",
    totalReceivable: "إجمالي المستحقات",
    totalAdvances: "إجمالي السلف",
    netBalance: "صافي الرصيد",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    balance: "الرصيد",
    invoices: "الفواتير",
    status: "الحالة",
    totals: "الإجمالي",
    active: "نشط",
    inactive: "غير نشط",
    noData: "لا توجد بيانات عملاء.",
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
    heroStats: { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 18 },
    heroCard: { width: "23.5%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 10, padding: 10 },
    heroLabel: { fontSize: 8, color: "#64748b", marginBottom: 6, textAlign: isRTL ? "right" : "left" },
    heroValue: { fontSize: 12, fontWeight: "bold", color: "#0f172a", textAlign: isRTL ? "right" : "left" },
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
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colName: { width: "22%", paddingRight: 4 },
    colEmail: { width: "22%", paddingRight: 4 },
    colPhone: { width: "14%", paddingRight: 4 },
    colBalance: { width: "18%", textAlign: isRTL ? "left" : "right" },
    colInvoices: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colStatus: { width: "14%", paddingRight: 4 },
    emptyState: { padding: 14, textAlign: "center", color: "#64748b", fontSize: 8.2 },
    footer: { position: "absolute", left: 28, right: 28, bottom: 14, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", fontSize: 7.2, color: "#64748b" },
  });

export function CustomerBalancesPDF({ organization, data, lang }: CustomerBalancesPDFProps) {
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
            </View>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalCustomers}</Text>
            <Text style={styles.heroValue}>{data.summary.totalCustomers}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalReceivable}</Text>
            <Text style={styles.heroValueRed}>{formatAmount(data.summary.totalReceivable, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalAdvances}</Text>
            <Text style={styles.heroValueGreen}>{formatAmount(data.summary.totalAdvances, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netBalance}</Text>
            <Text style={styles.heroValueBlue}>{formatAmount(data.summary.netBalance, currency)}</Text>
          </View>
        </View>

        {data.customers.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noData}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colName]}>{l.name}</Text>
              <Text style={[styles.tableHeaderText, styles.colEmail]}>{l.email}</Text>
              <Text style={[styles.tableHeaderText, styles.colPhone]}>{l.phone}</Text>
              <Text style={[styles.tableHeaderText, styles.colBalance, styles.alignRight]}>{l.balance}</Text>
              <Text style={[styles.tableHeaderText, styles.colInvoices, styles.alignRight]}>{l.invoices}</Text>
              <Text style={[styles.tableHeaderText, styles.colStatus]}>{l.status}</Text>
            </View>
            {data.customers.map((row, i) => (
              <View key={row.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.cellText, styles.colName]}>{row.name}</Text>
                <Text style={[styles.cellText, styles.colEmail]}>{row.email || "-"}</Text>
                <Text style={[styles.cellText, styles.colPhone]}>{row.phone || "-"}</Text>
                <Text style={[styles.cellText, styles.colBalance, styles.alignRight, { color: row.balance > 0 ? "#dc2626" : row.balance < 0 ? "#15803d" : "#0f172a" }]}>{formatAmount(row.balance, currency)}</Text>
                <Text style={[styles.cellText, styles.colInvoices, styles.alignRight]}>{row.invoiceCount}</Text>
                <Text style={[styles.cellText, styles.colStatus, { color: row.isActive ? "#15803d" : "#64748b" }]}>{row.isActive ? l.active : l.inactive}</Text>
              </View>
            ))}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, { width: "58%", paddingRight: 4 }]}>{l.totals} ({data.summary.totalCustomers})</Text>
              <Text style={[styles.cellTextBold, styles.colBalance, styles.alignRight]}>{formatAmount(data.summary.netBalance, currency)}</Text>
              <Text style={[styles.cellTextBold, styles.colInvoices, styles.alignRight]}>{""}</Text>
              <Text style={[styles.cellTextBold, styles.colStatus]}>{""}</Text>
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
