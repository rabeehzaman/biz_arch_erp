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
  primary: "#1a4731",
  primaryLight: "#2d6b4a",
  gray: "#e8e8e8",
  border: "#333",
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
  // Bilingual title row
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleEn: {
    fontSize: 13,
    fontWeight: "bold",
  },
  titleAr: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
  },
  // Info boxes
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 10,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 6,
    padding: 6,
    minHeight: 50,
  },
  infoBoxText: {
    fontSize: 7,
    marginBottom: 1,
  },
  infoBoxTextAr: {
    fontSize: 8,
    marginBottom: 1,
    fontFamily: ARABIC_FONT_FAMILY,
    textAlign: "right",
  },
  // Table
  table: {
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.primary,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.border,
    minHeight: 14,
  },
  cell: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderRightColor: THEME.border,
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
    borderRightColor: THEME.border,
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
  taxableCell: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderRightColor: THEME.border,
    backgroundColor: THEME.gray,
  },
  taxableHeaderCell: {
    padding: 2,
    fontSize: 6.5,
    fontWeight: "bold",
    borderRightWidth: 1,
    borderRightColor: THEME.border,
    backgroundColor: THEME.primaryLight,
    textAlign: "center",
    color: "#fff",
  },
  totalRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.border,
    minHeight: 14,
  },
  // Bottom
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

// Column widths:
// Sl | Description | Qty | Unit Price | Discount | Taxable Value | VAT% | VAT Amt | Total
const COL = {
  sl: "4%",
  item: "28%",
  qty: "8%",
  rate: "10%",
  disc: "7%",
  taxable: "13%",
  vatPct: "7%",
  vatAmt: "11%",
  total: "12%",
};

interface InvoiceA4VATItem {
  description: string;
  arabicName?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
  vatAmount: number;
  unit?: { code: string } | null;
  product?: { unit?: { code: string } | null } | null;
}

