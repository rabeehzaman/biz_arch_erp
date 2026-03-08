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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
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
    textAlign: "right",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 20,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
  },
  customerInfo: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1e293b",
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
  },
  customerDetail: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: "row",
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
    flexDirection: "row",
    backgroundColor: "#1e293b",
    padding: 8,
    color: "#ffffff",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
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
    textAlign: "right",
  },
  colCredit: {
    width: "13%",
    textAlign: "right",
  },
  colBalance: {
    width: "14%",
    textAlign: "right",
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
    flexDirection: "row",
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

interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "INVOICE" | "PAYMENT" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface CustomerStatementData {
  customer: {
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
  statement: CustomerStatementData;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const balanceSide = (amount: number): string => (amount >= 0 ? "مدين" : "دائن");

export function CustomerStatementPDF({ statement }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>كشف حساب العميل</Text>
          <Text style={styles.subtitle}>
            تم الإنشاء في {format(new Date(statement.generatedAt), "dd/MM/yyyy HH:mm")}
          </Text>
        </View>

        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{statement.customer.name}</Text>
          {statement.customer.email && (
            <Text style={styles.customerDetail}>{statement.customer.email}</Text>
          )}
          {statement.customer.phone && (
            <Text style={styles.customerDetail}>{statement.customer.phone}</Text>
          )}
          {statement.customer.address && (
            <Text style={styles.customerDetail}>{statement.customer.address}</Text>
          )}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>الرصيد الافتتاحي</Text>
            <Text style={statement.openingBalance >= 0 ? styles.summaryValuePositive : styles.summaryValueNegative}>
              {formatCurrency(Math.abs(statement.openingBalance))}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>إجمالي المستحق</Text>
            <Text style={styles.summaryValuePositive}>
              {formatCurrency(statement.totalDebits)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>إجمالي المحصل</Text>
            <Text style={styles.summaryValueNegative}>
              {formatCurrency(statement.totalCredits)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>الرصيد الختامي</Text>
            <Text
              style={[
                statement.closingBalance >= 0
                  ? styles.summaryValuePositive
                  : styles.summaryValueNegative,
                { fontFamily: ARABIC_FONT_FAMILY },
              ]}
            >
              {formatCurrency(Math.abs(statement.closingBalance))}
              {` ${balanceSide(statement.closingBalance)}`}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDate, styles.headerText]}>التاريخ</Text>
            <Text style={[styles.colRef, styles.headerText]}>المرجع</Text>
            <Text style={[styles.colDescription, styles.headerText]}>الوصف</Text>
            <Text style={[styles.colDebit, styles.headerText]}>المستحق</Text>
            <Text style={[styles.colCredit, styles.headerText]}>المحصّل</Text>
            <Text style={[styles.colBalance, styles.headerText]}>الرصيد</Text>
          </View>

          {statement.transactions.length === 0 ? (
            <View style={styles.noTransactions}>
              <Text style={{ fontFamily: ARABIC_FONT_FAMILY }}>لا توجد حركات</Text>
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
                    {txn.debit > 0 ? formatCurrency(txn.debit) : "-"}
                  </Text>
                  <Text style={txn.credit > 0 ? [styles.colCredit, styles.creditText] : styles.colCredit}>
                    {txn.credit > 0 ? formatCurrency(txn.credit) : "-"}
                  </Text>
                  <Text style={[
                    styles.colBalance,
                    txn.runningBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                    { fontFamily: ARABIC_FONT_FAMILY },
                  ]}>
                    {formatCurrency(Math.abs(txn.runningBalance))}
                    {` ${balanceSide(txn.runningBalance)}`}
                  </Text>
                </View>
              ))}
              <View style={styles.totalsRow}>
                <Text style={styles.colDate}></Text>
                <Text style={styles.colRef}></Text>
                <Text style={[styles.colDescription, { fontFamily: ARABIC_FONT_FAMILY }]}>
                  الإجماليات
                </Text>
                <Text style={[styles.colDebit, styles.debitText]}>
                  {formatCurrency(statement.totalDebits)}
                </Text>
                <Text style={[styles.colCredit, styles.creditText]}>
                  {formatCurrency(statement.totalCredits)}
                </Text>
                <Text style={[
                  styles.colBalance,
                  statement.closingBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
                  { fontFamily: ARABIC_FONT_FAMILY },
                ]}>
                  {formatCurrency(Math.abs(statement.closingBalance))}{" "}
                  {balanceSide(statement.closingBalance)}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          هذا كشف حساب مُنشأ آليًا ولا يتطلب توقيعًا.
        </Text>
      </Page>
    </Document>
  );
}
