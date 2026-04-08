import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";

interface OpeningStockItem {
  productName: string;
  arabicName?: string | null;
  sku: string | null;
  quantity: number;
  remaining: number;
  unitCost: number;
  totalValue: number;
  stockDate: string;
  unitCode?: string | null;
}

interface WarehouseGroup {
  warehouseName: string;
  items: OpeningStockItem[];
  totalQuantity: number;
  totalValue: number;
}

export interface OpeningStockPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  groups: WarehouseGroup[];
  grandTotals: {
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
  };
  lang: "en" | "ar";
}

const labels = {
  en: {
    title: "Opening Stock Report",
    totalProducts: "Total Products",
    totalQuantity: "Total Quantity",
    totalValue: "Total Value",
    warehouse: "Warehouse",
    no: "#",
    product: "Product",
    sku: "SKU",
    quantity: "Qty",
    remaining: "Remaining",
    unitCost: "Unit Cost",
    total: "Total",
    date: "Date",
    subtotal: "Subtotal",
    grandTotal: "Grand Total",
    noData: "No opening stock entries found.",
    page: "Page",
    generatedOn: "Generated on",
    general: "General",
  },
  ar: {
    title: "\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A",
    totalProducts: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A",
    totalQuantity: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0643\u0645\u064A\u0629",
    totalValue: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0642\u064A\u0645\u0629",
    warehouse: "\u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639",
    no: "#",
    product: "\u0627\u0644\u0645\u0646\u062A\u062C",
    sku: "SKU",
    quantity: "\u0627\u0644\u0643\u0645\u064A\u0629",
    remaining: "\u0627\u0644\u0645\u062A\u0628\u0642\u064A",
    unitCost: "\u0633\u0639\u0631 \u0627\u0644\u0648\u062D\u062F\u0629",
    total: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
    date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E",
    subtotal: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0641\u0631\u0639\u064A",
    grandTotal: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0643\u0644\u064A",
    noData: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u062F\u062E\u0627\u0644\u0627\u062A \u0631\u0635\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D\u064A.",
    page: "\u0635\u0641\u062D\u0629",
    generatedOn: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621",
    general: "\u0639\u0627\u0645",
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

const formatQty = (n: number): string =>
  n % 1 === 0 ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

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
    heroValueBold: {
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
    sectionHeader: {
      backgroundColor: "#f1f5f9",
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 14,
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#334155",
      textAlign: isRTL ? "right" : "left",
    },
    table: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 4,
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
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      backgroundColor: "#ffffff",
    },
    tableRowAlt: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      backgroundColor: "#f8fafc",
    },
    subtotalRow: {
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
    cellTextSub: {
      fontSize: 6.5,
      color: "#64748b",
      textAlign: isRTL ? "right" : "left",
    },
    alignRight: { textAlign: isRTL ? "left" : "right" },
    colNo: { width: "4%", paddingRight: 2 },
    colProduct: { width: "26%", paddingRight: 4 },
    colSku: { width: "10%", paddingRight: 4 },
    colQty: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colRemaining: { width: "10%", textAlign: isRTL ? "left" : "right" },
    colUnitCost: { width: "12%", textAlign: isRTL ? "left" : "right" },
    colTotal: { width: "14%", textAlign: isRTL ? "left" : "right" },
    colDate: { width: "14%", textAlign: isRTL ? "left" : "right" },
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

export function OpeningStockPDF({
  organization,
  groups,
  grandTotals,
  lang,
}: OpeningStockPDFProps) {
  const isRTL = lang === "ar";
  const l = labels[lang];
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const currency = organization.currency || "SAR";
  const multiGroup = groups.length > 1;

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
            </View>
          </View>
        </View>

        {/* Hero Cards */}
        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalProducts}</Text>
            <Text style={styles.heroValueBold}>
              {grandTotals.totalProducts.toLocaleString("en-US")}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalQuantity}</Text>
            <Text style={styles.heroValueBold}>
              {formatQty(grandTotals.totalQuantity)}
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{l.totalValue}</Text>
            <Text style={styles.heroValueGreen}>
              {formatAmount(grandTotals.totalValue, currency)}
            </Text>
          </View>
        </View>

        {/* Table */}
        {grandTotals.totalProducts === 0 ? (
          <View style={styles.table}>
            <Text style={styles.emptyState}>{l.noData}</Text>
          </View>
        ) : (
          groups.map((group, gi) => (
            <View key={gi}>
              {multiGroup && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {l.warehouse}: {group.warehouseName}
                  </Text>
                </View>
              )}

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.colNo]}>{l.no}</Text>
                  <Text style={[styles.tableHeaderText, styles.colProduct]}>{l.product}</Text>
                  <Text style={[styles.tableHeaderText, styles.colSku]}>{l.sku}</Text>
                  <Text style={[styles.tableHeaderText, styles.colQty, styles.alignRight]}>{l.quantity}</Text>
                  <Text style={[styles.tableHeaderText, styles.colRemaining, styles.alignRight]}>{l.remaining}</Text>
                  <Text style={[styles.tableHeaderText, styles.colUnitCost, styles.alignRight]}>{l.unitCost}</Text>
                  <Text style={[styles.tableHeaderText, styles.colTotal, styles.alignRight]}>{l.total}</Text>
                  <Text style={[styles.tableHeaderText, styles.colDate, styles.alignRight]}>{l.date}</Text>
                </View>

                {group.items.map((item, ii) => {
                  const idx = rowIndex++;
                  return (
                    <View
                      key={ii}
                      style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                      wrap={false}
                    >
                      <Text style={[styles.cellText, styles.colNo]}>{ii + 1}</Text>
                      <View style={styles.colProduct}>
                        <Text style={styles.cellText}>
                          {isRTL && item.arabicName ? item.arabicName : item.productName}
                        </Text>
                        {isRTL && item.arabicName && (
                          <Text style={styles.cellTextSub}>{item.productName}</Text>
                        )}
                      </View>
                      <Text style={[styles.cellText, styles.colSku]}>{item.sku || "—"}</Text>
                      <Text style={[styles.cellText, styles.colQty, styles.alignRight]}>
                        {formatQty(item.quantity)}{item.unitCode ? ` ${item.unitCode}` : ""}
                      </Text>
                      <Text style={[styles.cellText, styles.colRemaining, styles.alignRight]}>
                        {formatQty(item.remaining)}
                      </Text>
                      <Text style={[styles.cellText, styles.colUnitCost, styles.alignRight]}>
                        {formatAmount(item.unitCost, currency)}
                      </Text>
                      <Text style={[styles.cellTextBold, styles.colTotal, styles.alignRight]}>
                        {formatAmount(item.totalValue, currency)}
                      </Text>
                      <Text style={[styles.cellText, styles.colDate, styles.alignRight]}>
                        {format(new Date(item.stockDate), "dd MMM yyyy")}
                      </Text>
                    </View>
                  );
                })}

                {/* Subtotal */}
                {multiGroup && (
                  <View style={styles.subtotalRow} wrap={false}>
                    <Text style={[styles.cellTextBold, { width: "40%", paddingRight: 4 }]}>
                      {l.subtotal}: {group.warehouseName}
                    </Text>
                    <Text style={[styles.cellTextBold, styles.colQty, styles.alignRight]}>
                      {formatQty(group.totalQuantity)}
                    </Text>
                    <Text style={[styles.cellTextBold, styles.colRemaining, styles.alignRight]} />
                    <Text style={[styles.cellTextBold, styles.colUnitCost, styles.alignRight]} />
                    <Text style={[styles.cellTextBold, styles.colTotal, styles.alignRight]}>
                      {formatAmount(group.totalValue, currency)}
                    </Text>
                    <Text style={[styles.cellTextBold, styles.colDate]} />
                  </View>
                )}
              </View>
            </View>
          ))
        )}

        {/* Grand Total */}
        {multiGroup && grandTotals.totalProducts > 0 && (
          <View style={[styles.table, { marginTop: 8 }]}>
            <View style={styles.grandTotalRow} wrap={false}>
              <Text style={[styles.cellTextBold, { width: "40%", paddingRight: 4 }]}>
                {l.grandTotal}
              </Text>
              <Text style={[styles.cellTextBold, styles.colQty, styles.alignRight]}>
                {formatQty(grandTotals.totalQuantity)}
              </Text>
              <Text style={[styles.cellTextBold, styles.colRemaining, styles.alignRight]} />
              <Text style={[styles.cellTextBold, styles.colUnitCost, styles.alignRight]} />
              <Text style={[styles.cellTextBold, styles.colTotal, styles.alignRight]}>
                {formatAmount(grandTotals.totalValue, currency)}
              </Text>
              <Text style={[styles.cellTextBold, styles.colDate]} />
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
