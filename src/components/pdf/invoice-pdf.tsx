import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { numberToWordsLocalized } from "@/lib/number-to-words";
import { translate, type Language } from "@/lib/i18n";

const styles = StyleSheet.create({
  page: {
    padding: "15mm",
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  // Header Section
  header: {
    flexDirection: "row",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  headerLeft: {
    width: "30%",
  },
  headerCenter: {
    width: "40%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    width: "30%",
    alignItems: "flex-end",
  },
  invoiceNumber: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 3,
  },
  invoiceDate: {
    fontSize: 10,
  },
  estimateTitle: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  toLabel: {
    fontSize: 8,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "right",
  },
  customerLocation: {
    fontSize: 9,
    textAlign: "right",
  },
  // Table Section
  table: {
    marginTop: 5,
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  tableRowLast: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  // Column widths
  colSNo: {
    width: "6%",
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 3,
    textAlign: "center",
  },
  colDescription: {
    width: "35%",
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 3,
  },
  colQty: {
    width: "10%",
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 3,
    textAlign: "right",
  },
  colRate: {
    width: "12%",
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 3,
    textAlign: "right",
  },
  colDisPer: {
    width: "9%",
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 3,
    textAlign: "right",
  },
  colDiscount: {
    width: "13%",
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 3,
    textAlign: "right",
  },
  colTotal: {
    width: "15%",
    padding: 3,
    textAlign: "right",
  },
  headerText: {
    fontWeight: "bold",
    fontSize: 9,
  },
  // Footer Section
  footer: {
    flexDirection: "row",
    marginTop: 5,
    justifyContent: "space-between",
  },
  footerLeft: {
    width: "50%",
  },
  footerRight: {
    width: "50%",
    alignItems: "flex-end",
  },
  totalQtyLabel: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 5,
  },
  amountInWords: {
    fontSize: 8,
    marginTop: 5,
    marginBottom: 8,
  },
  balanceSection: {
    marginTop: 5,
  },
  balanceRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  balanceLabel: {
    width: 100,
    fontSize: 9,
  },
  balanceValue: {
    fontSize: 9,
    marginLeft: 10,
  },
  balanceBold: {
    fontWeight: "bold",
  },
  eoeText: {
    fontSize: 7,
    marginTop: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 9,
    width: 55,
  },
  totalValue: {
    fontSize: 9,
    width: 70,
    textAlign: "right",
  },
  netAmountRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 3,
    paddingTop: 2,
  },
  netAmountLabel: {
    fontSize: 10,
    fontWeight: "bold",
    width: 55,
  },
  netAmountValue: {
    fontSize: 10,
    fontWeight: "bold",
    textDecoration: "underline",
    width: 70,
    textAlign: "right",
  },
});

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  unit?: {
    code: string;
  } | null;
  product?: {
    unit?: {
      code: string;
      name: string;
    } | null;
  } | null;
}

