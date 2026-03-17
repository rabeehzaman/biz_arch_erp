import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { SalesByCustomerData } from "@/lib/reports/sales-by-customer";

interface SalesByCustomerPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: SalesByCustomerData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Sales by Customer",
    period: "Period",
    to: "to",
    grossSales: "Gross Sales",
    returns: "Returns",
    netSales: "Net Sales",
    customer: "Customer",
    invoices: "Invoices",
    returnsCol: "Returns",
    grossSalesCol: "Gross Sales",
    returnsAmount: "Returns Amt",
    tax: "Tax",
    netTotal: "Net Total",
    totals: "Totals",
    noData: "No sales data found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "المبيعات حسب العميل",
    period: "الفترة",
    to: "إلى",
    grossSales: "إجمالي المبيعات",
    returns: "المرتجعات",
    netSales: "صافي المبيعات",
    customer: "العميل",
    invoices: "الفواتير",
    returnsCol: "المرتجعات",
    grossSalesCol: "إجمالي المبيعات",
    returnsAmount: "مبلغ المرتجعات",
    tax: "الضريبة",
    netTotal: "صافي الإجمالي",
    totals: "الإجمالي",
    noData: "لا توجد بيانات مبيعات لهذه الفترة.",
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

const formatAmount = (amount: number, currency: string = "INR"): string => {
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
      width: "31%",
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
    colCustomer: { width: "22%", paddingRight: 4 },
    colInvoices: { width: "8%", textAlign: isRTL ? "left" : "right" },
    colReturns: { width: "8%", textAlign: isRTL ? "left" : "right" },
    colGrossSales: { width: "16%", textAlign: isRTL ? "left" : "right" },
    colReturnsAmt: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colTax: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colNetTotal: { width: "18%", textAlign: isRTL ? "left" : "right" },
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

export function SalesByCustomerPDF({
  organization,
  data,
  fromDate,
  toDate,
  lang,
}: SalesByCustomerPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

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
                {l.period}: {fromDate} {l.to} {toDate}
              </Text>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.grossSales}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totals.grossSales, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.returns}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(data.totals.returns, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netSales}</Text>
            <Text style={styles.heroValueBlue}>
              {formatAmount(data.totals.netSales, currency)}
            </Text>
          </View>
        </View>

        {/* Table */}
        {data.rows.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noData}</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colCustomer]}>
                {l.customer}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colInvoices,
                  styles.alignRight,
                ]}
              >
                {l.invoices}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colReturns,
                  styles.alignRight,
                ]}
              >
                {l.returnsCol}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colGrossSales,
                  styles.alignRight,
                ]}
              >
                {l.grossSalesCol}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colReturnsAmt,
                  styles.alignRight,
                ]}
              >
                {l.returnsAmount}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colTax,
                  styles.alignRight,
                ]}
              >
                {l.tax}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colNetTotal,
                  styles.alignRight,
                ]}
              >
                {l.netTotal}
              </Text>
            </View>

            {data.rows.map((row, index) => (
              <View
                key={row.customerId}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colCustomer]}>
                  {row.customerName}
                </Text>
                <Text
                  style={[styles.cellText, styles.colInvoices, styles.alignRight]}
                >
                  {row.invoiceCount}
                </Text>
                <Text
                  style={[styles.cellText, styles.colReturns, styles.alignRight]}
                >
                  {row.returnCount}
                </Text>
                <Text
                  style={[
                    styles.colGrossSales,
                    row.grossSales > 0 ? styles.cellGreen : styles.cellText,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(row.grossSales, currency)}
                </Text>
                <Text
                  style={[
                    styles.colReturnsAmt,
                    row.returns > 0 ? styles.cellRed : styles.cellText,
                    styles.alignRight,
                  ]}
                >
                  {row.returns > 0
                    ? formatAmount(row.returns, currency)
                    : "-"}
                </Text>
                <Text
                  style={[styles.cellText, styles.colTax, styles.alignRight]}
                >
                  {formatAmount(row.tax, currency)}
                </Text>
                <Text
                  style={[
                    styles.cellTextBold,
                    styles.colNetTotal,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(row.total, currency)}
                </Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, styles.colCustomer]}>
                {l.totals}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colInvoices,
                  styles.alignRight,
                ]}
              >
                {data.totals.invoiceCount}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colReturns,
                  styles.alignRight,
                ]}
              >
                {data.totals.returnCount}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colGrossSales,
                  styles.alignRight,
                  { color: "#15803d" },
                ]}
              >
                {formatAmount(data.totals.grossSales, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colReturnsAmt,
                  styles.alignRight,
                  { color: "#dc2626" },
                ]}
              >
                {formatAmount(data.totals.returns, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTax,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.tax, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colNetTotal,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.total, currency)}
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
