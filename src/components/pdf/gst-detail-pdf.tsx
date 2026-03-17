import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { GSTDetailData } from "@/lib/reports/gst-detail";

interface GSTDetailPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: GSTDetailData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "GST Detail Report",
    period: "Period",
    to: "to",
    outputGST: "Output GST",
    inputGST: "Input GST",
    netLiability: "Net GST Liability",
    date: "Date",
    type: "Type",
    docNumber: "Doc #",
    party: "Party",
    taxable: "Taxable",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    total: "Total",
    totals: "Totals",
    noTransactions: "No GST transactions found for this period.",
    invoice: "Invoice",
    creditNote: "Credit Note",
    purchase: "Purchase Invoice",
    debitNote: "Debit Note",
    page: "Page",
    generatedOn: "Generated on",
  },
  ar: {
    title: "تقرير ضريبة السلع والخدمات التفصيلي",
    period: "الفترة",
    to: "إلى",
    outputGST: "ضريبة المخرجات",
    inputGST: "ضريبة المدخلات",
    netLiability: "صافي الالتزام الضريبي",
    date: "التاريخ",
    type: "النوع",
    docNumber: "رقم المستند",
    party: "الطرف",
    taxable: "الخاضع للضريبة",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    total: "الإجمالي",
    totals: "الإجمالي",
    noTransactions: "لا توجد معاملات ضريبية لهذه الفترة.",
    invoice: "فاتورة",
    creditNote: "إشعار دائن",
    purchase: "فاتورة مشتريات",
    debitNote: "إشعار مدين",
    page: "صفحة",
    generatedOn: "تاريخ الإنشاء",
  },
};

const docTypeLabels: Record<string, { en: string; ar: string }> = {
  INVOICE: { en: "Invoice", ar: "فاتورة" },
  CREDIT_NOTE: { en: "Credit Note", ar: "إشعار دائن" },
  PURCHASE: { en: "Purchase Invoice", ar: "فاتورة مشتريات" },
  DEBIT_NOTE: { en: "Debit Note", ar: "إشعار مدين" },
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
    heroValueRed: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#dc2626",
      textAlign: isRTL ? "right" : "left",
    },
    heroValueGreen: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#15803d",
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
    cellRed: {
      fontSize: 7.8,
      color: "#dc2626",
      textAlign: isRTL ? "right" : "left",
    },
    alignRight: {
      textAlign: isRTL ? "left" : "right",
    },
    colDate: { width: "9%", paddingRight: 4 },
    colType: { width: "11%", paddingRight: 4 },
    colDoc: { width: "11%", paddingRight: 4 },
    colParty: { width: "16%", paddingRight: 4 },
    colTaxable: { width: "12%", textAlign: isRTL ? "left" : "right" },
    colCGST: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colSGST: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colIGST: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "11%", textAlign: isRTL ? "left" : "right" },
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

export function GSTDetailPDF({
  organization,
  data,
  fromDate,
  toDate,
  lang,
}: GSTDetailPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "INR";

  const totalOutputGST = data.totalCGSTOutput + data.totalSGSTOutput + data.totalIGSTOutput;
  const totalInputGST = data.totalCGSTInput + data.totalSGSTInput + data.totalIGSTInput;
  const netLiability = data.netLiabilityCGST + data.netLiabilitySGST + data.netLiabilityIGST;

  const getDocTypeLabel = (docType: string) => {
    const entry = docTypeLabels[docType];
    return entry ? entry[lang] : docType;
  };

  const isNegativeRow = (docType: string) =>
    docType === "CREDIT_NOTE" || docType === "DEBIT_NOTE";

  // Grand totals across all rows
  const grandTaxable = data.rows.reduce((s, r) => s + r.subtotal, 0);
  const grandCGST = data.rows.reduce((s, r) => s + r.cgst, 0);
  const grandSGST = data.rows.reduce((s, r) => s + r.sgst, 0);
  const grandIGST = data.rows.reduce((s, r) => s + r.igst, 0);
  const grandTotal = data.rows.reduce((s, r) => s + r.total, 0);

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
            <Text style={styles.heroLabel}>{l.outputGST}</Text>
            <Text style={styles.heroValueRed}>
              {formatAmount(totalOutputGST, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.inputGST}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(totalInputGST, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.netLiability}</Text>
            <Text style={netLiability >= 0 ? styles.heroValueRed : styles.heroValueGreen}>
              {formatAmount(netLiability, currency)}
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
              <Text style={[styles.tableHeaderText, styles.colDoc]}>
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
                {l.taxable}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colCGST,
                  styles.alignRight,
                ]}
              >
                {l.cgst}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colSGST,
                  styles.alignRight,
                ]}
              >
                {l.sgst}
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.colIGST,
                  styles.alignRight,
                ]}
              >
                {l.igst}
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
              const isNeg = isNegativeRow(row.docType);
              const cellStyle = isNeg ? styles.cellRed : styles.cellText;

              return (
                <View
                  key={row.id}
                  style={
                    index % 2 === 0 ? styles.tableRow : styles.tableRowAlt
                  }
                  wrap={false}
                >
                  <Text style={[cellStyle, styles.colDate]}>
                    {new Date(row.date).toLocaleDateString(
                      isRTL ? "ar-SA" : "en-US",
                      { day: "2-digit", month: "short", year: "numeric" }
                    )}
                  </Text>
                  <Text style={[cellStyle, styles.colType]}>
                    {getDocTypeLabel(row.docType)}
                  </Text>
                  <Text style={[cellStyle, styles.colDoc]}>
                    {row.docNumber}
                  </Text>
                  <Text style={[cellStyle, styles.colParty]}>
                    {row.partyName}
                  </Text>
                  <Text
                    style={[cellStyle, styles.colTaxable, styles.alignRight]}
                  >
                    {formatAmount(row.subtotal, currency)}
                  </Text>
                  <Text style={[cellStyle, styles.colCGST, styles.alignRight]}>
                    {formatAmount(row.cgst, currency)}
                  </Text>
                  <Text style={[cellStyle, styles.colSGST, styles.alignRight]}>
                    {formatAmount(row.sgst, currency)}
                  </Text>
                  <Text style={[cellStyle, styles.colIGST, styles.alignRight]}>
                    {formatAmount(row.igst, currency)}
                  </Text>
                  <Text
                    style={[cellStyle, styles.colTotal, styles.alignRight]}
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
                  { width: "47%", paddingRight: 4 },
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
                {formatAmount(grandTaxable, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colCGST,
                  styles.alignRight,
                ]}
              >
                {formatAmount(grandCGST, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colSGST,
                  styles.alignRight,
                ]}
              >
                {formatAmount(grandSGST, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colIGST,
                  styles.alignRight,
                ]}
              >
                {formatAmount(grandIGST, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTotal,
                  styles.alignRight,
                ]}
              >
                {formatAmount(grandTotal, currency)}
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
