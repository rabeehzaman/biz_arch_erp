import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { numberToWordsLocalized } from "@/lib/number-to-words";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const THEME = {
  primary: "#1B4F72",
  primaryLight: "#2E86C1",
  accent: "#D4E6F1",
  headerBg: "#1B4F72",
  altRow: "#F2F8FC",
  border: "#B0BEC5",
  borderDark: "#546E7A",
  text: "#212121",
  textLight: "#546E7A",
  white: "#FFFFFF",
};

const Ar = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <Text style={[{ fontFamily: ARABIC_FONT_FAMILY }, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: THEME.text,
  },
  // Header
  headerBar: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 4,
    marginBottom: 14,
  },
  headerTitleEn: {
    fontSize: 16,
    fontWeight: "bold",
    color: THEME.white,
    letterSpacing: 0.5,
  },
  headerTitleAr: {
    fontSize: 17,
    fontWeight: "bold",
    color: THEME.white,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
  },
  // Info boxes
  infoSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 4,
    padding: 8,
    backgroundColor: THEME.white,
  },
  infoCardLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: THEME.accent,
  },
  infoLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: THEME.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  infoLabelAr: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.primary,
    fontFamily: ARABIC_FONT_FAMILY,
  },
  infoName: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 1,
  },
  infoNameAr: {
    fontSize: 10,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
    marginBottom: 1,
  },
  infoText: {
    fontSize: 7.5,
    color: THEME.textLight,
    marginBottom: 1,
  },
  infoTextAr: {
    fontSize: 8,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
    color: THEME.textLight,
    marginBottom: 1,
  },
  // Details strip
  detailsStrip: {
    flexDirection: "row",
    backgroundColor: THEME.accent,
    borderRadius: 4,
    padding: 6,
    marginBottom: 12,
    gap: 20,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: THEME.primary,
  },
  detailLabelAr: {
    fontSize: 7.5,
    fontFamily: ARABIC_FONT_FAMILY,
    color: THEME.primary,
  },
  detailValue: {
    fontSize: 8,
    fontWeight: "bold",
  },
  // Table
  table: {
    marginBottom: 0,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: THEME.headerBg,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 22,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: THEME.border,
    minHeight: 16,
    alignItems: "center",
  },
  cell: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    fontSize: 7,
  },
  headerCellWrap: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 0.5,
    borderRightColor: "rgba(255,255,255,0.3)",
  },
  headerCellWrapLast: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextEn: {
    fontSize: 7,
    fontWeight: "bold",
    color: THEME.white,
    textAlign: "center",
  },
  headerTextAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    fontFamily: ARABIC_FONT_FAMILY,
  },
  // Totals
  totalsBox: {
    borderWidth: 0.5,
    borderColor: THEME.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    overflow: "hidden",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  totalLineBorder: {
    borderTopWidth: 0.5,
    borderTopColor: THEME.border,
  },
  totalLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  totalLabel: {
    fontSize: 7.5,
  },
  totalLabelAr: {
    fontSize: 8,
    fontFamily: ARABIC_FONT_FAMILY,
    color: THEME.textLight,
  },
  totalValue: {
    fontSize: 7.5,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: THEME.primary,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  grandTotalLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.white,
  },
  grandTotalLabelAr: {
    fontSize: 10,
    fontWeight: "bold",
    color: THEME.white,
    fontFamily: ARABIC_FONT_FAMILY,
  },
  grandTotalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.white,
  },
  // Words
  wordsBox: {
    backgroundColor: THEME.accent,
    borderRadius: 3,
    padding: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  wordsEn: {
    fontSize: 7,
    color: THEME.text,
  },
  wordsAr: {
    fontSize: 8,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
    color: THEME.text,
    marginTop: 1,
  },
  // Balance
  balanceStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderColor: THEME.border,
    borderRadius: 3,
    padding: 5,
    marginBottom: 6,
  },
  balanceItem: {
    fontSize: 7.5,
  },
  balanceItemBold: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  // Footer
  footerDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.primary,
    marginBottom: 6,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notesSection: {
    flex: 1,
    paddingRight: 12,
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: THEME.primary,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 7,
    color: THEME.textLight,
  },
  signatureBlock: {
    width: 160,
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    marginTop: 28,
    marginBottom: 4,
  },
  signatureText: {
    fontSize: 7,
    color: THEME.textLight,
  },
  eoe: {
    fontSize: 6,
    color: THEME.textLight,
    marginTop: 6,
    textAlign: "center",
  },
});

