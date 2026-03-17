import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { SalesBySalespersonData } from "@/lib/reports/sales-by-salesperson";

interface SalesBySalespersonPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: SalesBySalespersonData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Sales by Salesperson",
    period: "Period",
    to: "to",
    totalSales: "Total Sales",
    collected: "Collected",
    outstanding: "Outstanding",
    salesperson: "Salesperson",
    invoices: "Invoices",
    sales: "Sales",
    tax: "Tax",
    total: "Total",
    totals: "Totals",
    noData: "No sales data found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u062D\u0633\u0628 \u0627\u0644\u0628\u0627\u0626\u0639",
    period: "\u0627\u0644\u0641\u062A\u0631\u0629",
    to: "\u0625\u0644\u0649",
    totalSales: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
    collected: "\u0627\u0644\u0645\u062D\u0635\u0644",
    outstanding: "\u0627\u0644\u0645\u0633\u062A\u062D\u0642",
    salesperson: "\u0627\u0644\u0628\u0627\u0626\u0639",
    invoices: "\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631",
    sales: "\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
    tax: "\u0627\u0644\u0636\u0631\u064A\u0628\u0629",
    total: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
    totals: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
    noData: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0628\u064A\u0639\u0627\u062A \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u062A\u0631\u0629.",
    page: "\u0635\u0641\u062D\u0629",
    generatedOn: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621",
  },
};

const safeBrandColor = (bc?: string | null): string =>
  bc && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(bc) ? bc : "#0f172a";

const formatAmount = (n: number, c: string = "SAR"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: c,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
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
    orgBlock: { width: "52%" },
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
    heroValueBlue: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#2563eb",
      textAlign: isRTL ? "right" : "left",
    },
    heroValueRed: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#dc2626",
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
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colSalesperson: { width: "18%", paddingRight: 4 },
    colInvoices: { width: "8%", textAlign: isRTL ? "left" : "right" },
    colSales: { width: "15%", textAlign: isRTL ? "left" : "right" },
    colTax: { width: "13%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "15%", textAlign: isRTL ? "left" : "right" },
    colCollected: { width: "15%", textAlign: isRTL ? "left" : "right" },
    colOutstanding: { width: "16%", textAlign: isRTL ? "left" : "right" },
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

export function SalesBySalespersonPDF({
  organization,
  data,
  fromDate,
  toDate,
  lang,
}: SalesBySalespersonPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
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

        {/* Hero Cards */}
        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalSales}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totals.totalAmount, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.collected}</Text>
            <Text style={styles.heroValueBlue}>
              {formatAmount(data.totals.collected, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.outstanding}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(data.totals.outstanding, currency)}
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
              <Text style={[styles.tableHeaderText, styles.colSalesperson]}>
                {l.salesperson}
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
                  styles.colSales,
                  styles.alignRight,
                ]}
              >
                {l.sales}
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
                  styles.colTotal,
                  styles.alignRight,
                ]}
              >
                {l.total}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colCollected,
                  styles.alignRight,
                ]}
              >
                {l.collected}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colOutstanding,
                  styles.alignRight,
                ]}
              >
                {l.outstanding}
              </Text>
            </View>

            {data.rows.map((row, i) => (
              <View
                key={row.userId}
                style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colSalesperson]}>
                  {row.userName}
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    styles.colInvoices,
                    styles.alignRight,
                  ]}
                >
                  {row.invoiceCount}
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    styles.colSales,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(row.totalSales, currency)}
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    styles.colTax,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(row.totalTax, currency)}
                </Text>
                <Text
                  style={[
                    styles.cellTextBold,
                    styles.colTotal,
                    styles.alignRight,
                  ]}
                >
                  {formatAmount(row.totalAmount, currency)}
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    styles.colCollected,
                    styles.alignRight,
                    { color: "#2563eb" },
                  ]}
                >
                  {formatAmount(row.collected, currency)}
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    styles.colOutstanding,
                    styles.alignRight,
                    { color: row.outstanding > 0 ? "#dc2626" : "#0f172a" },
                  ]}
                >
                  {formatAmount(row.outstanding, currency)}
                </Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text style={[styles.cellTextBold, styles.colSalesperson]}>
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
                  styles.colSales,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.totalSales, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTax,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.totalTax, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTotal,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.totalAmount, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colCollected,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.collected, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colOutstanding,
                  styles.alignRight,
                ]}
              >
                {formatAmount(data.totals.outstanding, currency)}
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
