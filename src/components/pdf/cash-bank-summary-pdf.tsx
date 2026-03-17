import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { CashBankSummaryData } from "@/lib/reports/cash-bank-summary";

interface CashBankSummaryPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: CashBankSummaryData;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Cash & Bank Summary",
    period: "Period",
    to: "to",
    openingBalance: "Opening Balance",
    closingBalance: "Closing Balance",
    totalIn: "Total In",
    totalOut: "Total Out",
    accountName: "Account Name",
    type: "Type",
    cash: "Cash",
    bank: "Bank",
    totals: "Totals",
    noAccounts: "No accounts found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "ملخص النقد والبنك",
    period: "الفترة",
    to: "إلى",
    openingBalance: "الرصيد الافتتاحي",
    closingBalance: "الرصيد الختامي",
    totalIn: "إجمالي الوارد",
    totalOut: "إجمالي الصادر",
    accountName: "اسم الحساب",
    type: "النوع",
    cash: "نقد",
    bank: "بنك",
    totals: "الإجمالي",
    noAccounts: "لا توجد حسابات لهذه الفترة.",
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
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      backgroundColor: "#ffffff",
    },
    tableRowAlt: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingVertical: 8,
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
    colName: { width: "24%", paddingRight: 4 },
    colType: { width: "10%", paddingRight: 4 },
    colOpening: { width: "16.5%", textAlign: isRTL ? "left" : "right" },
    colIn: { width: "16.5%", textAlign: isRTL ? "left" : "right" },
    colOut: { width: "16.5%", textAlign: isRTL ? "left" : "right" },
    colClosing: { width: "16.5%", textAlign: isRTL ? "left" : "right" },
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

export function CashBankSummaryPDF({
  organization,
  data,
  lang,
}: CashBankSummaryPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";

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
              <Text style={styles.reportTitle}>{l.title}</Text>
              <Text style={styles.reportSubtitle}>
                {l.period}: {data.fromDate} {l.to} {data.toDate}
              </Text>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.openingBalance}</Text>
            <Text style={styles.heroValue}>
              {formatAmount(data.totals.openingBalance, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalIn}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totals.totalIn, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalOut}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(data.totals.totalOut, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.closingBalance}</Text>
            <Text style={styles.heroValueBlue}>
              {formatAmount(data.totals.closingBalance, currency)}
            </Text>
          </View>
        </View>

        {/* Accounts Table */}
        {data.accounts.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noAccounts}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colName]}>
                {l.accountName}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colType]}>
                {l.type}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colOpening,
                  styles.alignRight,
                ]}
              >
                {l.openingBalance}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colIn,
                  styles.alignRight,
                ]}
              >
                {l.totalIn}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colOut,
                  styles.alignRight,
                ]}
              >
                {l.totalOut}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colClosing,
                  styles.alignRight,
                ]}
              >
                {l.closingBalance}
              </Text>
            </View>

            {data.accounts.map((account, index) => (
              <View
                key={account.id}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colName]}>
                  {account.name}
                </Text>
                <Text style={[styles.cellText, styles.colType]}>
                  {account.accountSubType === "CASH" ? l.cash : l.bank}
                </Text>
                <Text
                  style={[styles.cellText, styles.colOpening, styles.alignRight]}
                >
                  {formatAmount(account.openingBalance, currency)}
                </Text>
                <Text
                  style={[
                    { fontSize: 7.8, color: "#15803d" },
                    styles.colIn,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(account.totalIn, currency)}
                </Text>
                <Text
                  style={[
                    { fontSize: 7.8, color: "#dc2626" },
                    styles.colOut,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(account.totalOut, currency)}
                </Text>
                <Text
                  style={[
                    styles.cellTextBold,
                    styles.colClosing,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(account.closingBalance, currency)}
                </Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, styles.colName]}>
                {l.totals}
              </Text>
              <Text style={[styles.cellText, styles.colType]}>{""}</Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colOpening,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.openingBalance, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colIn,
                  styles.alignRight,
                  { color: "#15803d" },
                ]}
              >
                {formatAmount(data.totals.totalIn, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colOut,
                  styles.alignRight,
                  { color: "#dc2626" },
                ]}
              >
                {formatAmount(data.totals.totalOut, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colClosing,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.closingBalance, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {l.title} — {l.generatedOn}{" "}
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
