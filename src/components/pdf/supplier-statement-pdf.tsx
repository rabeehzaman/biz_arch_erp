import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import { translate } from "@/lib/i18n-translate";
import type { Language } from "@/lib/i18n-translate";
import { formatCurrencyForPdf } from "@/lib/currency";

interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "PURCHASE_INVOICE" | "PAYMENT" | "DEBIT_NOTE" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface SupplierStatementData {
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  openingBalance: number;
  transactions: StatementTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  generatedAt: string;
}

interface Props {
  statement: SupplierStatementData;
  lang?: Language;
  currency?: string;
}

const buildStyles = (isRTL: boolean) => StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Arial",
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1e293b",
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: isRTL ? "right" : "left",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 20,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: isRTL ? "right" : "left",
  },
  supplierInfo: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1e293b",
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: isRTL ? "right" : "left",
  },
  supplierDetail: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 3,
    fontFamily: ARABIC_FONT_FAMILY,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  summaryValuePositive: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#dc2626",
  },
  summaryValueNegative: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#16a34a",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: isRTL ? "row-reverse" : "row",
    backgroundColor: "#1e293b",
    padding: 8,
    color: "#ffffff",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: isRTL ? "row-reverse" : "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 8,
  },
  tableRowAlt: {
    flexDirection: isRTL ? "row-reverse" : "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  colDate: {
    width: "12%",
  },
  colRef: {
    width: "20%",
    fontSize: 8,
  },
  colDescription: {
    width: "26%",
  },
  colDebit: {
    width: "13%",
    textAlign: isRTL ? "left" : "right",
  },
  colCredit: {
    width: "13%",
    textAlign: isRTL ? "left" : "right",
  },
  colBalance: {
    width: "14%",
    textAlign: isRTL ? "left" : "right",
  },
  headerText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontFamily: ARABIC_FONT_FAMILY,
  },
  debitText: {
    color: "#dc2626",
  },
  creditText: {
    color: "#16a34a",
  },
  balancePositive: {
    color: "#dc2626",
    fontWeight: "bold",
  },
  balanceNegative: {
    color: "#16a34a",
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
    fontFamily: ARABIC_FONT_FAMILY,
  },
  totalsRow: {
    flexDirection: isRTL ? "row-reverse" : "row",
    padding: 10,
    backgroundColor: "#f1f5f9",
    fontWeight: "bold",
    marginTop: 2,
  },
  noTransactions: {
    padding: 20,
    textAlign: "center",
    color: "#64748b",
  },
});

export function SupplierStatementPDF({ statement, lang = "en", currency = "INR" }: Props) {
  const isRTL = lang === "ar";
  const styles = buildStyles(isRTL);
  const t = (key: string) => translate(key, lang);

  const fmtCurrency = (amount: number): string => {
    return formatCurrencyForPdf(amount, currency);
  };

  const balanceSide = (amount: number): string =>
    amount >= 0 ? t("pdf.debitSide") : t("pdf.creditSide");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("pdf.supplierStatement")}</Text>
          <Text style={styles.subtitle}>
            {t("pdf.generatedAt")} {format(new Date(statement.generatedAt), "dd/MM/yyyy HH:mm")}
          </Text>
        </View>

        <View style={styles.supplierInfo}>
          <Text style={styles.supplierName}>{statement.supplier.name}</Text>
          {statement.supplier.email && (
            <Text style={styles.supplierDetail}>{statement.supplier.email}</Text>
          )}
          {statement.supplier.phone && (
            <Text style={styles.supplierDetail}>{statement.supplier.phone}</Text>
          )}
          {statement.supplier.address && (
            <Text style={styles.supplierDetail}>{statement.supplier.address}</Text>
          )}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("pdf.openingBalance")}</Text>
            <Text style={statement.openingBalance >= 0 ? styles.summaryValuePositive : styles.summaryValueNegative}>
              {fmtCurrency(Math.abs(statement.openingBalance))}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("pdf.totalPayable")}</Text>
            <Text style={styles.summaryValuePositive}>
              {fmtCurrency(statement.totalDebits)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("pdf.totalPaid")}</Text>
            <Text style={styles.summaryValueNegative}>
              {fmtCurrency(statement.totalCredits)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("pdf.closingBalance")}</Text>
            <Text
              style={[
                statement.closingBalance >= 0
                  ? styles.summaryValuePositive
                  : styles.summaryValueNegative,
                { fontFamily: ARABIC_FONT_FAMILY },
              ]}
            >
              {fmtCurrency(Math.abs(statement.closingBalance))}
              {` ${balanceSide(statement.closingBalance)}`}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDate, styles.headerText]}>{t("pdf.date")}</Text>
            <Text style={[styles.colRef, styles.headerText]}>{t("pdf.reference")}</Text>
            <Text style={[styles.colDescription, styles.headerText]}>{t("pdf.description")}</Text>
            <Text style={[styles.colDebit, styles.headerText]}>{t("pdf.debit")}</Text>
            <Text style={[styles.colCredit, styles.headerText]}>{t("pdf.credit")}</Text>
            <Text style={[styles.colBalance, styles.headerText]}>{t("pdf.balance")}</Text>
          </View>

          {statement.transactions.length === 0 ? (
            <View style={styles.noTransactions}>
              <Text style={{ fontFamily: ARABIC_FONT_FAMILY }}>{t("pdf.noTransactions")}</Text>
            </View>
          ) : (
            <>
              {statement.transactions.map((txn, index) => (
                <View
                  key={txn.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.colDate}>
                    {format(new Date(txn.date), "dd MMM yyyy")}
                  </Text>
                  <Text style={styles.colRef}>{txn.reference}</Text>
                  <Text style={styles.colDescription}>{txn.description}</Text>
                  <Text style={txn.debit > 0 ? [styles.colDebit, styles.debitText] : styles.colDebit}>
                    {txn.debit > 0 ? fmtCurrency(txn.debit) : "-"}
                  </Text>
                  <Text style={txn.credit > 0 ? [styles.colCredit, styles.creditText] : styles.colCredit}>
                    {txn.credit > 0 ? fmtCurrency(txn.credit) : "-"}
                  </Text>
                  <Text style={[
                    styles.colBalance,
                    txn.runningBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                    { fontFamily: ARABIC_FONT_FAMILY },
                  ]}>
                    {fmtCurrency(Math.abs(txn.runningBalance))}
                    {` ${balanceSide(txn.runningBalance)}`}
                  </Text>
                </View>
              ))}
              <View style={styles.totalsRow}>
                <Text style={styles.colDate}></Text>
                <Text style={styles.colRef}></Text>
                <Text style={[styles.colDescription, { fontFamily: ARABIC_FONT_FAMILY }]}>
                  {t("pdf.totals")}
                </Text>
                <Text style={[styles.colDebit, styles.debitText]}>
                  {fmtCurrency(statement.totalDebits)}
                </Text>
                <Text style={[styles.colCredit, styles.creditText]}>
                  {fmtCurrency(statement.totalCredits)}
                </Text>
                <Text style={[
                  styles.colBalance,
                  statement.closingBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                  { fontFamily: ARABIC_FONT_FAMILY },
                ]}>
                  {fmtCurrency(Math.abs(statement.closingBalance))}{" "}
                  {balanceSide(statement.closingBalance)}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          {t("pdf.autoGenerated")}
        </Text>
      </Page>
    </Document>
  );
}
