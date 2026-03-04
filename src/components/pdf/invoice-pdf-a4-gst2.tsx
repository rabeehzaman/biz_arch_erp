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
    paddingTop: "20mm",
    paddingBottom: "15mm",
    paddingLeft: "8mm",
    paddingRight: "8mm",
    fontSize: 7,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  // Info boxes row — two rounded boxes
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 10,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 6,
    padding: 6,
    minHeight: 45,
  },
  infoBoxText: {
    fontSize: 7,
    marginBottom: 1,
  },
  // Items table
  table: {
    marginBottom: 0,
  },
  // Two-row header
  headerRow1: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1a4731",
  },
  headerRow2: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1a4731",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    minHeight: 12,
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
    textAlign: "center",
    color: "#fff",
  },
  headerCellLast: {
    padding: 2,
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "center",
    color: "#fff",
  },
  // Taxable value column — gray background
  taxableCell: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderRightColor: "#333",
    backgroundColor: "#e8e8e8",
  },
  taxableHeaderCell: {
    padding: 2,
    fontSize: 6.5,
    fontWeight: "bold",
    borderRightWidth: 1,
    borderRightColor: "#333",
    backgroundColor: "#2d6b4a",
    textAlign: "center",
    color: "#fff",
  },
  // Totals rows inside table
  totalRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    minHeight: 14,
  },
  // Bottom section
  bottomRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  declaration: {
    fontSize: 6.5,
    marginTop: 2,
  },
  declarationBold: {
    fontSize: 7,
    fontWeight: "bold",
  },
  signatory: {
    fontSize: 7,
    textAlign: "center",
  },
  eoe: {
    fontSize: 6,
    marginTop: 4,
  },
});

// Column widths matching the image layout:
// SI | HSN | Commodity/Item | Qty.Unit | Rate | Amount | Less:Disc | Taxable Value | CGST% | CGST Amt | SGST% | SGST Amt | Total
const COL = {
  sl: "3.5%",
  hsn: "6.5%",
  item: "20%",
  qty: "7%",
  rate: "7.5%",
  amount: "8%",
  disc: "5%",
  taxable: "9.5%",
  cgstPct: "4.5%",
  cgstAmt: "7%",
  sgstPct: "4.5%",
  sgstAmt: "7%",
  total: "10%",
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

interface InvoiceA4GST2Props {
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
    total: number;
    amountPaid: number;
    balanceDue: number;
    isInterState: boolean;
    placeOfSupply?: string | null;
    notes?: string | null;
    terms?: string | null;
    createdByName?: string | null;
  };
  type: "SALES" | "PURCHASE";
  title?: string;
  balanceInfo?: { oldBalance: number; sales: number; balance: number };
  headerImageUrl?: string;
  footerImageUrl?: string;
}