export interface InvoiceA4VATProps {
  invoice: {
    invoiceNumber: string;
    issueDate: Date | string;
    customer: {
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
    items: InvoiceA4VATItem[];
    subtotal: number;
    totalVat: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    notes?: string | null;
    terms?: string | null;
    createdByName?: string | null;
    qrCodeDataURL?: string;
    saudiInvoiceType?: string;
  };
  type: "SALES" | "PURCHASE";
  title?: string;
  balanceInfo?: { oldBalance: number; sales: number; balance: number };
  headerImageUrl?: string;
  footerImageUrl?: string;
}

export function InvoiceA4VATPDF({
  invoice,
  title,
  balanceInfo,
  headerImageUrl,
  footerImageUrl,
}: InvoiceA4VATProps) {
  const isSimplified = invoice.saudiInvoiceType === "SIMPLIFIED";
  const enTitle = title || (isSimplified ? "Simplified Tax Invoice" : "Tax Invoice");
  const arTitle = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";

  // Compute taxable value per item
  const itemsComputed = invoice.items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const discountAmt = (gross * item.discount) / 100;
    const taxableValue = gross - discountAmt;
    return { ...item, gross, discountAmt, taxableValue };
  });

  const taxableTotal = itemsComputed.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalGross = itemsComputed.reduce((sum, i) => sum + i.gross, 0);
  const totalDiscount = itemsComputed.reduce((sum, i) => sum + i.discountAmt, 0);
  const totalVatComputed = itemsComputed.reduce((sum, i) => sum + i.vatAmount, 0);

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

        {/* Bilingual Title */}
        {hasHeader && <View style={{ height: 10 }} />}
        <View style={styles.titleRow}>
          <Text style={styles.titleEn}>{enTitle}</Text>
          <Text style={styles.titleAr}>{arTitle}</Text>
        </View>
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: THEME.primary, marginBottom: 6 }} />

        {/* Seller + Buyer Info */}
        <View style={styles.infoRow}>
          {/* Seller (left) */}
          <View style={[styles.infoBox, { width: "48%" }]}>
            <Text style={[styles.infoBoxText, { fontWeight: "bold", fontSize: 7, marginBottom: 2 }]}>
              Seller / البائع
            </Text>
            <Text style={[styles.infoBoxText, { fontWeight: "bold", fontSize: 8 }]}>
              {invoice.organization.name}
            </Text>
            {invoice.organization.arabicName && (
              <Text style={styles.infoBoxTextAr}>
                {invoice.organization.arabicName}
              </Text>
            )}
            {invoice.organization.arabicAddress && (
              <Text style={styles.infoBoxTextAr}>
                {invoice.organization.arabicAddress}
              </Text>
            )}
            {invoice.organization.vatNumber && (
              <Text style={[styles.infoBoxText, { marginTop: 2 }]}>
                TRN / الرقم الضريبي: {invoice.organization.vatNumber}
              </Text>
            )}
          </View>

          {/* Buyer (right) */}
          <View style={[styles.infoBox, { width: "48%" }]}>
            <Text style={[styles.infoBoxText, { fontWeight: "bold", fontSize: 7, marginBottom: 2 }]}>
              Buyer / المشتري
            </Text>
            <Text style={[styles.infoBoxText, { fontWeight: "bold", fontSize: 8 }]}>
              {invoice.customer.name}
            </Text>
            {invoice.customer.arabicName && (
              <Text style={styles.infoBoxTextAr}>
                {invoice.customer.arabicName}
              </Text>
            )}
            {invoice.customer.address && (
              <Text style={styles.infoBoxText}>{invoice.customer.address}</Text>
            )}
            {customerLocation && (
              <Text style={styles.infoBoxText}>{customerLocation}</Text>
            )}
            {invoice.customer.vatNumber && (
              <Text style={[styles.infoBoxText, { marginTop: 2 }]}>
                TRN / الرقم الضريبي: {invoice.customer.vatNumber}
              </Text>
            )}
          </View>
        </View>

        {/* Invoice details row */}
        <View style={{ flexDirection: "row", marginBottom: 8, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: "bold" }}>Invoice No / رقم الفاتورة: </Text>
              {invoice.invoiceNumber}
            </Text>
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: "bold" }}>Date / التاريخ: </Text>
              {format(new Date(invoice.issueDate), "dd-MM-yyyy")}
            </Text>
            {invoice.createdByName && (
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: "bold" }}>Salesperson: </Text>
                {invoice.createdByName}
              </Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { width: COL.sl }]}>Sl{"\n"}م</Text>
            <Text style={[styles.headerCell, { width: COL.item }]}>Description{"\n"}الوصف</Text>
            <Text style={[styles.headerCell, { width: COL.qty }]}>Qty{"\n"}الكمية</Text>
            <Text style={[styles.headerCell, { width: COL.rate }]}>Unit Price{"\n"}سعر الوحدة</Text>
            <Text style={[styles.headerCell, { width: COL.disc }]}>Discount{"\n"}خصم</Text>
            <Text style={[styles.taxableHeaderCell, { width: COL.taxable }]}>Taxable Value{"\n"}القيمة الخاضعة</Text>
            <Text style={[styles.headerCell, { width: COL.vatPct }]}>VAT %{"\n"}ض.ق.م %</Text>
            <Text style={[styles.headerCell, { width: COL.vatAmt }]}>VAT Amount{"\n"}مبلغ الضريبة</Text>
            <Text style={[styles.headerCellLast, { width: COL.total }]}>Total{"\n"}الإجمالي</Text>
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
                <View style={[styles.cell, { width: COL.item }]}>
                  <Text style={{ fontSize: 6.5 }}>{item.description}</Text>
                  {item.arabicName && (
                    <Text style={{ fontSize: 7, fontFamily: ARABIC_FONT_FAMILY, textAlign: "right" }}>
                      {item.arabicName}
                    </Text>
                  )}
                </View>
                <Text style={[styles.cell, { width: COL.qty, textAlign: "right" }]}>
                  {qtyStr}
                </Text>
                <Text style={[styles.cell, { width: COL.rate, textAlign: "right" }]}>
                  {formatCurrency(item.unitPrice)}
                </Text>
                <Text style={[styles.cell, { width: COL.disc, textAlign: "right" }]}>
                  {item.discountAmt > 0 ? formatCurrency(item.discountAmt) : ""}
                </Text>
                <Text style={[styles.taxableCell, { width: COL.taxable, textAlign: "right" }]}>
                  {formatCurrency(item.taxableValue)}
                </Text>
                <Text style={[styles.cell, { width: COL.vatPct, textAlign: "center" }]}>
                  {item.vatRate > 0 ? `${item.vatRate}%` : "0%"}
                </Text>
                <Text style={[styles.cell, { width: COL.vatAmt, textAlign: "right" }]}>
                  {item.vatAmount > 0 ? formatCurrency(item.vatAmount) : "0.00"}
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
            <Text style={[styles.cell, { width: COL.item, fontWeight: "bold" }]}>
              Total / الإجمالي
            </Text>
            <Text style={[styles.cell, { width: COL.qty }]} />
            <Text style={[styles.cell, { width: COL.rate }]} />
            <Text style={[styles.cell, { width: COL.disc, textAlign: "right", fontWeight: "bold" }]}>
              {totalDiscount > 0 ? formatCurrency(totalDiscount) : ""}
            </Text>
            <Text style={[styles.taxableCell, { width: COL.taxable, textAlign: "right", fontWeight: "bold" }]}>
              {formatCurrency(taxableTotal)}
            </Text>
            <Text style={[styles.cell, { width: COL.vatPct }]} />
            <Text style={[styles.cell, { width: COL.vatAmt, textAlign: "right", fontWeight: "bold" }]}>
              {formatCurrency(totalVatComputed)}
            </Text>
            <Text style={[styles.cellLast, { width: COL.total, textAlign: "right", fontWeight: "bold" }]}>
              {formatCurrency(invoice.total)}
            </Text>
          </View>
        </View>

        {/* Summary section below table */}
        <View style={{ borderWidth: 1, borderColor: THEME.border, borderTopWidth: 0, marginBottom: 2 }}>
          {/* Subtotal + VAT + Grand Total */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 3, gap: 20 }}>
            <View>
              <Text style={{ fontSize: 7 }}>Subtotal / المجموع الفرعي:</Text>
              <Text style={{ fontSize: 7 }}>VAT (15%) / ض.ق.م:</Text>
              <Text style={{ fontSize: 8, fontWeight: "bold" }}>Grand Total / الإجمالي الكلي:</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 7 }}>{formatCurrency(invoice.subtotal)}</Text>
              <Text style={{ fontSize: 7 }}>{formatCurrency(invoice.totalVat)}</Text>
              <Text style={{ fontSize: 8, fontWeight: "bold" }}>{formatCurrency(invoice.total)}</Text>
            </View>
          </View>

          {/* Amount in words (EN + AR) */}
          <View style={{ paddingHorizontal: 3, paddingBottom: 3 }}>
            <Text style={{ fontSize: 6.5 }}>
              {numberToWordsLocalized(invoice.total, "en")}
            </Text>
            <Text style={{ fontSize: 7.5, fontFamily: ARABIC_FONT_FAMILY, textAlign: "right" }}>
              {numberToWordsLocalized(invoice.total, "ar")}
            </Text>
          </View>

          {/* Amount Paid / Balance Due */}
          {invoice.amountPaid > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 3, paddingBottom: 2 }}>
              <Text style={{ fontSize: 7 }}>Amount Paid / المبلغ المدفوع: {formatCurrency(invoice.amountPaid)}</Text>
            </View>
          )}
          {invoice.balanceDue > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 3, paddingBottom: 2 }}>
              <Text style={{ fontSize: 7, fontWeight: "bold" }}>Balance Due / المبلغ المتبقي: {formatCurrency(invoice.balanceDue)}</Text>
            </View>
          )}
        </View>

        {/* Balance Info */}
        {balanceInfo && (
          <View style={{ marginBottom: 4, borderWidth: 1, borderColor: THEME.border, padding: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 7 }}>Old Balance: {formatCurrency(balanceInfo.oldBalance)}</Text>
              <Text style={{ fontSize: 7 }}>This Invoice: {formatCurrency(balanceInfo.sales)}</Text>
              <Text style={{ fontSize: 7, fontWeight: "bold" }}>Current Balance: {formatCurrency(balanceInfo.balance)}</Text>
            </View>
          </View>
        )}

        {/* QR Code + E&OE */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 2 }}>
          {invoice.qrCodeDataURL ? (
            <View>
              <Image src={invoice.qrCodeDataURL} style={{ width: 70, height: 70 }} />
              <Text style={{ fontSize: 5, color: "#666", marginTop: 1 }}>ZATCA QR Code</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.eoe}>E. & O.E</Text>
        </View>

        {/* Declaration + Signatory */}
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: THEME.primary, marginBottom: 4, marginTop: 4 }} />
        <View style={styles.bottomRow}>
          {/* Left — Declaration */}
          <View style={{ width: "55%" }}>
            <Text style={styles.declarationBold}>Declaration / إقرار:</Text>
            <Text style={styles.declaration}>
              Certified that all the particulars shown in the above tax invoice are true and correct.
            </Text>
            <Text style={[styles.declaration, { fontFamily: ARABIC_FONT_FAMILY, textAlign: "right", fontSize: 7 }]}>
              نقر بأن جميع البيانات الواردة في هذه الفاتورة الضريبية صحيحة ودقيقة
            </Text>
          </View>

          {/* Right — Signatory */}
          <View style={{ width: "45%", alignItems: "center" }}>
            <Text style={{ fontSize: 8, marginBottom: 30 }}>
              For {invoice.organization.name}
            </Text>
            <Text style={styles.signatory}>Authorised Signatory</Text>
            <Text style={{ fontSize: 6 }}>( With Status & Seal )</Text>
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
