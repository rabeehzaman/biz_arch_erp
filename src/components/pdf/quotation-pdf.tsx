import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { numberToWords } from "@/lib/number-to-words";

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
  quotationNumber: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 3,
  },
  quotationDate: {
    fontSize: 10,
  },
  validityDate: {
    fontSize: 10,
    marginTop: 2,
  },
  quotationTitle: {
    fontSize: 24,
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
  eoeText: {
    fontSize: 7,
    marginTop: 10,
  },
  totalRow: {
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 9,
  },
  totalValue: {
    fontSize: 9,
  },
  netAmountRow: {
    marginTop: 3,
    paddingTop: 2,
  },
  netAmountLabel: {
    fontSize: 10,
    fontWeight: "bold",
  },
  netAmountValue: {
    fontSize: 10,
    fontWeight: "bold",
    textDecoration: "underline",
  },
});

interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: {
    unit?: {
      code: string;
      name: string;
    } | null;
  } | null;
}

interface QuotationPDFProps {
  quotation: {
    quotationNumber: string;
    issueDate: Date | string;
    validUntil: Date | string;
    customer: {
      name: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
    };
    items: QuotationItem[];
    subtotal: number;
    taxAmount: number;
    total: number;
  };
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function QuotationPDF({ quotation }: QuotationPDFProps) {
  const DISPLAY_ROWS = 12;
  const emptyRowsCount = Math.max(0, DISPLAY_ROWS - quotation.items.length);
  const paddedItems = [
    ...quotation.items,
    ...Array(emptyRowsCount).fill(null),
  ];

  // Calculate totals
  const totalQuantity = quotation.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const totalDiscount = quotation.items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    const discountAmount = (itemTotal * item.discount) / 100;
    return sum + discountAmount;
  }, 0);

  // Customer location string
  const customerLocation = [quotation.customer.city, quotation.customer.state]
    .filter(Boolean)
    .join(", ") || quotation.customer.address || "";

  // Net amount (after discount)
  const netAmount = quotation.subtotal;

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.quotationNumber}>
              No. {quotation.quotationNumber}
            </Text>
            <Text style={styles.quotationDate}>
              Date : {format(new Date(quotation.issueDate), "dd-MM-yy")}
            </Text>
            <Text style={styles.validityDate}>
              Valid : {format(new Date(quotation.validUntil), "dd-MM-yy")}
            </Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.quotationTitle}>QUOTATION</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.toLabel}>To</Text>
            <Text style={styles.customerName}>{quotation.customer.name}</Text>
            {customerLocation && (
              <Text style={styles.customerLocation}>{customerLocation}</Text>
            )}
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colSNo, styles.headerText]}>S No</Text>
            <Text style={[styles.colDescription, styles.headerText]}>
              Description
            </Text>
            <Text style={[styles.colQty, styles.headerText]}>Qty</Text>
            <Text style={[styles.colRate, styles.headerText]}>Rate</Text>
            <Text style={[styles.colDisPer, styles.headerText]}>Dis %</Text>
            <Text style={[styles.colDiscount, styles.headerText]}>
              Discount
            </Text>
            <Text style={[styles.colTotal, styles.headerText]}>Total</Text>
          </View>

          {/* Data Rows */}
          {paddedItems.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colSNo}>{item ? index + 1 : ""}</Text>
              <Text style={styles.colDescription}>
                {item ? item.description : ""}
              </Text>
              <Text style={styles.colQty}>
                {item
                  ? `${formatCurrency(item.quantity)}${item.product?.unit ? " " + item.product.unit.code.toUpperCase() : ""}`
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
                Total : {formatCurrency(totalQuantity)}
              </Text>
            </View>
            <Text style={styles.amountInWords}>
              ( {numberToWords(netAmount)} )
            </Text>
            <Text style={styles.eoeText}>E & O.E</Text>
          </View>

          {/* Right Side */}
          <View style={styles.footerRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalValue}>
                {formatCurrency(quotation.subtotal + totalDiscount)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalValue}>
                {formatCurrency(totalDiscount)}
              </Text>
            </View>
            <View style={styles.netAmountRow}>
              <Text style={styles.netAmountValue}>
                {formatCurrency(netAmount)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
