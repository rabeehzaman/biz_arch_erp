import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";
import type { BranchSalesData } from "@/lib/reports/branch-sales";

interface BranchSalesPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  data: BranchSalesData;
  fromDate: string;
  toDate: string;
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Branch Sales Report",
    period: "Period",
    to: "to",
    totalCash: "Total Cash",
    totalBank: "Total Bank",
    grandTotal: "Grand Total",
    branch: "Branch",
    session: "Session",
    opened: "Opened",
    closed: "Closed",
    cash: "Cash",
    bank: "Bank",
    total: "Total",
    txns: "Txns",
    branchTotal: "Branch Total",
    noData: "No POS sessions found for this period.",
    page: "Page",
    generatedOn: "Generated on",
    open: "Open",
  },
  ar: {
    title: "\u062A\u0642\u0631\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639",
    period: "\u0627\u0644\u0641\u062A\u0631\u0629",
    to: "\u0625\u0644\u0649",
    totalCash: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0646\u0642\u062F\u064A",
    totalBank: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0628\u0646\u0643\u064A",
    grandTotal: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0643\u0644\u064A",
    branch: "\u0627\u0644\u0641\u0631\u0639",
    session: "\u0627\u0644\u062C\u0644\u0633\u0629",
    opened: "\u0627\u0644\u0641\u062A\u062D",
    closed: "\u0627\u0644\u0625\u063A\u0644\u0627\u0642",
    cash: "\u0646\u0642\u062F\u064A",
    bank: "\u0628\u0646\u0643\u064A",
    total: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
    txns: "\u0639\u0645\u0644\u064A\u0627\u062A",
    branchTotal: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0631\u0639",
    noData: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0627\u062A \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u062A\u0631\u0629.",
    page: "\u0635\u0641\u062D\u0629",
    generatedOn: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621",
    open: "\u0645\u0641\u062A\u0648\u062D",
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

const formatTime = (iso: string, isRTL: boolean): string => {
  const d = new Date(iso);
  return d.toLocaleString(isRTL ? "ar-SA" : "en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
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
    heroValueBold: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0f172a",
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
    branchTotalRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderTopWidth: 1.5,
      borderTopColor: "#94a3b8",
      backgroundColor: "#f1f5f9",
    },
    grandTotalRow: {
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
    colBranch: { width: "15%", paddingRight: 4 },
    colSession: { width: "11%", paddingRight: 4 },
    colOpened: { width: "16%", paddingRight: 4 },
    colClosed: { width: "16%", paddingRight: 4 },
    colCash: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colBank: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "14%", textAlign: isRTL ? "left" : "right" },
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

export function BranchSalesPDF({
  organization,
  data,
  fromDate,
  toDate,
  lang,
}: BranchSalesPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";

  let rowIndex = 0;

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
            <Text style={styles.heroLabel}>{l.totalCash}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(data.totals.cash, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalBank}</Text>
            <Text style={styles.heroValueBlue}>
              {formatAmount(data.totals.bank, currency)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.grandTotal}</Text>
            <Text style={styles.heroValueBold}>
              {formatAmount(data.totals.total, currency)}
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
              <Text style={[styles.tableHeaderText, styles.colBranch]}>
                {l.branch}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colSession]}>
                {l.session}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colOpened]}>
                {l.opened}
              </Text>
              <Text style={[styles.tableHeaderText, styles.colClosed]}>
                {l.closed}
              </Text>
              <Text
                style={[styles.tableHeaderText, styles.colCash, styles.alignRight]}
              >
                {l.cash}
              </Text>
              <Text
                style={[styles.tableHeaderText, styles.colBank, styles.alignRight]}
              >
                {l.bank}
              </Text>
              <Text
                style={[styles.tableHeaderText, styles.colTotal, styles.alignRight]}
              >
                {l.total}
              </Text>
            </View>

            {data.rows.map((branch) => (
              <View key={branch.branchId ?? "unassigned"}>
                {branch.sessions.map((s) => {
                  const idx = rowIndex++;
                  return (
                    <View
                      key={s.sessionId}
                      style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                      wrap={false}
                    >
                      <Text style={[styles.cellText, styles.colBranch]}>
                        {idx === rowIndex - branch.sessions.length
                          ? branch.branchName
                          : ""}
                      </Text>
                      <Text style={[styles.cellText, styles.colSession]}>
                        {s.sessionLabel}
                      </Text>
                      <Text style={[styles.cellText, styles.colOpened]}>
                        {formatTime(s.openedAt, isRTL)}
                      </Text>
                      <Text style={[styles.cellText, styles.colClosed]}>
                        {s.closedAt ? formatTime(s.closedAt, isRTL) : l.open}
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          styles.colCash,
                          styles.alignRight,
                          { color: "#15803d" },
                        ]}
                      >
                        {formatAmount(s.cash, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          styles.colBank,
                          styles.alignRight,
                          { color: "#2563eb" },
                        ]}
                      >
                        {formatAmount(s.bank, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.cellTextBold,
                          styles.colTotal,
                          styles.alignRight,
                        ]}
                      >
                        {formatAmount(s.total, currency)}
                      </Text>
                    </View>
                  );
                })}

                {/* Branch subtotal */}
                <View style={styles.branchTotalRow} wrap={false}>
                  <Text
                    style={[
                      styles.cellTextBold,
                      { width: "58%", paddingRight: 4 },
                    ]}
                  >
                    {l.branchTotal}: {branch.branchName}
                  </Text>
                  <Text
                    style={[
                      styles.cellTextBold,
                      styles.colCash,
                      styles.alignRight,
                      { color: "#15803d" },
                    ]}
                  >
                    {formatAmount(branch.totalCash, currency)}
                  </Text>
                  <Text
                    style={[
                      styles.cellTextBold,
                      styles.colBank,
                      styles.alignRight,
                      { color: "#2563eb" },
                    ]}
                  >
                    {formatAmount(branch.totalBank, currency)}
                  </Text>
                  <Text
                    style={[
                      styles.cellTextBold,
                      styles.colTotal,
                      styles.alignRight,
                    ]}
                  >
                    {formatAmount(branch.grandTotal, currency)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Grand Total */}
            <View style={styles.grandTotalRow} wrap={false}>
              <Text
                style={[
                  styles.cellTextBold,
                  { width: "58%", paddingRight: 4 },
                ]}
              >
                {l.grandTotal}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colCash,
                  styles.alignRight,
                  { color: "#15803d" },
                ]}
              >
                {formatAmount(data.totals.cash, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colBank,
                  styles.alignRight,
                  { color: "#2563eb" },
                ]}
              >
                {formatAmount(data.totals.bank, currency)}
              </Text>
              <Text
                style={[
                  styles.cellTextBold,
                  styles.colTotal,
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
