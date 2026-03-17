import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { LedgerData } from "@/lib/reports/ledger";

interface LedgerPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: LedgerData;
  fromDate?: string;
  toDate?: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    ledger: "Ledger",
    accountLedger: "Account Ledger",
    customerLedger: "Customer Ledger",
    supplierLedger: "Supplier Ledger",
    period: "Period",
    to: "to",
    allTime: "All Time",
    openingBalance: "Opening Balance",
    closingBalance: "Closing Balance",
    totalDebit: "Total Debit",
    totalCredit: "Total Credit",
    date: "Date",
    reference: "Reference",
    description: "Description",
    debit: "Debit",
    credit: "Credit",
    balance: "Balance",
    totals: "Totals",
    noTransactions: "No transactions found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    ledger: "دفتر الأستاذ",
    accountLedger: "دفتر أستاذ الحساب",
    customerLedger: "دفتر أستاذ العميل",
    supplierLedger: "دفتر أستاذ المورد",
    period: "الفترة",
    to: "إلى",
    allTime: "جميع الفترات",
    openingBalance: "الرصيد الافتتاحي",
    closingBalance: "الرصيد الختامي",
    totalDebit: "إجمالي المدين",
    totalCredit: "إجمالي الدائن",
    date: "التاريخ",
    reference: "المرجع",
    description: "الوصف",
    debit: "مدين",
    credit: "دائن",
    balance: "الرصيد",
    totals: "الإجمالي",
    noTransactions: "لا توجد معاملات لهذه الفترة.",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
  },
};

const safeBrandColor = (brandColor?: string | null): string => {
  if (brandColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor)) {
    return brandColor;
  }
  return "#0f172a";
};

const formatAmount = (amount: number, currency: string = "SAR"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
};

const buildStyles = (brandColor: string, isRTL: boolean) =>
  StyleSheet.create({
    page: {
      paddingTop: 28,
      paddingBottom: 40,
      paddingHorizontal: 28,
      fontSize: 9,
      fontFamily: ARABIC_FONT_FAMILY,
      color: "#0f172a",
      backgroundColor: "#ffffff",
    },
    headerBand: {
      backgroundColor: brandColor,
      borderRadius: 12,
      padding: 18,
      marginBottom: 18,
    },
    headerTop: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    orgBlock: {
      width: "52%",
    },
    orgName: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#ffffff",
      marginBottom: 4,
      textAlign: isRTL ? "right" : "left",
    },
    reportBlock: {
      width: "42%",
      alignItems: isRTL ? "flex-start" : "flex-end",
    },
    reportTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#ffffff",
      marginBottom: 3,
      textAlign: isRTL ? "left" : "right",
    },
    reportSubtitle: {
      fontSize: 9,
      color: "#dbeafe",
      marginBottom: 2,
      textAlign: isRTL ? "left" : "right",
    },
    heroStats: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    heroCard: {
      width: "23.5%",
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#dbe4f0",
      borderRadius: 10,
      padding: 10,
    },
    heroLabel: {
      fontSize: 8,
      color: "#64748b",
      marginBottom: 6,
      textAlign: isRTL ? "right" : "left",
    },
    heroValue: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: isRTL ? "right" : "left",
    },
    heroValueGreen: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#15803d",
      textAlign: isRTL ? "right" : "left",
    },
    heroValueRed: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#dc2626",
      textAlign: isRTL ? "right" : "left",
    },
    heroValueBlue: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#2563eb",
      textAlign: isRTL ? "right" : "left",
    },
    table: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      borderRadius: 10,
      overflow: "hidden",
    },
    tableHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      backgroundColor: brandColor,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    tableHeaderText: {
      color: "#ffffff",
      fontSize: 7.4,
      fontWeight: "bold",
      textAlign: isRTL ? "right" : "left",
    },
    tableRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      backgroundColor: "#ffffff",
    },
    tableRowAlt: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      backgroundColor: "#f8fafc",
    },
    tableTotalsRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderTopWidth: 2,
      borderTopColor: brandColor,
      backgroundColor: "#f1f5f9",
    },
    cellText: {
      fontSize: 7.8,
      color: "#0f172a",
      textAlign: isRTL ? "right" : "left",
    },
    cellTextBold: {
      fontSize: 7.8,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: isRTL ? "right" : "left",
    },
    alignRight: {
      textAlign: isRTL ? "left" : "right",
    },
    colDate: { width: "12%", paddingRight: 4 },
    colRef: { width: "14%", paddingRight: 4 },
    colDesc: { width: "34%", paddingRight: 4 },
    colDebit: { width: "13.33%", textAlign: isRTL ? "left" : "right" },
    colCredit: { width: "13.33%", textAlign: isRTL ? "left" : "right" },
    colBalance: { width: "13.34%", textAlign: isRTL ? "left" : "right" },
    emptyState: {
      padding: 14,
      textAlign: "center",
      color: "#64748b",
      fontSize: 8.2,
    },
    footer: {
      position: "absolute",
      left: 28,
      right: 28,
      bottom: 14,
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      fontSize: 7.2,
      color: "#64748b",
    },
  });