const COL = {
  sl: "5%",
  item: "29%",
  qty: "8%",
  rate: "11%",
  disc: "7%",
  taxable: "12%",
  vatPct: "7%",
  vatAmt: "10%",
  total: "11%",
};

interface PurchaseInvoiceItem {
  description: string;
  arabicName?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
  vatAmount: number;
  unit?: { code: string } | null;
  product?: { unit?: { code: string } | null; arabicName?: string | null } | null;
}

export interface PurchaseInvoicePDFProps {
  invoice: {
    invoiceNumber: string;
    issueDate: Date | string;
    supplier: {
      name: string;
      arabicName?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      vatNumber?: string | null;
    };
    organization: {
      name: string;
      arabicName?: string | null;
      arabicAddress?: string | null;
      vatNumber?: string | null;
    };
    items: PurchaseInvoiceItem[];
    subtotal: number;
    totalVat: number;
    roundOffAmount?: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    notes?: string | null;
    currency?: string | null;
  };
  balanceInfo?: { oldBalance: number; sales: number; balance: number };
  headerImageUrl?: string;
  footerImageUrl?: string;
}

export function PurchaseInvoicePDF({
  invoice,
  balanceInfo,
  headerImageUrl,
  footerImageUrl,
}: PurchaseInvoicePDFProps) {
  const itemsComputed = invoice.items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const discountAmt = (gross * item.discount) / 100;
    const taxableValue = gross - discountAmt;
    return { ...item, gross, discountAmt, taxableValue };
  });

  const taxableTotal = itemsComputed.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalDiscount = itemsComputed.reduce((sum, i) => sum + i.discountAmt, 0);
  const totalVatComputed = itemsComputed.reduce((sum, i) => sum + i.vatAmount, 0);

  const supplierLocation = [invoice.supplier.city, invoice.supplier.state]
    .filter(Boolean)
    .join(", ");

  const hasHeader = !!headerImageUrl;
  const hasFooter = !!footerImageUrl;
  const hasImages = hasHeader || hasFooter;

  const pageStyle = hasImages
    ? { ...styles.page, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }
    : styles.page;

  const contentStyle = hasImages
    ? { paddingHorizontal: 28 as const, flexGrow: 1 as const }
    : {};

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={pageStyle}>
        {hasHeader && (
          <View style={{ width: "100%" }} fixed>
            <Image src={headerImageUrl} style={{ width: "100%" }} />
          </View>
        )}

        <View style={contentStyle}>
          {hasHeader && <View style={{ height: 8 }} />}

          {/* Title Bar */}
          <View style={styles.headerBar}>
            <Text style={styles.headerTitleEn}>PURCHASE INVOICE</Text>
            <Ar style={styles.headerTitleAr}>{"\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A"}</Ar>
          </View>

          {/* Invoice Details Strip */}
          <View style={styles.detailsStrip}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Invoice No.</Text>
              <Ar style={styles.detailLabelAr}>{"\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629"}</Ar>
              <Text style={styles.detailValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date</Text>
              <Ar style={styles.detailLabelAr}>{"\u0627\u0644\u062A\u0627\u0631\u064A\u062E"}</Ar>
              <Text style={styles.detailValue}>
                {format(new Date(invoice.issueDate), "dd/MM/yyyy")}
              </Text>
            </View>
            {invoice.currency && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Currency</Text>
                <Ar style={styles.detailLabelAr}>{"\u0627\u0644\u0639\u0645\u0644\u0629"}</Ar>
                <Text style={styles.detailValue}>{invoice.currency}</Text>
              </View>
            )}
          </View>

          {/* Supplier + Organization Info */}
          <View style={styles.infoSection}>
            {/* Supplier */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardLabel}>
                <Text style={styles.infoLabelEn}>Supplier</Text>
                <Ar style={styles.infoLabelAr}>{"\u0627\u0644\u0645\u0648\u0631\u062F"}</Ar>
              </View>
              <Text style={styles.infoName}>{invoice.supplier.name}</Text>
              {invoice.supplier.arabicName && (
                <Text style={styles.infoNameAr}>{invoice.supplier.arabicName}</Text>
              )}
              {invoice.supplier.address && (
                <Text style={styles.infoText}>{invoice.supplier.address}</Text>
              )}
              {supplierLocation && (
                <Text style={styles.infoText}>{supplierLocation}</Text>
              )}
              {invoice.supplier.vatNumber && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                  <Text style={[styles.infoText, { fontWeight: "bold", color: THEME.text }]}>
                    TRN: {invoice.supplier.vatNumber}
                  </Text>
                  <Ar style={{ fontSize: 7, color: THEME.textLight }}>{"\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A"}</Ar>
                </View>
              )}
            </View>

            {/* Organization (Buyer) */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardLabel}>
                <Text style={styles.infoLabelEn}>Buyer</Text>
                <Ar style={styles.infoLabelAr}>{"\u0627\u0644\u0645\u0634\u062A\u0631\u064A"}</Ar>
              </View>
              <Text style={styles.infoName}>{invoice.organization.name}</Text>
              {invoice.organization.arabicName && (
                <Text style={styles.infoNameAr}>{invoice.organization.arabicName}</Text>
              )}
              {invoice.organization.arabicAddress && (
                <Text style={styles.infoTextAr}>{invoice.organization.arabicAddress}</Text>
              )}
              {invoice.organization.vatNumber && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                  <Text style={[styles.infoText, { fontWeight: "bold", color: THEME.text }]}>
                    TRN: {invoice.organization.vatNumber}
                  </Text>
                  <Ar style={{ fontSize: 7, color: THEME.textLight }}>{"\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A"}</Ar>
                </View>
              )}
            </View>
          </View>

          {/* Items Table */}
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.headerCellWrap, { width: COL.sl }]}>
                <Text style={styles.headerTextEn}>#</Text>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.item }]}>
                <Text style={styles.headerTextEn}>Description</Text>
                <Ar style={styles.headerTextAr}>{"\u0627\u0644\u0648\u0635\u0641"}</Ar>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.qty }]}>
                <Text style={styles.headerTextEn}>Qty</Text>
                <Ar style={styles.headerTextAr}>{"\u0627\u0644\u0643\u0645\u064A\u0629"}</Ar>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.rate }]}>
                <Text style={styles.headerTextEn}>Unit Price</Text>
                <Ar style={styles.headerTextAr}>{"\u0633\u0639\u0631 \u0627\u0644\u0648\u062D\u062F\u0629"}</Ar>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.disc }]}>
                <Text style={styles.headerTextEn}>Disc.</Text>
                <Ar style={styles.headerTextAr}>{"\u062E\u0635\u0645"}</Ar>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.taxable }]}>
                <Text style={styles.headerTextEn}>Taxable</Text>
                <Ar style={styles.headerTextAr}>{"\u062E\u0627\u0636\u0639"}</Ar>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.vatPct }]}>
                <Text style={styles.headerTextEn}>VAT%</Text>
                <Ar style={styles.headerTextAr}>{"\u0636.\u0642.\u0645%"}</Ar>
              </View>
              <View style={[styles.headerCellWrap, { width: COL.vatAmt }]}>
                <Text style={styles.headerTextEn}>VAT</Text>
                <Ar style={styles.headerTextAr}>{"\u0627\u0644\u0636\u0631\u064A\u0628\u0629"}</Ar>
              </View>
              <View style={[styles.headerCellWrapLast, { width: COL.total }]}>
                <Text style={styles.headerTextEn}>Total</Text>
                <Ar style={styles.headerTextAr}>{"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A"}</Ar>
              </View>
            </View>

            {/* Data Rows */}
            {itemsComputed.map((item, index) => {
              const unitCode = item.unit?.code || item.product?.unit?.code;
              const qtyStr = `${formatCurrency(item.quantity)}${unitCode ? ` ${unitCode.toUpperCase()}` : ""}`;
              return (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? { backgroundColor: THEME.altRow } : {},
                  ]}
                >
                  <Text style={[styles.cell, { width: COL.sl, textAlign: "center", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {index + 1}
                  </Text>
                  <View style={[styles.cell, { width: COL.item, borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    <Text style={{ fontSize: 7 }}>{item.description}</Text>
                    {item.arabicName && (
                      <Text style={{ fontSize: 7.5, fontFamily: ARABIC_FONT_FAMILY, textAlign: "right" }}>
                        {item.arabicName}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.cell, { width: COL.qty, textAlign: "right", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {qtyStr}
                  </Text>
                  <Text style={[styles.cell, { width: COL.rate, textAlign: "right", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {formatCurrency(item.unitPrice)}
                  </Text>
                  <Text style={[styles.cell, { width: COL.disc, textAlign: "right", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {item.discountAmt > 0 ? formatCurrency(item.discountAmt) : "-"}
                  </Text>
                  <Text style={[styles.cell, { width: COL.taxable, textAlign: "right", backgroundColor: index % 2 === 1 ? "#E8F0F8" : "#F0F6FB", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {formatCurrency(item.taxableValue)}
                  </Text>
                  <Text style={[styles.cell, { width: COL.vatPct, textAlign: "center", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {item.vatRate > 0 ? `${item.vatRate}%` : "0%"}
                  </Text>
                  <Text style={[styles.cell, { width: COL.vatAmt, textAlign: "right", borderRightWidth: 0.5, borderRightColor: THEME.border }]}>
                    {item.vatAmount > 0 ? formatCurrency(item.vatAmount) : "0.00"}
                  </Text>
                  <Text style={[styles.cell, { width: COL.total, textAlign: "right" }]}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
              );
            })}

            {/* Totals row in table */}
            <View style={[styles.tableRow, { backgroundColor: THEME.accent, borderBottomWidth: 0 }]}>
              <Text style={[styles.cell, { width: COL.sl }]} />
              <View style={[styles.cell, { width: COL.item, flexDirection: "row", justifyContent: "space-between" }]}>
                <Text style={{ fontWeight: "bold", fontSize: 7.5 }}>Total</Text>
                <Ar style={{ fontWeight: "bold", fontSize: 8 }}>{"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A"}</Ar>
              </View>
              <Text style={[styles.cell, { width: COL.qty }]} />
              <Text style={[styles.cell, { width: COL.rate }]} />
              <Text style={[styles.cell, { width: COL.disc, textAlign: "right", fontWeight: "bold" }]}>
                {totalDiscount > 0 ? formatCurrency(totalDiscount) : ""}
              </Text>
              <Text style={[styles.cell, { width: COL.taxable, textAlign: "right", fontWeight: "bold" }]}>
                {formatCurrency(taxableTotal)}
              </Text>
              <Text style={[styles.cell, { width: COL.vatPct }]} />
              <Text style={[styles.cell, { width: COL.vatAmt, textAlign: "right", fontWeight: "bold" }]}>
                {formatCurrency(totalVatComputed)}
              </Text>
              <Text style={[styles.cell, { width: COL.total, textAlign: "right", fontWeight: "bold" }]}>
                {formatCurrency(invoice.total)}
              </Text>
            </View>
          </View>

          {/* Summary Totals */}
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Ar style={styles.totalLabelAr}>{"\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0641\u0631\u0639\u064A"}</Ar>
              </View>
              <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
            </View>
            <View style={[styles.totalLine, styles.totalLineBorder]}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabel}>VAT</Text>
                <Ar style={styles.totalLabelAr}>{"\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629"}</Ar>
              </View>
              <Text style={styles.totalValue}>{formatCurrency(invoice.totalVat)}</Text>
            </View>
            {(invoice.roundOffAmount ?? 0) !== 0 && (
              <View style={[styles.totalLine, styles.totalLineBorder]}>
                <View style={styles.totalLabelGroup}>
                  <Text style={styles.totalLabel}>Round Off</Text>
                  <Ar style={styles.totalLabelAr}>{"\u0627\u0644\u062A\u0642\u0631\u064A\u0628"}</Ar>
                </View>
                <Text style={styles.totalValue}>{formatCurrency(invoice.roundOffAmount ?? 0)}</Text>
              </View>
            )}
            {/* Grand Total */}
            <View style={styles.grandTotalRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                <Ar style={styles.grandTotalLabelAr}>{"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0643\u0644\u064A"}</Ar>
              </View>
              <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
            </View>
          </View>

          {/* Amount in Words */}
          <View style={styles.wordsBox}>
            <Text style={styles.wordsEn}>
              {numberToWordsLocalized(invoice.total, "en")}
            </Text>
            <Text style={styles.wordsAr}>
              {numberToWordsLocalized(invoice.total, "ar")}
            </Text>
          </View>

          {/* Amount Paid / Balance Due */}
          {(invoice.amountPaid > 0 || invoice.balanceDue > 0) && (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16, marginBottom: 4 }}>
              {invoice.amountPaid > 0 && (
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 7.5 }}>Amount Paid:</Text>
                  <Ar style={{ fontSize: 8, color: THEME.textLight }}>{"\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062F\u0641\u0648\u0639"}</Ar>
                  <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>{formatCurrency(invoice.amountPaid)}</Text>
                </View>
              )}
              {invoice.balanceDue > 0 && (
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 8, fontWeight: "bold", color: "#C0392B" }}>Balance Due:</Text>
                  <Ar style={{ fontSize: 8, fontWeight: "bold", color: "#C0392B" }}>{"\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062A\u0628\u0642\u064A"}</Ar>
                  <Text style={{ fontSize: 8, fontWeight: "bold", color: "#C0392B" }}>{formatCurrency(invoice.balanceDue)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Balance Info */}
          {balanceInfo && (
            <View style={styles.balanceStrip}>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <Text style={styles.balanceItem}>Old Balance:</Text>
                <Ar style={{ fontSize: 7, color: THEME.textLight }}>{"\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0633\u0627\u0628\u0642"}</Ar>
                <Text style={styles.balanceItem}>{formatCurrency(balanceInfo.oldBalance)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <Text style={styles.balanceItem}>This Invoice:</Text>
                <Ar style={{ fontSize: 7, color: THEME.textLight }}>{"\u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629"}</Ar>
                <Text style={styles.balanceItem}>{formatCurrency(balanceInfo.sales)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <Text style={styles.balanceItemBold}>Balance:</Text>
                <Ar style={{ fontSize: 7.5, fontWeight: "bold" }}>{"\u0627\u0644\u0631\u0635\u064A\u062F"}</Ar>
                <Text style={styles.balanceItemBold}>{formatCurrency(balanceInfo.balance)}</Text>
              </View>
            </View>
          )}

          {/* Notes & Signature */}
          <View style={styles.footerDivider} />
          <View style={styles.footerRow}>
            <View style={styles.notesSection}>
              {invoice.notes && (
                <>
                  <View style={{ flexDirection: "row", gap: 4, marginBottom: 2 }}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Ar style={{ fontSize: 7.5, fontWeight: "bold", color: THEME.primary }}>{"\u0645\u0644\u0627\u062D\u0638\u0627\u062A"}</Ar>
                  </View>
                  <Text style={styles.notesText}>{invoice.notes}</Text>
                </>
              )}
            </View>
            <View style={styles.signatureBlock}>
              <Text style={{ fontSize: 7.5 }}>For {invoice.organization.name}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureText}>Authorised Signatory</Text>
              <Ar style={{ fontSize: 7, color: THEME.textLight }}>{"\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0645\u0641\u0648\u0636"}</Ar>
            </View>
          </View>

          <Text style={styles.eoe}>E. & O.E</Text>
        </View>

        {hasFooter && (
          <View style={{ width: "100%", marginTop: "auto" }} fixed>
            <Image src={footerImageUrl} style={{ width: "100%" }} />
          </View>
        )}
      </Page>
    </Document>
  );
}