export function InvoiceA4GST2PDF({
  invoice,
  title = "Tax Invoice",
  balanceInfo,
  headerImageUrl,
  footerImageUrl,
}: InvoiceA4GST2Props) {
  // Compute taxable value and amount per item
  const itemsComputed = invoice.items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const discountAmt = (gross * item.discount) / 100;
    const taxableValue = gross - discountAmt;
    return { ...item, gross, discountAmt, taxableValue };
  });

  // Totals
  const taxableTotal = itemsComputed.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalGross = itemsComputed.reduce((sum, i) => sum + i.gross, 0);
  const totalDiscount = itemsComputed.reduce((sum, i) => sum + i.discountAmt, 0);

  const customerLocation = [invoice.customer.city, invoice.customer.state]
    .filter(Boolean)
    .join(", ");

  const hasHeader = !!headerImageUrl;
  const hasFooter = !!footerImageUrl;
  const hasImages = hasHeader || hasFooter;

  const pageStyle = hasImages
    ? { ...styles.page, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }
    : styles.page;

  const contentStyle = hasImages
    ? { paddingHorizontal: "8mm" as const, flexGrow: 1 as const }
    : {};

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={pageStyle}>
        {/* Header Image */}
        {hasHeader && (
          <View style={{ width: "100%" }} fixed>
            <Image src={headerImageUrl} style={{ width: "100%" }} />
          </View>
        )}

        <View style={contentStyle}>

        {/* Title */}
        {hasHeader && <View style={{ height: 10 }} />}
        <Text style={styles.title}>{title}</Text>
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: "#1a4731", marginBottom: 6 }} />

        {/* Info boxes — two rounded boxes side by side */}
        <View style={styles.infoRow}>
          {/* Bill To (left) */}
          <View style={[styles.infoBox, { width: "55%" }]}>
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

          {/* Invoice details (right) */}
          <View style={[styles.infoBox, { width: "43%" }]}>
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: "bold" }}>Invoice No: </Text>
              {invoice.invoiceNumber}
            </Text>
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: "bold" }}>Date: </Text>
              {format(new Date(invoice.issueDate), "dd-MM-yyyy")}
            </Text>
            {invoice.createdByName && (
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: "bold" }}>Salesperson: </Text>
                {invoice.createdByName}
              </Text>
            )}
            {invoice.isInterState && invoice.placeOfSupply && (
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: "bold" }}>Place of Supply: </Text>
                {invoice.placeOfSupply}
              </Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Header Row 1 — merged CGST / SGST headers */}
          <View style={styles.headerRow1}>
            <Text style={[styles.headerCell, { width: COL.sl }]}>Sl</Text>
            <Text style={[styles.headerCell, { width: COL.hsn }]}>HSN</Text>
            <Text style={[styles.headerCell, { width: COL.item }]}>Commodity / Item</Text>
            <Text style={[styles.headerCell, { width: COL.qty }]}>Qty.Unit</Text>
            <Text style={[styles.headerCell, { width: COL.rate }]}>Rate</Text>
            <Text style={[styles.headerCell, { width: COL.amount }]}>Amount</Text>
            <Text style={[styles.headerCell, { width: COL.disc }]}>Less:{"\n"}Disc</Text>
            <Text style={[styles.taxableHeaderCell, { width: COL.taxable }]}>Taxable{"\n"}Value</Text>
            {/* CGST group header */}
            <View style={{ width: "11.5%", borderRightWidth: 1, borderRightColor: "#333" }}>
              <Text style={[styles.headerCell, { borderRightWidth: 0 }]}>CGST</Text>
            </View>
            {/* SGST group header */}
            <View style={{ width: "11.5%", borderRightWidth: 1, borderRightColor: "#333" }}>
              <Text style={[styles.headerCell, { borderRightWidth: 0 }]}>SGST</Text>
            </View>
            <Text style={[styles.headerCellLast, { width: COL.total }]}>Total</Text>
          </View>

          {/* Header Row 2 — sub-headers for CGST/SGST */}
          <View style={styles.headerRow2}>
            <Text style={[styles.headerCell, { width: COL.sl }]} />
            <Text style={[styles.headerCell, { width: COL.hsn }]} />
            <Text style={[styles.headerCell, { width: COL.item }]} />
            <Text style={[styles.headerCell, { width: COL.qty }]} />
            <Text style={[styles.headerCell, { width: COL.rate }]} />
            <Text style={[styles.headerCell, { width: COL.amount }]} />
            <Text style={[styles.headerCell, { width: COL.disc }]} />
            <Text style={[styles.taxableHeaderCell, { width: COL.taxable }]} />
            <Text style={[styles.headerCell, { width: COL.cgstPct }]}>%</Text>
            <Text style={[styles.headerCell, { width: COL.cgstAmt }]}>Amount</Text>
            <Text style={[styles.headerCell, { width: COL.sgstPct }]}>%</Text>
            <Text style={[styles.headerCell, { width: COL.sgstAmt }]}>Amount</Text>
            <Text style={[styles.headerCellLast, { width: COL.total }]} />
          </View>

          {/* Data Rows */}
          {itemsComputed.map((item, index) => {
            const unitCode = item.unit?.code || item.product?.unit?.code;
            const qtyStr = `${formatCurrency(item.quantity)}${unitCode ? ` ${unitCode.toUpperCase()}` : ""}`;
            return (
              <View key={index} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#f5f8f5" } : {}]}>
                <Text style={[styles.cell, { width: COL.sl, textAlign: "center" }]}>
                  {index + 1}
                </Text>
                <Text style={[styles.cell, { width: COL.hsn, textAlign: "center" }]}>
                  {item.hsnCode || ""}
                </Text>
                <Text style={[styles.cell, { width: COL.item }]}>
                  {item.description}
                </Text>
                <Text style={[styles.cell, { width: COL.qty, textAlign: "right" }]}>
                  {qtyStr}
                </Text>
                <Text style={[styles.cell, { width: COL.rate, textAlign: "right" }]}>
                  {formatCurrency(item.unitPrice)}
                </Text>
                <Text style={[styles.cell, { width: COL.amount, textAlign: "right" }]}>
                  {formatCurrency(item.gross)}
                </Text>
                <Text style={[styles.cell, { width: COL.disc, textAlign: "right" }]}>
                  {item.discountAmt > 0 ? formatCurrency(item.discountAmt) : ""}
                </Text>
                <Text style={[styles.taxableCell, { width: COL.taxable, textAlign: "right" }]}>
                  {formatCurrency(item.taxableValue)}
                </Text>
                <Text style={[styles.cell, { width: COL.cgstPct, textAlign: "center" }]}>
                  {item.cgstRate > 0 ? `${item.cgstRate}` : ""}
                </Text>
                <Text style={[styles.cell, { width: COL.cgstAmt, textAlign: "right" }]}>
                  {item.cgstAmount > 0 ? formatCurrency(item.cgstAmount) : ""}
                </Text>
                <Text style={[styles.cell, { width: COL.sgstPct, textAlign: "center" }]}>
                  {item.sgstRate > 0 ? `${item.sgstRate}` : ""}
                </Text>
                <Text style={[styles.cell, { width: COL.sgstAmt, textAlign: "right" }]}>
                  {item.sgstAmount > 0 ? formatCurrency(item.sgstAmount) : ""}
                </Text>
                <Text style={[styles.cellLast, { width: COL.total, textAlign: "right" }]}>
                  {formatCurrency(item.total)}
                </Text>
              </View>
            );
          })}

          {/* Totals row inside table */}
          <View style={styles.totalRow}>
            <Text style={[styles.cell, { width: COL.sl }]} />
            <Text style={[styles.cell, { width: COL.hsn }]} />
            <Text style={[styles.cell, { width: COL.item, fontWeight: "bold" }]}>Total</Text>
            <Text style={[styles.cell, { width: COL.qty }]} />
            <Text style={[styles.cell, { width: COL.rate }]} />
            <Text style={[styles.cell, { width: COL.amount, textAlign: "right", fontWeight: "bold" }]}>
              {formatCurrency(totalGross)}
            </Text>
            <Text style={[styles.cell, { width: COL.disc, textAlign: "right", fontWeight: "bold" }]}>
              {totalDiscount > 0 ? formatCurrency(totalDiscount) : ""}
            </Text>
            <Text style={[styles.taxableCell, { width: COL.taxable, textAlign: "right", fontWeight: "bold" }]}>
              {formatCurrency(taxableTotal)}
            </Text>
            <Text style={[styles.cell, { width: COL.cgstPct }]} />
            <Text style={[styles.cell, { width: COL.cgstAmt, textAlign: "right", fontWeight: "bold" }]}>
              {invoice.totalCgst > 0 ? formatCurrency(invoice.totalCgst) : ""}
            </Text>
            <Text style={[styles.cell, { width: COL.sgstPct }]} />
            <Text style={[styles.cell, { width: COL.sgstAmt, textAlign: "right", fontWeight: "bold" }]}>
              {invoice.totalSgst > 0 ? formatCurrency(invoice.totalSgst) : ""}
            </Text>
            <Text style={[styles.cellLast, { width: COL.total, textAlign: "right", fontWeight: "bold" }]}>
              {formatCurrency(invoice.total)}
            </Text>
          </View>
        </View>

        {/* Grand Total / Balance rows below table */}
        <View style={{ borderWidth: 1, borderColor: "#333", borderTopWidth: 0, marginBottom: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 3 }}>
            <Text style={{ fontSize: 7 }}>
              {numberToWordsLocalized(invoice.total, "en")}
            </Text>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>
              Grand Total: {formatCurrency(invoice.total)}
            </Text>
          </View>
          {invoice.amountPaid > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 3, paddingBottom: 2 }}>
              <Text style={{ fontSize: 7 }}>Amount Paid: {formatCurrency(invoice.amountPaid)}</Text>
            </View>
          )}
          {invoice.balanceDue > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 3, paddingBottom: 2 }}>
              <Text style={{ fontSize: 7, fontWeight: "bold" }}>Balance Due: {formatCurrency(invoice.balanceDue)}</Text>
            </View>
          )}
        </View>

        {/* Balance Info */}
        {balanceInfo && (
          <View style={{ marginBottom: 4, borderWidth: 1, borderColor: "#333", padding: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 7 }}>Old Balance: {formatCurrency(balanceInfo.oldBalance)}</Text>
              <Text style={{ fontSize: 7 }}>This Invoice: {formatCurrency(balanceInfo.sales)}</Text>
              <Text style={{ fontSize: 7, fontWeight: "bold" }}>Current Balance: {formatCurrency(balanceInfo.balance)}</Text>
            </View>
          </View>
        )}

        {/* E&OE */}
        <Text style={styles.eoe}>E. & O.E</Text>

        {/* Declaration + Signatory */}
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: "#1a4731", marginBottom: 4 }} />
        <View style={styles.bottomRow}>
          {/* Left — Declaration */}
          <View style={{ width: "55%" }}>
            <Text style={styles.declarationBold}>Declaration:</Text>
            <Text style={styles.declaration}>
              Certified that all the particulars shown to the above tax Invoice are true and correct
            </Text>
          </View>

          {/* Right — Signatory */}
          <View style={{ width: "45%", alignItems: "center" }}>
            <Text style={{ fontSize: 8, marginBottom: 30 }}>
              For {invoice.organization.name}
            </Text>
            <Text style={styles.signatory}>Authorised Signatory</Text>
            <Text style={{ fontSize: 6 }}>( With Status & seal)</Text>
          </View>
        </View>

        </View>
        {/* End content area */}

        {/* Footer Image */}
        {hasFooter && (
          <View style={{ width: "100%", marginTop: "auto" }} fixed>
            <Image src={footerImageUrl} style={{ width: "100%" }} />
          </View>
        )}
      </Page>
    </Document>
  );
}
