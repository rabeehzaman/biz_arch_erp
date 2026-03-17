import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { VATDetailData } from "@/lib/reports/vat-detail";

interface VATDetailPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: VATDetailData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "VAT Detail Report",
    period: "Period",
    to: "to",
    outputVAT: "Output VAT",
    inputVAT: "Input VAT",
    netVATPayable: "Net VAT Payable",
    date: "Date",
    type: "Type",
    docNumber: "Doc #",
    party: "Party",
    taxableAmount: "Taxable Amount",
    vatAmount: "VAT Amount",
    total: "Total",
    totals: "Totals",
    invoice: "Invoice",
    creditNote: "Credit Note",
    purchase: "Purchase Invoice",
    debitNote: "Debit Note",
    noTransactions: "No transactions found for this period.",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "\u062A\u0642\u0631\u064A\u0631 \u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 \u0627\u0644\u062A\u0641\u0635\u064A\u0644\u064A",
    period: "\u0627\u0644\u0641\u062A\u0631\u0629",
    to: "\u0625\u0644\u0649",
    outputVAT: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u062E\u0631\u062C\u0627\u062A",
    inputVAT: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u062F\u062E\u0644\u0627\u062A",
    netVATPayable: "\u0635\u0627\u0641\u064A \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0633\u062A\u062D\u0642\u0629",
    date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E",
    type: "\u0627\u0644\u0646\u0648\u0639",
    docNumber: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062A\u0646\u062F",
    party: "\u0627\u0644\u0637\u0631\u0641",
    taxableAmount: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u062E\u0627\u0636\u0639",
    vatAmount: "\u0645\u0628\u0644\u063A \u0627\u0644\u0636\u0631\u064A\u0628\u0629",
    total: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
    totals: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
    invoice: "\u0641\u0627\u062A\u0648\u0631\u0629",
    creditNote: "\u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646",
    purchase: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A",
    debitNote: "\u0625\u0634\u0639\u0627\u0631 \u0645\u062F\u064A\u0646",
    noTransactions: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u062A\u0631\u0629.",
    page: "\u0635\u0641\u062D\u0629",
    generatedOn: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621",
  },
};

const docTypeLabels: Record<string, { en: string; ar: string }> = {
  INVOICE: { en: "Invoice", ar: "\u0641\u0627\u062A\u0648\u0631\u0629" },
  CREDIT_NOTE: { en: "Credit Note", ar: "\u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646" },
  PURCHASE: { en: "Purchase Invoice", ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A" },
  DEBIT_NOTE: { en: "Debit Note", ar: "\u0625\u0634\u0639\u0627\u0631 \u0645\u062F\u064A\u0646" },
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
    colDate: { width: "10%", paddingRight: 4 },
    colType: { width: "13%", paddingRight: 4 },
    colDocNum: { width: "12%", paddingRight: 4 },
    colParty: { width: "19%", paddingRight: 4 },
    colTaxable: { width: "16%", textAlign: isRTL ? "left" : "right" },
    colVAT: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "16%", textAlign: isRTL ? "left" : "right" },
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

export function VATDetailPDF({
  organization,
  data,
  fromDate,
  toDate,
  lang,
}: VATDetailPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";

  const getDocTypeLabel = (type: string) => {
    const entry = docTypeLabels[type];
    return entry ? entry[lang] : type;
  };

  const isNegativeRow = (docType: string) =>
    docType === "CREDIT_NOTE" || docType === "DEBIT_NOTE";

  const netVATColor =
    data.netVATPayable >= 0 ? styles.heroValueRed : styles.heroValueGreen;

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
            <Text style={styles.heroLabel}>{l.outputVAT}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(data.totalVATOutput, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.inputVAT}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totalVATInput, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netVATPayable}</Text>
            <Text style={netVATColor}>
              {formatAmount(data.netVATPayable, currency)}
            </Text>
          </View>
        </View>

        {/* Transaction Table */}
        {data.rows.length === 0 ? (
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
              <Text style={[styles.tableHeaderText, styles.colDocNum]}>
                {l.docNumber}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colParty]}>
                {l.party}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colTaxable,
                  styles.alignRight,
                ]}
              >
                {l.taxableAmount}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colVAT,
                  styles.alignRight,
                ]}
              >
                {l.vatAmount}
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
            </View>

            {data.rows.map((row, index) => {
              const negative = isNegativeRow(row.docType);
              const amountStyle = negative ? styles.cellRed : styles.cellText;
              return (
                <View
                  key={row.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  wrap={false}
                >
                  <Text style={[styles.cellText, styles.colDate]}>
                    {new Date(row.date).toLocaleDateString(
                      isRTL ? "ar-SA" : "en-US",
                      { day: "2-digit", month: "short", year: "numeric" }
                    )}
                  </Text>
                  <Text style={[styles.cellText, styles.colType]}>
                    {getDocTypeLabel(row.docType)}
                  </Text>
                  <Text style={[styles.cellText, styles.colDocNum]}>
                    {row.docNumber}
                  </Text>
                  <Text style={[styles.cellText, styles.colParty]}>
                    {row.partyName}
                  </Text>
                  <Text
                    style={[amountStyle, styles.colTaxable, styles.alignRight]}
                  >
                    {formatAmount(row.subtotal, currency)}
                  </Text>
                  <Text
                    style={[amountStyle, styles.colVAT, styles.alignRight]}
                  >
                    {formatAmount(row.vatAmount, currency)}
                  </Text>
                  <Text
                    style={[amountStyle, styles.colTotal, styles.alignRight]}
                  >
                    {formatAmount(row.total, currency)}
                  </Text>
                </View>
              );
            })}

            {/* Totals Row */}
            <View style={styles.tableTotalsRow} wrap={false}>
              <Text
                style={[
                  styles.cellTextBold,
                  { width: "54%", paddingRight: 4 },
                ]}
              >
                {l.totals}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTaxable,
                  styles.alignRight,
                ]}
              >
                {formatAmount(
                  data.totalTaxableOutput + data.totalTaxableInput,
                  currency
                )}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colVAT,
                  styles.alignRight,
                ]}
              >
                {formatAmount(
                  data.totalVATOutput + data.totalVATInput,
                  currency
                )}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTotal,
                  styles.alignRight,
                ]}
              >
                {formatAmount(
                  data.rows.reduce((s, r) => s + r.total, 0),
                  currency
                )}
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