interface InvoicePDFProps {
  invoice: {
    invoiceNumber: string;
    issueDate: Date | string;
    customer: {
      name: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
    };
    items: InvoiceItem[];
    subtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    total: number;
    // Saudi fields
    saudiInvoiceType?: string;
    totalVat?: number;
    qrCodeDataURL?: string; // PNG data URL for QR code
  };
  type: "SALES" | "PURCHASE";
  title?: string;
  balanceInfo?: {
    oldBalance: number;
    sales: number;
    balance: number;
  };
  lang?: string;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function InvoicePDF({ invoice, type, title = "ESTIMATE", balanceInfo, lang = "en" }: InvoicePDFProps) {
  const isSaudi = !!invoice.saudiInvoiceType;
  const l = lang as Language;
  const t = (key: string) => translate(key, l);
  const formatAmt = (n: number) => {
    if (isSaudi) {
      const formatted = l === "ar"
        ? n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : n.toFixed(2);
      return l === "ar" ? `${formatted} ر.س` : `SAR ${formatted}`;
    }
    return formatCurrency(n);
  };
  const DISPLAY_ROWS = 12;
  const emptyRowsCount = Math.max(0, DISPLAY_ROWS - invoice.items.length);
  const paddedItems = [
    ...invoice.items,
    ...Array(emptyRowsCount).fill(null),
  ];

  // Calculate totals
  const totalQuantity = invoice.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const totalDiscount = invoice.items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    const discountAmount = (itemTotal * item.discount) / 100;
    return sum + discountAmount;
  }, 0);

  // Calculate discount percentage for each item
  const itemsWithDiscountPercent = invoice.items.map((item) => ({
    ...item,
    discountPercent: item.discount,
    discountAmount: (item.quantity * item.unitPrice * item.discount) / 100,
  }));

  // Customer location string
  const customerLocation = [invoice.customer.city, invoice.customer.state]
    .filter(Boolean)
    .join(", ") || invoice.customer.address || "";

  // Net amount (after discount)
  const netAmount = invoice.subtotal;

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.invoiceNumber}>
              No. {invoice.invoiceNumber}
            </Text>
            <Text style={styles.invoiceDate}>
              Date : {format(new Date(invoice.issueDate), "dd-MM-yy")}
            </Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.estimateTitle}>
              {isSaudi
                ? (invoice.saudiInvoiceType === "SIMPLIFIED" ? "Simplified Tax Invoice" : "Tax Invoice")
                : title}
            </Text>
            {isSaudi && (
              <Text style={{ fontSize: 8, textAlign: "center", color: "#666", marginTop: 2 }}>
                فاتورة ضريبية {invoice.saudiInvoiceType === "SIMPLIFIED" ? "مبسطة" : ""}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.toLabel}>To</Text>
            <Text style={styles.customerName}>{invoice.customer.name}</Text>
            {customerLocation && (
              <Text style={styles.customerLocation}>{customerLocation}</Text>
            )}
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colSNo, styles.headerText]}>{t("pdf.sNo")}</Text>
            <Text style={[styles.colDescription, styles.headerText]}>
              {t("pdf.description")}
            </Text>
            <Text style={[styles.colQty, styles.headerText]}>{t("pdf.qty")}</Text>
            <Text style={[styles.colRate, styles.headerText]}>{t("pdf.rate")}</Text>
            <Text style={[styles.colDisPer, styles.headerText]}>{t("pdf.disPercent")}</Text>
            <Text style={[styles.colDiscount, styles.headerText]}>
              {t("pdf.discount")}
            </Text>
            <Text style={[styles.colTotal, styles.headerText]}>{t("pdf.total")}</Text>
          </View>

          {/* Data Rows */}
          {paddedItems.map((item, index) => (
            <View
              key={index}
              style={
                index === paddedItems.length - 1
                  ? styles.tableRowLast
                  : styles.tableRow
              }
            >
              <Text style={styles.colSNo}>{item ? index + 1 : ""}</Text>
              <Text style={styles.colDescription}>
                {item ? item.description : ""}
              </Text>
              <Text style={styles.colQty}>
                {item
                  ? `${formatCurrency(item.quantity)}${(item.unit?.code || item.product?.unit?.code) ? " " + (item.unit?.code || item.product?.unit?.code)!.toUpperCase() : ""}`
                  : ""}
              </Text>
              <Text style={styles.colRate}>
                {item ? formatCurrency(item.unitPrice) : ""}
              </Text>
              <Text style={styles.colDisPer}>
                {item ? formatCurrency(item.discount) : ""}
              </Text>
              <Text style={styles.colDiscount}>
                {item
                  ? formatCurrency(
                    (item.quantity * item.unitPrice * item.discount) / 100
                  )
                  : ""}
              </Text>
              <Text style={styles.colTotal}>
                {item ? formatCurrency(item.total) : ""}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Left Side */}
          <View style={styles.footerLeft}>
            <View style={styles.totalRow}>
              <Text style={styles.totalQtyLabel}>
                {t("pdf.totalQty")} : {formatCurrency(totalQuantity)}
              </Text>
            </View>
            <Text style={styles.amountInWords}>
              ( {numberToWordsLocalized(netAmount, lang)} )
            </Text>
            {balanceInfo && (
              <View style={styles.balanceSection}>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{t("pdf.oldBalance")}</Text>
                  <Text style={styles.balanceValue}>
                    : {formatCurrency(balanceInfo.oldBalance)}
                  </Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{t("pdf.sales")}</Text>
                  <Text style={styles.balanceValue}>
                    : {formatCurrency(balanceInfo.sales)}
                  </Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={[styles.balanceLabel, styles.balanceBold]}>
                    {t("pdf.balance")}
                  </Text>
                  <Text style={[styles.balanceValue, styles.balanceBold]}>
                    : {formatCurrency(balanceInfo.balance)}
                  </Text>
                </View>
              </View>
            )}
            {isSaudi && invoice.qrCodeDataURL && (
              <View style={{ marginTop: 8 }}>
                <Image src={invoice.qrCodeDataURL} style={{ width: 56, height: 56 }} />
                <Text style={{ fontSize: 6, color: "#666", marginTop: 2 }}>ZATCA QR Code</Text>
              </View>
            )}
            <Text style={styles.eoeText}>{t("pdf.eAndOE")}</Text>
          </View>

          {/* Right Side */}
          <View style={styles.footerRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("pdf.total")}</Text>
              <Text style={styles.totalValue}>
                {formatAmt(invoice.subtotal + totalDiscount)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("pdf.discount")}</Text>
              <Text style={styles.totalValue}>
                {formatAmt(totalDiscount)}
              </Text>
            </View>
            {isSaudi ? (
              (invoice.totalVat ?? 0) > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>VAT 15%</Text>
                  <Text style={styles.totalValue}>
                    {formatAmt(invoice.totalVat ?? 0)}
                  </Text>
                </View>
              )
            ) : (
              <>
                {invoice.totalCgst > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>CGST</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(invoice.totalCgst)}
                    </Text>
                  </View>
                )}
                {invoice.totalSgst > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>SGST</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(invoice.totalSgst)}
                    </Text>
                  </View>
                )}
                {invoice.totalIgst > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>IGST</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(invoice.totalIgst)}
                    </Text>
                  </View>
                )}
              </>
            )}
            <View style={styles.netAmountRow}>
              <Text style={styles.netAmountLabel}>{t("pdf.netTotal")}</Text>
              <Text style={styles.netAmountValue}>
                {formatAmt(invoice.total)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