export function LedgerPDF({
  organization,
  data,
  fromDate,
  toDate,
  lang,
}: LedgerPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";

  const titleMap = {
    ACCOUNT: l.accountLedger,
    CUSTOMER: l.customerLedger,
    SUPPLIER: l.supplierLedger,
  };
  const title = titleMap[data.entityType];
  const periodText =
    fromDate && toDate
      ? `${l.period}: ${fromDate} ${l.to} ${toDate}`
      : l.allTime;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.headerBand}>
          <View style={styles.headerTop}>
            <View style={styles.orgBlock}>
              <Text style={styles.orgName}>
                {isRTL
                  ? organization.arabicName || organization.name
                  : organization.name}
              </Text>
            </View>
            <View style={styles.reportBlock}>
              <Text style={styles.reportTitle}>{title}</Text>
              <Text style={styles.reportSubtitle}>{data.entityName}</Text>
              <Text style={styles.reportSubtitle}>{periodText}</Text>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.openingBalance}</Text>
            <Text style={styles.heroValue}>
              {formatAmount(data.openingBalance, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalDebit}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(data.totalDebit, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalCredit}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totalCredit, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.closingBalance}</Text>
            <Text style={styles.heroValueBlue}>
              {formatAmount(data.closingBalance, currency)}
            </Text>
          </View>
        </View>

        {/* Transaction Table */}
        {data.transactions.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noTransactions}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDate]}>
                {l.date}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colRef]}>
                {l.reference}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colDesc]}>
                {l.description}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colDebit,
                  styles.alignRight,
                ]}
              >
                {l.debit}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colCredit,
                  styles.alignRight,
                ]}
              >
                {l.credit}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colBalance,
                  styles.alignRight,
                ]}
              >
                {l.balance}
              </Text>
            </View>

            {/* Opening Balance Row */}
            {data.openingBalance !== 0 && (
              <View style={styles.tableRow} wrap={false}>
                <Text style={[styles.cellText, styles.colDate]}>{""}</Text>
                <Text style={[styles.cellText, styles.colRef]}>{""}</Text>
                <Text style={[styles.cellTextBold, styles.colDesc]}>
                  {l.openingBalance}
                </Text>
                <Text
                  style={[styles.cellText, styles.colDebit, styles.alignRight]}
                >
                  {""}
                </Text>
                <Text
                  style={[styles.cellText, styles.colCredit, styles.alignRight]}
                >
                  {""}
                </Text>
                <Text
                  style={[
                    styles.cellTextBold,
                    styles.colBalance,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(data.openingBalance, currency)}
                </Text>
              </View>
            )}

            {data.transactions.map((tx, index) => (
              <View
                key={tx.id}
                style={
                  (index + (data.openingBalance !== 0 ? 1 : 0)) % 2 === 0
                    ? styles.tableRow
                    : styles.tableRowAlt
                }
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colDate]}>
                  {new Date(tx.date).toLocaleDateString(
                    isRTL ? "ar-SA" : "en-US",
                    { day: "2-digit", month: "short", year: "numeric" }
                  )}
                </Text>
                <Text style={[styles.cellText, styles.colRef]}>{tx.ref}</Text>
                <Text style={[styles.cellText, styles.colDesc]}>
                  {tx.description || "-"}
                </Text>
                <Text
                  style={[
                    tx.debit > 0
                      ? { fontSize: 7.8, color: "#dc2626" }
                      : styles.cellText,
                    styles.colDebit,
                    styles.alignRight,
                  ]}
                >
                  {tx.debit > 0 ? formatAmount(tx.debit, currency) : "-"}
                </Text>
                <Text
                  style={[
                    tx.credit > 0
                      ? { fontSize: 7.8, color: "#15803d" }
                      : styles.cellText,
                    styles.colCredit,
                    styles.alignRight,
                  ]}
                >
                  {tx.credit > 0 ? formatAmount(tx.credit, currency) : "-"}
                </Text>
                <Text
                  style={[
                    styles.cellTextBold,
                    styles.colBalance,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(tx.balance, currency)}
                </Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text
                style={[
                  styles.cellTextBold,
                  { width: "60%", paddingRight: 4 },
                ]}
              >
                {l.totals}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colDebit,
                  styles.alignRight,
                  { color: "#dc2626" },
                ]}
              >
                {formatAmount(data.totalDebit, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colCredit,
                  styles.alignRight,
                  { color: "#15803d" },
                ]}
              >
                {formatAmount(data.totalCredit, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colBalance,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.closingBalance, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {title}: {data.entityName} — {l.generatedOn}{" "}
            {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US")}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${l.page} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
