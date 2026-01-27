import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";

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
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 20,
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
  },
  supplierDetail: {
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
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function SupplierStatementPDF({ statement }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Supplier Statement</Text>
          <Text style={styles.subtitle}>
            Generated on {format(new Date(statement.generatedAt), "dd MMM yyyy, hh:mm a")}
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
            <Text style={styles.summaryLabel}>OPENING BALANCE</Text>
            <Text style={statement.openingBalance >= 0 ? styles.summaryValuePositive : styles.summaryValueNegative}>
              {formatCurrency(Math.abs(statement.openingBalance))}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TOTAL PAYABLE</Text>
            <Text style={styles.summaryValuePositive}>
              {formatCurrency(statement.totalDebits)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TOTAL PAID</Text>
            <Text style={styles.summaryValueNegative}>
              {formatCurrency(statement.totalCredits)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>CLOSING BALANCE</Text>
            <Text style={statement.closingBalance >= 0 ? styles.summaryValuePositive : styles.summaryValueNegative}>
              {formatCurrency(Math.abs(statement.closingBalance))}
              {statement.closingBalance >= 0 ? " Dr" : " Cr"}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDate, styles.headerText]}>Date</Text>
            <Text style={[styles.colRef, styles.headerText]}>Reference</Text>
            <Text style={[styles.colDescription, styles.headerText]}>Description</Text>
            <Text style={[styles.colDebit, styles.headerText]}>Payable</Text>
            <Text style={[styles.colCredit, styles.headerText]}>Paid</Text>
            <Text style={[styles.colBalance, styles.headerText]}>Balance</Text>
          </View>

          {statement.transactions.length === 0 ? (
            <View style={styles.noTransactions}>
              <Text>No transactions found</Text>
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
                    txn.runningBalance >= 0 ? styles.balancePositive : styles.balanceNegative
                  ]}>
                    {formatCurrency(Math.abs(txn.runningBalance))}
                    {txn.runningBalance >= 0 ? " Dr" : " Cr"}
                  </Text>
                </View>
              ))}
              <View style={styles.totalsRow}>
                <Text style={styles.colDate}></Text>
                <Text style={styles.colRef}></Text>
                <Text style={styles.colDescription}>TOTALS</Text>
                <Text style={[styles.colDebit, styles.debitText]}>
                  {formatCurrency(statement.totalDebits)}
                </Text>
                <Text style={[styles.colCredit, styles.creditText]}>
                  {formatCurrency(statement.totalCredits)}
                </Text>
                <Text style={[
                  styles.colBalance,
                  statement.closingBalance >= 0 ? styles.balancePositive : styles.balanceNegative
                ]}>
                  {formatCurrency(Math.abs(statement.closingBalance))}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          This is a computer-generated statement and does not require a signature.
        </Text>
      </Page>
    </Document>
  );
}
