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

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const styles = StyleSheet.create({
  page: {
    paddingTop: "25mm",
    paddingBottom: "15mm",
    paddingLeft: "10mm",
    paddingRight: "10mm",
    fontSize: 7,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  // Info boxes row
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#333",
  },
  infoBoxHeader: {
    backgroundColor: "#f0f0f0",
    padding: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  infoBoxHeaderText: {
    fontSize: 7,
    fontWeight: "bold",
  },
  infoBoxBody: {
    padding: 4,
    minHeight: 32,
  },
  infoBoxText: {
    fontSize: 7,
    marginBottom: 1,
  },
  // Place of supply
  placeOfSupply: {
    fontSize: 7,
    marginBottom: 6,
  },
  // Items table
  table: {
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#333",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    backgroundColor: "#fafafa",
  },
  cell: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderRightColor: "#333",
  },
  cellLast: {
    padding: 2,
    fontSize: 6.5,
  },
  headerCell: {
    padding: 2,
    fontSize: 6.5,
    fontWeight: "bold",
    borderRightWidth: 1,
    borderRightColor: "#333",
  },
  headerCellLast: {
    padding: 2,
    fontSize: 6.5,
    fontWeight: "bold",
  },
  // HSN summary table
  hsnTable: {
    marginBottom: 6,
  },
  hsnTitle: {
    fontSize: 8,
    fontWeight: "bold",
    marginBottom: 3,
  },
  // Totals section
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 6,
  },
  totalsBox: {
    width: "40%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  totalsLabel: {
    fontSize: 7,
  },
  totalsValue: {
    fontSize: 7,
    textAlign: "right",
  },
  totalsBold: {
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginTop: 2,
  },
  // Amount in words
  amountInWords: {
    fontSize: 7,
    marginBottom: 6,
  },
  // Balance info
  balanceSection: {
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  balanceLabel: {
    width: 90,
    fontSize: 7,
  },
  balanceValue: {
    fontSize: 7,
  },
  // Notes
  notesSection: {
    marginBottom: 4,
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: "bold",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 6.5,
  },
  // E&OE
  eoe: {
    fontSize: 6,
    marginTop: 4,
  },
});

// Column widths
const COL = {
  sno: "3%",
  desc: "22%",
  hsn: "7%",
  qty: "6%",
  rate: "8%",
  disc: "5%",
  taxable: "10%",
  gstPct: "5%",
  cgst: "8.5%",
  sgst: "8.5%",
  igst: "8.5%",
  total: "8.5%",
};

interface InvoiceA4Item {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  hsnCode: string | null;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  unit?: { code: string } | null;
  product?: { unit?: { code: string } | null } | null;
}

interface InvoiceA4PDFProps {
  invoice: {
    invoiceNumber: string;
    issueDate: Date | string;
    customer: {
      name: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      gstin?: string | null;
    };
    organization: { name: string; gstin?: string | null };
    items: InvoiceA4Item[];
    subtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    roundOffAmount?: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    isInterState: boolean;
    placeOfSupply?: string | null;
    notes?: string | null;
    terms?: string | null;
    createdByName?: string | null;
    paymentType?: string;
  };
  type: "SALES" | "PURCHASE";
  title?: string;
  balanceInfo?: { oldBalance: number; sales: number; balance: number };
  headerImageUrl?: string;
  footerImageUrl?: string;
}

