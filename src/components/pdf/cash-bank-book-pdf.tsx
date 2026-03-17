import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { CashBankBookData } from "@/lib/reports/cash-bank-book";

interface CashBankBookPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: CashBankBookData;
  bookType: "cash" | "bank";
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    cashBook: "Cash Book",
    bankBook: "Bank Book",
    period: "Period",
    to: "to",
    openingBalance: "Opening Balance",
    closingBalance: "Closing Balance",
    cashIn: "Cash In",
    cashOut: "Cash Out",
    date: "Date",
    type: "Type",
    description: "Description",
    account: "Account",
    runningBalance: "Running Balance",
    totals: "Totals",
    noTransactions: "No transactions found for this period.",
    page: "Page",
    generatedOn: "Generated on",
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    transferIn: "Transfer In",
    transferOut: "Transfer Out",
  },
  ar: {
    cashBook: "دفتر النقد",
    bankBook: "دفتر البنك",
    period: "الفترة",
    to: "إلى",
    openingBalance: "الرصيد الافتتاحي",
    closingBalance: "الرصيد الختامي",
    cashIn: "وارد",
    cashOut: "صادر",
    date: "التاريخ",
    type: "النوع",
    description: "الوصف",
    account: "الحساب",
    runningBalance: "الرصيد الجاري",
    totals: "الإجمالي",
    noTransactions: "لا توجد معاملات لهذه الفترة.",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
    deposit: "إيداع",
    withdrawal: "سحب",
    transferIn: "تحويل وارد",
    transferOut: "تحويل صادر",
  },
};

const typeLabels: Record<string, { en: string; ar: string }> = {
  DEPOSIT: { en: "Deposit", ar: "إيداع" },
  WITHDRAWAL: { en: "Withdrawal", ar: "سحب" },
  TRANSFER_IN: { en: "Transfer In", ar: "تحويل وارد" },
  TRANSFER_OUT: { en: "Transfer Out", ar: "تحويل صادر" },
  OPENING_BALANCE: { en: "Opening Balance", ar: "رصيد افتتاحي" },
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
    cellGreen: {
      fontSize: 7.8,
      color: "#15803d",
      textAlign: isRTL ? "left" : "right",
    },
    cellRed: {
      fontSize: 7.8,
      color: "#dc2626",
      textAlign: isRTL ? "left" : "right",
    },
    alignRight: {
      textAlign: isRTL ? "left" : "right",
    },
    colDate: { width: "12%", paddingRight: 4 },
    colType: { width: "14%", paddingRight: 4 },
    colDesc: { width: "24%", paddingRight: 4 },
    colAccount: { width: "14%", paddingRight: 4 },
    colCashIn: { width: "12%", textAlign: isRTL ? "left" : "right" },
    colCashOut: { width: "12%", textAlign: isRTL ? "left" : "right" },
    colBalance: { width: "12%", textAlign: isRTL ? "left" : "right" },
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

export function CashBankBookPDF({
  organization,
  data,
  bookType,
  fromDate,
  toDate,
  lang,
}: CashBankBookPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";
  const title = bookType === "cash" ? l.cashBook : l.bankBook;
  const hasMultipleAccounts = data.accounts.length > 1;

  const getTypeLabel = (type: string) => {
    const entry = typeLabels[type];
    return entry ? entry[lang] : type;
  };

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
              <Text style={styles.reportSubtitle}>
                {l.period}: {fromDate} {l.to} {toDate}
              </Text>
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
            <Text style={styles.heroLabel}>{l.cashIn}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totalCashIn, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.cashOut}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(data.totalCashOut, currency)}
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
              <Text style={[styles.tableHeaderText, styles.colType]}>
                {l.type}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  hasMultipleAccounts
                    ? { width: "24%", paddingRight: 4 }
                    : { width: "38%", paddingRight: 4 },
                ]}
              >
                {l.description}
              </Text>
              {hasMultipleAccounts && (
                <Text style={[styles.tableHeaderText, styles.colAccount]}>
                  {l.account}
                </Text>
              )}
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colCashIn,
                  styles.alignRight,
                ]}
              >
                {l.cashIn}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colCashOut,
                  styles.alignRight,
                ]}
              >
                {l.cashOut}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colBalance,
                  styles.alignRight,
                ]}
              >
                {l.runningBalance}
              </Text>
            </View>

            {data.transactions.map((tx, index) => (
              <View
                key={tx.id}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colDate]}>
                  {new Date(tx.date).toLocaleDateString(
                    isRTL ? "ar-SA" : "en-US",
                    { day: "2-digit", month: "short", year: "numeric" }
                  )}
                </Text>
                <Text style={[styles.cellText, styles.colType]}>
                  {getTypeLabel(tx.type)}
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    hasMultipleAccounts
                      ? { width: "24%", paddingRight: 4 }
                      : { width: "38%", paddingRight: 4 },
                  ]}
                >
                  {tx.description || "-"}
                </Text>
                {hasMultipleAccounts && (
                  <Text style={[styles.cellText, styles.colAccount]}>
                    {tx.accountName}
                  </Text>
                )}
                <Text style={[styles.colCashIn, tx.cashIn > 0 ? styles.cellGreen : styles.cellText, styles.alignRight]}>
                  {tx.cashIn > 0 ? formatAmount(tx.cashIn, currency) : "-"}
                </Text>
                <Text style={[styles.colCashOut, tx.cashOut > 0 ? styles.cellRed : styles.cellText, styles.alignRight]}>
                  {tx.cashOut > 0 ? formatAmount(tx.cashOut, currency) : "-"}
                </Text>
                <Text style={[styles.cellTextBold, styles.colBalance, styles.alignRight]}>
                  {formatAmount(tx.runningBalance, currency)}
                </Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text
                style={[
                  styles.cellTextBold,
                  {
                    width: hasMultipleAccounts ? "50%" : "64%",
                    paddingRight: 4,
                  },
                ]}
              >
                {l.totals}
              </Text>
              {hasMultipleAccounts && (
                <Text style={[styles.cellText, styles.colAccount]}>{""}</Text>
              )}
              <Text style={[styles.cellTextBold, styles.colCashIn, styles.alignRight, { color: "#15803d" }]}>
                {formatAmount(data.totalCashIn, currency)}
              </Text>
              <Text style={[styles.cellTextBold, styles.colCashOut, styles.alignRight, { color: "#dc2626" }]}>
                {formatAmount(data.totalCashOut, currency)}
              </Text>
              <Text style={[styles.cellTextBold, styles.colBalance, styles.alignRight]}>
                {formatAmount(data.closingBalance, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {title} — {l.generatedOn}{" "}
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