export function InvoiceA4PDF({
  invoice,
  title = "Tax Invoice",
  balanceInfo,
  headerImageUrl,
  footerImageUrl,
}: InvoiceA4PDFProps) {
  // Compute taxable value per item
  const itemsComputed = invoice.items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const discountAmt = (gross * item.discount) / 100;
    const taxableValue = gross - discountAmt;
    return { ...item, taxableValue };
  });

  // HSN-wise summary
  const hsnMap = new Map<
    string,
    {
      hsnCode: string;
      taxableValue: number;
      cgstRate: number;
      cgstAmount: number;
      sgstRate: number;
      sgstAmount: number;
      igstRate: number;
      igstAmount: number;
      totalTax: number;
    }
  >();

  for (const item of itemsComputed) {
    const key = `${item.hsnCode || "N/A"}_${item.gstRate}`;
    const existing = hsnMap.get(key);
    if (existing) {
      existing.taxableValue += item.taxableValue;
      existing.cgstAmount += item.cgstAmount;
      existing.sgstAmount += item.sgstAmount;
      existing.igstAmount += item.igstAmount;
      existing.totalTax += item.cgstAmount + item.sgstAmount + item.igstAmount;
    } else {
      hsnMap.set(key, {
        hsnCode: item.hsnCode || "N/A",
        taxableValue: item.taxableValue,
        cgstRate: item.cgstRate,
        cgstAmount: item.cgstAmount,
        sgstRate: item.sgstRate,
        sgstAmount: item.sgstAmount,
        igstRate: item.igstRate,
        igstAmount: item.igstAmount,
        totalTax: item.cgstAmount + item.sgstAmount + item.igstAmount,
      });
    }
  }
  const hsnSummary = Array.from(hsnMap.values());

  // Totals
  const taxableTotal = itemsComputed.reduce(
    (sum, i) => sum + i.taxableValue,
    0
  );

  const customerLocation = [invoice.customer.city, invoice.customer.state]
    .filter(Boolean)
    .join(", ");

  const hasHeader = !!headerImageUrl;
  const hasFooter = !!footerImageUrl;
  const hasImages = hasHeader || hasFooter;

  // When images are present, page has no padding; content View gets its own padding
  const pageStyle = hasImages
    ? { ...styles.page, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }
    : styles.page;

  const contentStyle = hasImages
    ? { paddingHorizontal: "10mm" as const, flexGrow: 1 as const }
    : {};

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={pageStyle}>
        {/* Header Image — fixed, repeats on every page */}
        {hasHeader && (
          <View style={{ width: "100%" }} fixed>
            <Image src={headerImageUrl} style={{ width: "100%" }} />
          </View>
        )}

        {/* Content area */}
        <View style={contentStyle}>

          {/* A. Title */}
          {hasHeader && <View style={{ height: 10 }} />}
          <Text style={styles.title}>{title}</Text>

          {/* B. Info Boxes Row */}
          <View style={styles.infoRow}>
            {/* Bill To */}
            <View style={[styles.infoBox, { width: "36%" }]}>
              <View style={styles.infoBoxHeader}>
                <Text style={styles.infoBoxHeaderText}>Bill To</Text>
              </View>
              <View style={styles.infoBoxBody}>
                <Text style={[styles.infoBoxText, { fontWeight: "bold", fontSize: 8 }]}>
                  {invoice.customer.name}
                </Text>
                {invoice.customer.address && (
                  <Text style={styles.infoBoxText}>{invoice.customer.address}</Text>
                )}
                {customerLocation && (
                  <Text style={styles.infoBoxText}>{customerLocation}</Text>
                )}
                {invoice.customer.gstin && (
                  <Text style={styles.infoBoxText}>GSTIN: {invoice.customer.gstin}</Text>
                )}
              </View>
            </View>

            {/* Invoice No */}
            <View style={[styles.infoBox, { width: "16%", borderLeftWidth: 0 }]}>
              <View style={styles.infoBoxHeader}>
                <Text style={styles.infoBoxHeaderText}>Invoice No</Text>
              </View>
              <View style={styles.infoBoxBody}>
                <Text style={[styles.infoBoxText, { fontWeight: "bold" }]}>
                  {invoice.invoiceNumber}
                </Text>
              </View>
            </View>

            {/* Invoice Date */}
            <View style={[styles.infoBox, { width: "16%", borderLeftWidth: 0 }]}>
              <View style={styles.infoBoxHeader}>
                <Text style={styles.infoBoxHeaderText}>Invoice Date</Text>
              </View>
              <View style={styles.infoBoxBody}>
                <Text style={styles.infoBoxText}>
                  {format(new Date(invoice.issueDate), "dd-MM-yyyy")}
                </Text>
              </View>
            </View>

            {/* Salesperson */}
            <View style={[styles.infoBox, { width: "16%", borderLeftWidth: 0 }]}>
              <View style={styles.infoBoxHeader}>
                <Text style={styles.infoBoxHeaderText}>Salesperson</Text>
              </View>
              <View style={styles.infoBoxBody}>
                <Text style={styles.infoBoxText}>
                  {invoice.createdByName || "-"}
                </Text>
              </View>
            </View>

            {/* Payment Type */}
            <View style={[styles.infoBox, { width: "16%", borderLeftWidth: 0 }]}>
              <View style={styles.infoBoxHeader}>
                <Text style={styles.infoBoxHeaderText}>Payment</Text>
              </View>
              <View style={styles.infoBoxBody}>
                <Text style={styles.infoBoxText}>
                  {invoice.paymentType === "CREDIT" ? "Credit" : "Cash"}
                </Text>
              </View>
            </View>
          </View>

          {/* Place of Supply */}
          {invoice.isInterState && invoice.placeOfSupply && (
            <Text style={styles.placeOfSupply}>
              Place of Supply: {invoice.placeOfSupply}
            </Text>
          )}

          {/* C. Items Table */}
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { width: COL.sno, textAlign: "center" }]}>#</Text>
              <Text style={[styles.headerCell, { width: COL.desc }]}>Description</Text>
              <Text style={[styles.headerCell, { width: COL.hsn, textAlign: "center" }]}>HSN/SAC</Text>
              <Text style={[styles.headerCell, { width: COL.qty, textAlign: "right" }]}>Qty</Text>
              <Text style={[styles.headerCell, { width: COL.rate, textAlign: "right" }]}>Rate</Text>
              <Text style={[styles.headerCell, { width: COL.disc, textAlign: "right" }]}>Disc%</Text>
              <Text style={[styles.headerCell, { width: COL.taxable, textAlign: "right" }]}>Taxable</Text>
              <Text style={[styles.headerCell, { width: COL.gstPct, textAlign: "center" }]}>GST%</Text>
              <Text style={[styles.headerCell, { width: COL.cgst, textAlign: "right" }]}>CGST</Text>
              <Text style={[styles.headerCell, { width: COL.sgst, textAlign: "right" }]}>SGST</Text>
              <Text style={[styles.headerCell, { width: COL.igst, textAlign: "right" }]}>IGST</Text>
              <Text style={[styles.headerCellLast, { width: COL.total, textAlign: "right" }]}>Total</Text>
            </View>

            {/* Data Rows */}
            {itemsComputed.map((item, index) => {
              const unitCode = item.unit?.code || item.product?.unit?.code;
              const rowStyle = index % 2 === 1 ? styles.tableRowAlt : styles.tableRow;
              return (
                <View key={index} style={rowStyle}>
                  <Text style={[styles.cell, { width: COL.sno, textAlign: "center" }]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles.cell, { width: COL.desc }]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.cell, { width: COL.hsn, textAlign: "center" }]}>
                    {item.hsnCode || ""}
                  </Text>
                  <Text style={[styles.cell, { width: COL.qty, textAlign: "right" }]}>
                    {formatCurrency(item.quantity)}{unitCode ? ` ${unitCode.toUpperCase()}` : ""}
                  </Text>
                  <Text style={[styles.cell, { width: COL.rate, textAlign: "right" }]}>
                    {formatCurrency(item.unitPrice)}
                  </Text>
                  <Text style={[styles.cell, { width: COL.disc, textAlign: "right" }]}>
                    {item.discount > 0 ? formatCurrency(item.discount) : ""}
                  </Text>
                  <Text style={[styles.cell, { width: COL.taxable, textAlign: "right" }]}>
                    {formatCurrency(item.taxableValue)}
                  </Text>
                  <Text style={[styles.cell, { width: COL.gstPct, textAlign: "center" }]}>
                    {item.gstRate > 0 ? `${item.gstRate}%` : ""}
                  </Text>
                  <Text style={[styles.cell, { width: COL.cgst, textAlign: "right" }]}>
                    {item.cgstAmount > 0 ? formatCurrency(item.cgstAmount) : ""}
                  </Text>
                  <Text style={[styles.cell, { width: COL.sgst, textAlign: "right" }]}>
                    {item.sgstAmount > 0 ? formatCurrency(item.sgstAmount) : ""}
                  </Text>
                  <Text style={[styles.cell, { width: COL.igst, textAlign: "right" }]}>
                    {item.igstAmount > 0 ? formatCurrency(item.igstAmount) : ""}
                  </Text>
                  <Text style={[styles.cellLast, { width: COL.total, textAlign: "right" }]}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* D. HSN-Wise Tax Summary */}
          {hsnSummary.length > 0 && (
            <View style={styles.hsnTable}>
              <Text style={styles.hsnTitle}>HSN/SAC Summary</Text>
              {/* HSN Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: "14%" }]}>HSN/SAC</Text>
                <Text style={[styles.headerCell, { width: "14%", textAlign: "right" }]}>Taxable Value</Text>
                <Text style={[styles.headerCell, { width: "9%", textAlign: "center" }]}>CGST %</Text>
                <Text style={[styles.headerCell, { width: "13%", textAlign: "right" }]}>CGST Amt</Text>
                <Text style={[styles.headerCell, { width: "9%", textAlign: "center" }]}>SGST %</Text>
                <Text style={[styles.headerCell, { width: "13%", textAlign: "right" }]}>SGST Amt</Text>
                <Text style={[styles.headerCell, { width: "9%", textAlign: "center" }]}>IGST %</Text>
                <Text style={[styles.headerCell, { width: "13%", textAlign: "right" }]}>IGST Amt</Text>
                <Text style={[styles.headerCellLast, { width: "6%", textAlign: "right" }]}>Tax</Text>
              </View>
              {hsnSummary.map((row, i) => (
                <View key={i} style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
                  <Text style={[styles.cell, { width: "14%" }]}>{row.hsnCode}</Text>
                  <Text style={[styles.cell, { width: "14%", textAlign: "right" }]}>
                    {formatCurrency(row.taxableValue)}
                  </Text>
                  <Text style={[styles.cell, { width: "9%", textAlign: "center" }]}>
                    {row.cgstRate > 0 ? `${row.cgstRate}%` : ""}
                  </Text>
                  <Text style={[styles.cell, { width: "13%", textAlign: "right" }]}>
                    {row.cgstAmount > 0 ? formatCurrency(row.cgstAmount) : ""}
                  </Text>
                  <Text style={[styles.cell, { width: "9%", textAlign: "center" }]}>
                    {row.sgstRate > 0 ? `${row.sgstRate}%` : ""}
                  </Text>
                  <Text style={[styles.cell, { width: "13%", textAlign: "right" }]}>
                    {row.sgstAmount > 0 ? formatCurrency(row.sgstAmount) : ""}
                  </Text>
                  <Text style={[styles.cell, { width: "9%", textAlign: "center" }]}>
                    {row.igstRate > 0 ? `${row.igstRate}%` : ""}
                  </Text>
                  <Text style={[styles.cell, { width: "13%", textAlign: "right" }]}>
                    {row.igstAmount > 0 ? formatCurrency(row.igstAmount) : ""}
                  </Text>
                  <Text style={[styles.cellLast, { width: "6%", textAlign: "right" }]}>
                    {formatCurrency(row.totalTax)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* E. Totals Section */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal (Taxable)</Text>
                <Text style={styles.totalsValue}>{formatCurrency(taxableTotal)}</Text>
              </View>
              {invoice.totalCgst > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>CGST</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.totalCgst)}</Text>
                </View>
              )}
              {invoice.totalSgst > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>SGST</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.totalSgst)}</Text>
                </View>
              )}
              {invoice.totalIgst > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>IGST</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.totalIgst)}</Text>
                </View>
              )}
              {(invoice.roundOffAmount ?? 0) !== 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Round Off</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.roundOffAmount ?? 0)}</Text>
                </View>
              )}
              <View style={styles.grandTotalRow}>
                <Text style={[styles.totalsLabel, styles.totalsBold, { fontSize: 9 }]}>
                  Grand Total
                </Text>
                <Text style={[styles.totalsValue, styles.totalsBold, { fontSize: 9 }]}>
                  {formatCurrency(invoice.total)}
                </Text>
              </View>
              {invoice.amountPaid > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Amount Paid</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.amountPaid)}</Text>
                </View>
              )}
              {invoice.balanceDue > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={[styles.totalsLabel, styles.totalsBold]}>Balance Due</Text>
                  <Text style={[styles.totalsValue, styles.totalsBold]}>
                    {formatCurrency(invoice.balanceDue)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* F. Amount in Words */}
          <Text style={styles.amountInWords}>
            {numberToWordsLocalized(invoice.total, "en")}
          </Text>

          {/* G. Balance Info */}
          {balanceInfo && (
            <View style={styles.balanceSection}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Old Balance</Text>
                <Text style={styles.balanceValue}>: {formatCurrency(balanceInfo.oldBalance)}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>This Invoice</Text>
                <Text style={styles.balanceValue}>: {formatCurrency(balanceInfo.sales)}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceLabel, { fontWeight: "bold" }]}>Current Balance</Text>
                <Text style={[styles.balanceValue, { fontWeight: "bold" }]}>
                  : {formatCurrency(balanceInfo.balance)}
                </Text>
              </View>
            </View>
          )}

          {/* H. Notes / Terms */}
          {invoice.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          )}
          {invoice.terms && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Terms & Conditions</Text>
              <Text style={styles.notesText}>{invoice.terms}</Text>
            </View>
          )}

          {/* I. E&OE */}
          <Text style={styles.eoe}>E. & O.E.</Text>

        </View>
        {/* End content area */}

        {/* Footer Image — fixed, repeats on every page */}
        {hasFooter && (
          <View style={{ width: "100%", marginTop: "auto" }} fixed>
            <Image src={footerImageUrl} style={{ width: "100%" }} />
          </View>
        )}
      </Page>
    </Document>
  );
}
