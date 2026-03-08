import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { Font } from "@react-pdf/renderer";
import path from "path";

// Register the local Arial fonts.
const regularFontPath = path.join(process.cwd(), "public/fonts/Arial.ttf");
const boldFontPath = path.join(process.cwd(), "public/fonts/Arial Bold.ttf");

Font.register({
    family: "Arial",
    fonts: [
        { src: regularFontPath, fontWeight: 400 },
        { src: boldFontPath, fontWeight: 700 },
    ],
});

const ARIAL_FONT = "Arial";

const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const THEME = {
    primary: "#a10a11", // Exactly approx red matching the image's background
    primaryLight: "#bd161c", // Fallback light red
    gray: "#f7f7f7",
    border: "#000",
};

// Helper: renders standard Arial text
const Ar = ({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: React.ComponentProps<typeof Text>["style"];
}) => (
    <Text style={[{ fontFamily: ARIAL_FONT }, ...(style ? (Array.isArray(style) ? style : [style]) : [])] as any}>{children}</Text>
);

const styles = StyleSheet.create({
    page: {
        paddingTop: "20mm",
        paddingBottom: "15mm",
        paddingLeft: "8mm",
        paddingRight: "8mm",
        fontSize: 7,
        fontFamily: ARIAL_FONT,
    },
    // Invoice details top section
    topGrid: {
        flexDirection: "row",
        marginBottom: 8,
    },
    topGridTable: {
        borderWidth: 1,
        borderColor: THEME.border,
        flexDirection: "row",
        flex: 1,
    },
    topGridCell: {
        flex: 1,
        borderRightWidth: 1,
        borderRightColor: THEME.border,
    },
    topGridCellLast: {
        flex: 1,
    },
    topGridCellRow: {
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
        padding: 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#e8eff7", // light blue like in reference image
    },
    topGridCellRowLast: {
        padding: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    redTitleBox: {
        backgroundColor: THEME.primary,
        color: "#fff",
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        marginLeft: 10,
        width: "30%",
    },
    redTitleEn: {
        fontSize: 10,
        fontWeight: "bold",
        fontFamily: ARIAL_FONT,
        color: "#fff",
    },
    redTitleAr: {
        fontSize: 12,
        fontWeight: "bold",
        fontFamily: ARIAL_FONT,
        color: "#fff",
    },
    // Customer info section
    customerGrid: {
        borderWidth: 1,
        borderColor: THEME.border,
        marginBottom: 10,
    },
    customerRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
    },
    customerRowLast: {
        flexDirection: "row",
    },
    customerLabelCell: {
        width: "15%",
        backgroundColor: "#e8eff7",
        padding: 2,
        borderRightWidth: 1,
        borderRightColor: THEME.border,
        alignItems: "center",
        justifyContent: "center",
    },
    customerValueCell: {
        width: "35%",
        padding: 2,
        borderRightWidth: 1,
        borderRightColor: THEME.border,
        justifyContent: "center",
    },
    customerValueCellLast: {
        width: "35%",
        padding: 2,
        justifyContent: "center",
    },
    labelText: {
        fontSize: 6,
        fontWeight: "bold",
        fontFamily: ARIAL_FONT,
        textAlign: "center",
    },
    valueText: {
        fontSize: 7,
        fontFamily: ARIAL_FONT,
        paddingLeft: 4,
    },

    // Pagination
    paginationRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
        paddingHorizontal: 2,
    },
    paginationText: {
        fontSize: 7,
        fontFamily: ARIAL_FONT,
        color: THEME.primary, // Red pagination as seen in reference
    },

    // Items table
    table: {
        marginBottom: 10,
    },
    headerRow: {
        flexDirection: "row",
        borderWidth: 1,
        borderColor: THEME.border,
    },
    tableRow: {
        flexDirection: "row",
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: THEME.border,
        minHeight: 14,
    },
    headerCellWrap: {
        padding: 2,
        borderRightWidth: 1,
        borderRightColor: THEME.border,
        alignItems: "center",
        justifyContent: "center",
    },
    headerCellWrapLast: {
        padding: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTextEn: {
        fontSize: 6.5,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "center",
        fontFamily: ARIAL_FONT,
    },
    headerTextAr: {
        fontSize: 7,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "center",
        fontFamily: ARIAL_FONT,
    },
    cell: {
        padding: 2,
        fontSize: 6.5,
        borderRightWidth: 1,
        borderRightColor: THEME.border,
        fontFamily: ARIAL_FONT,
    },
    cellLast: {
        padding: 2,
        fontSize: 6.5,
        fontFamily: ARIAL_FONT,
    },

    // Totals Section
    totalsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 2,
    },
    totalsLabelBox: {
        backgroundColor: "#e8eff7",
        borderWidth: 1,
        borderColor: THEME.border,
        width: "15%",
        padding: 2,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    totalsValueBox: {
        borderWidth: 1,
        borderColor: THEME.border,
        borderLeftWidth: 0,
        width: "15%",
        padding: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    totalsLabelTextMain: {
        fontSize: 6.5,
        fontWeight: "bold",
        fontFamily: ARIAL_FONT,
    },

    // Note text at bottom
    bottomSection: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    qrCodeBox: {
        width: 60,
        height: 60,
    },
    signatureBox: {
        alignItems: "center",
        justifyContent: "flex-end",
    },
    signatureText: {
        fontSize: 8,
        fontFamily: ARIAL_FONT,
    },
});

const COL = {
    sl: "5%",
    item: "30%",
    unit: "8%",
    qty: "10%",
    price: "10%",
    net: "12%",
    vat: "10%",
    total: "15%",
};

export interface InvoiceBilingualItem {
    description: string;
    arabicName?: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    vatRate: number;
    vatAmount: number;
    unit?: { code: string; name?: string } | null;
    product?: { unit?: { code: string; name?: string } | null } | null;
}

export interface InvoiceBilingualProps {
    invoice: {
        invoiceNumber: string;
        issueDate: Date | string;
        customer: {
            name: string;
            arabicName?: string | null;
            address?: string | null;
            city?: string | null;
            state?: string | null;
            country?: string | null;
            zipCode?: string | null;
            vatNumber?: string | null;
            ccNo?: string | null;
            buildingNo?: string | null;
            addNo?: string | null;
            district?: string | null;
        };
        organization: {
            name: string;
            arabicName?: string | null;
            arabicAddress?: string | null;
            vatNumber?: string | null;
            commercialRegNumber?: string | null;
        };
        items: InvoiceBilingualItem[];
        subtotal: number;
        totalVat: number;
        total: number;
        amountPaid: number;
        balanceDue: number;
        qrCodeDataURL?: string;
        saudiInvoiceType?: string;
        paymentType?: string;
    };
    type: "SALES" | "PURCHASE";
    title?: string;
    headerImageUrl?: string;
    footerImageUrl?: string;
}

export function InvoiceBilingualPDF({
    invoice,
    title,
    headerImageUrl,
    footerImageUrl,
}: InvoiceBilingualProps) {
    const isSimplified = invoice.saudiInvoiceType === "SIMPLIFIED";
    const enTitle = title || (isSimplified ? "Simplified Tax Invoice" : "Tax Invoice");
    const arTitle = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";

    // Pre-compute lines
    const itemsComputed = invoice.items.map((item) => {
        const gross = item.quantity * item.unitPrice;
        const discountAmt = (gross * item.discount) / 100;
        const net = gross - discountAmt;
        return { ...item, gross, discountAmt, net };
    });

    const totalDiscount = itemsComputed.reduce((sum, i) => sum + i.discountAmt, 0);

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
                {hasHeader && (
                    <View style={{ width: "100%" }} fixed>
                        <Image src={headerImageUrl} style={{ width: "100%" }} />
                    </View>
                )}

                <View style={contentStyle}>
                    {hasHeader && <View style={{ height: 10 }} />}

                    {/* Top Grid: Invoice Details */}
                    <View style={styles.topGrid}>
                        <View style={styles.topGridTable}>
                            {/* Col 1: Invoice No */}
                            <View style={styles.topGridCell}>
                                <View style={styles.topGridCellRow}>
                                    <Text style={styles.labelText}>Invoice No | رقم الفاتورة</Text>
                                </View>
                                <View style={styles.topGridCellRowLast}>
                                    <Text style={styles.valueText}>{invoice.invoiceNumber}</Text>
                                </View>
                            </View>
                            {/* Col 2: Invoice Type */}
                            <View style={styles.topGridCell}>
                                <View style={styles.topGridCellRow}>
                                    <Text style={styles.labelText}>InvoiceType | نوع الفاتورة</Text>
                                </View>
                                <View style={styles.topGridCellRowLast}>
                                    <Ar style={styles.valueText}>{isSimplified ? "مبسطة / Simplified" : "ضريبية / Standard"}</Ar>
                                </View>
                            </View>
                            {/* Col 3: G.DATE */}
                            <View style={styles.topGridCell}>
                                <View style={styles.topGridCellRow}>
                                    <Text style={styles.labelText}>G.DATE | التاريخ</Text>
                                </View>
                                <View style={styles.topGridCellRowLast}>
                                    <Text style={styles.valueText}>{format(new Date(invoice.issueDate), "dd-MM-yyyy")}</Text>
                                </View>
                            </View>
                            {/* Col 4: Payment Type */}
                            <View style={styles.topGridCellLast}>
                                <View style={styles.topGridCellRow}>
                                    <Text style={styles.labelText}>Pay Type | طريقة الدفع</Text>
                                </View>
                                <View style={styles.topGridCellRowLast}>
                                    <Ar style={styles.valueText}>{invoice.paymentType === "CREDIT" ? "آجل / Credit" : "نقدي / Cash"}</Ar>
                                </View>
                            </View>
                        </View>

                        {/* Red Title Box */}
                        <View style={styles.redTitleBox}>
                            <Text style={styles.redTitleAr}>{arTitle}</Text>
                            <Text style={styles.redTitleEn}>{enTitle}</Text>
                        </View>
                    </View>

                    {/* Customer Grid */}
                    <View style={styles.customerGrid}>
                        {/* Row 1 */}
                        <View style={styles.customerRow}>
                            <View style={styles.customerLabelCell}>
                                <Text style={styles.labelText}>Cust Name | اسم العميل</Text>
                            </View>
                            <View style={styles.customerValueCell}>
                                <Text style={styles.valueText}>{invoice.customer.name} {invoice.customer.arabicName ? `(${invoice.customer.arabicName})` : ""}</Text>
                            </View>
                            <View style={[styles.customerLabelCell, { width: "20%" }]}>
                                <Text style={styles.labelText}>Cust.VAT No. | الرقم الضريبي</Text>
                            </View>
                            <View style={styles.customerValueCellLast}>
                                <Text style={styles.valueText}>{invoice.customer.vatNumber || ""}</Text>
                            </View>
                        </View>

                        {/* Row 2 */}
                        <View style={styles.customerRow}>
                            <View style={styles.customerLabelCell}>
                                <Text style={styles.labelText}>C.C No | معرف آخر</Text>
                            </View>
                            <View style={styles.customerValueCell}>
                                <Text style={styles.valueText}>{invoice.customer.ccNo || ""}</Text>
                            </View>
                            <View style={[styles.customerLabelCell, { width: "20%" }]}>
                                <Text style={styles.labelText}>Building No | رقم المبنى</Text>
                            </View>
                            <View style={styles.customerValueCellLast}>
                                <Text style={styles.valueText}>{invoice.customer.buildingNo || ""}</Text>
                            </View>
                        </View>

                        {/* Row 3 */}
                        <View style={styles.customerRow}>
                            <View style={styles.customerLabelCell}>
                                <Text style={styles.labelText}>Country | الدولة</Text>
                            </View>
                            <View style={styles.customerValueCell}>
                                <Text style={styles.valueText}>{invoice.customer.country || ""}</Text>
                            </View>
                            <View style={[styles.customerLabelCell, { width: "20%" }]}>
                                <Text style={styles.labelText}>Postal Code | الرمز البريدي</Text>
                            </View>
                            <View style={styles.customerValueCellLast}>
                                <Text style={styles.valueText}>{invoice.customer.zipCode || ""}</Text>
                            </View>
                        </View>

                        {/* Row 4 */}
                        <View style={styles.customerRow}>
                            <View style={styles.customerLabelCell}>
                                <Text style={styles.labelText}>District | الحي</Text>
                            </View>
                            <View style={styles.customerValueCell}>
                                <Text style={styles.valueText}>{invoice.customer.district || ""}</Text>
                            </View>
                            <View style={[styles.customerLabelCell, { width: "20%" }]}>
                                <Text style={styles.labelText}>Add. No | الرقم الفرعي</Text>
                            </View>
                            <View style={styles.customerValueCellLast}>
                                <Text style={styles.valueText}>{invoice.customer.addNo || ""}</Text>
                            </View>
                        </View>

                        {/* Row 5 */}
                        <View style={styles.customerRowLast}>
                            <View style={styles.customerLabelCell}>
                                <Text style={styles.labelText}>Address | العنوان</Text>
                            </View>
                            <View style={styles.customerValueCell}>
                                <Text style={styles.valueText}>{invoice.customer.address || ""}</Text>
                            </View>
                            <View style={[styles.customerLabelCell, { width: "20%" }]}>
                                <Text style={styles.labelText}>City, State | المدينة، المنطقة</Text>
                            </View>
                            <View style={styles.customerValueCellLast}>
                                <Text style={styles.valueText}>
                                    {[invoice.customer.city, invoice.customer.state].filter(Boolean).join(", ")}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Pagination Label */}
                    <View style={styles.paginationRow}>
                        <Text style={styles.paginationText} render={({ pageNumber, totalPages }) => (
                            `PAGE ${pageNumber} OF ${totalPages}`
                        )} fixed />
                        <Text style={styles.paginationText} render={({ pageNumber, totalPages }) => (
                            `الصفحة ${pageNumber} من ${totalPages}`
                        )} fixed />
                    </View>

                    {/* Items Table */}
                    <View style={styles.table}>
                        <View style={styles.headerRow} fixed>
                            <View style={[styles.headerCellWrap, { width: COL.sl, backgroundColor: THEME.primary }]}>
                                <Text style={styles.headerTextEn}>S.N</Text>
                                <Ar style={styles.headerTextAr}>م</Ar>
                            </View>
                            <View style={[styles.headerCellWrap, { width: COL.item, backgroundColor: THEME.primary }]}>
                                <Text style={styles.headerTextEn}>Item Description</Text>
                                <Ar style={styles.headerTextAr}>وصف الصنف</Ar>
                            </View>
                            <View style={[styles.headerCellWrap, { width: COL.unit, backgroundColor: "#000" }]}>
                                <Text style={styles.headerTextEn}>Unit</Text>
                                <Ar style={styles.headerTextAr}>الوحدة</Ar>
                            </View>
                            <View style={[styles.headerCellWrap, { width: COL.qty, backgroundColor: "#000" }]}>
                                <Text style={styles.headerTextEn}>Qty</Text>
                                <Ar style={styles.headerTextAr}>الكمية</Ar>
                            </View>
                            <View style={[styles.headerCellWrap, { width: COL.price, backgroundColor: "#000" }]}>
                                <Text style={styles.headerTextEn}>Price</Text>
                                <Ar style={styles.headerTextAr}>السعر</Ar>
                            </View>
                            <View style={[styles.headerCellWrap, { width: COL.net, backgroundColor: "#000" }]}>
                                <Text style={styles.headerTextEn}>Net</Text>
                                <Ar style={styles.headerTextAr}>الصافي</Ar>
                            </View>
                            <View style={[styles.headerCellWrap, { width: COL.vat, backgroundColor: "#000" }]}>
                                <Text style={styles.headerTextEn}>VAT</Text>
                                <Ar style={styles.headerTextAr}>الضريبة</Ar>
                            </View>
                            <View style={[styles.headerCellWrapLast, { width: COL.total, backgroundColor: "#000" }]}>
                                <Text style={styles.headerTextEn}>Net+VAT</Text>
                                <Ar style={styles.headerTextAr}>الصافي مع الضريبة</Ar>
                            </View>
                        </View>

                        {/* Data Rows */}
                        {itemsComputed.map((item, index) => {
                            const unitCode = item.unit?.code || item.product?.unit?.code || "";
                            return (
                                <View key={index} style={styles.tableRow}>
                                    <Text style={[styles.cell, { width: COL.sl, textAlign: "center" }]}>
                                        {index + 1}
                                    </Text>
                                    <View style={[styles.cell, { width: COL.item }]}>
                                        <Text style={{ fontSize: 6.5 }}>{item.description}</Text>
                                        {item.arabicName && (
                                            <Text style={{ fontSize: 7, fontFamily: ARIAL_FONT, textAlign: "right", marginTop: 1 }}>
                                                {item.arabicName}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={[styles.cell, { width: COL.unit, textAlign: "center" }]}>
                                        {unitCode}
                                    </Text>
                                    <Text style={[styles.cell, { width: COL.qty, textAlign: "right" }]}>
                                        {formatCurrency(item.quantity)}
                                    </Text>
                                    <Text style={[styles.cell, { width: COL.price, textAlign: "right" }]}>
                                        {formatCurrency(item.unitPrice)}
                                    </Text>
                                    <Text style={[styles.cell, { width: COL.net, textAlign: "right" }]}>
                                        {formatCurrency(item.net)}
                                    </Text>
                                    <Text style={[styles.cell, { width: COL.vat, textAlign: "right" }]}>
                                        {item.vatAmount > 0 ? formatCurrency(item.vatAmount) : "0.00"}
                                    </Text>
                                    <Text style={[styles.cellLast, { width: COL.total, textAlign: "right" }]}>
                                        {formatCurrency(item.total)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    {/* Summary / Totals block with QR Code on parallel left */}
                    <View style={{ position: "relative" }}>
                        {/* QR Code perfectly parallel to the totals block */}
                        {invoice.qrCodeDataURL && (
                            <View style={{ position: "absolute", left: 0, top: 0 }}>
                                <Image src={invoice.qrCodeDataURL} style={{ width: 75, height: 75 }} />
                            </View>
                        )}

                        <View style={styles.totalsRow}>
                            <View style={styles.totalsLabelBox}>
                                <Text style={styles.totalsLabelTextMain}>Amount</Text>
                                <Ar style={styles.totalsLabelTextMain}>الاجمالي</Ar>
                            </View>
                            <View style={styles.totalsValueBox}>
                                <Text style={styles.totalsLabelTextMain}>{formatCurrency(invoice.subtotal + totalDiscount)}</Text>
                            </View>
                        </View>
                        <View style={styles.totalsRow}>
                            <View style={styles.totalsLabelBox}>
                                <Text style={styles.totalsLabelTextMain}>Discount</Text>
                                <Ar style={styles.totalsLabelTextMain}>الخصم</Ar>
                            </View>
                            <View style={styles.totalsValueBox}>
                                <Text style={styles.totalsLabelTextMain}>{formatCurrency(totalDiscount)}</Text>
                            </View>
                        </View>
                        <View style={styles.totalsRow}>
                            <View style={styles.totalsLabelBox}>
                                <Text style={styles.totalsLabelTextMain}>Net</Text>
                                <Ar style={styles.totalsLabelTextMain}>الصافي</Ar>
                            </View>
                            <View style={styles.totalsValueBox}>
                                <Text style={styles.totalsLabelTextMain}>{formatCurrency(invoice.subtotal)}</Text>
                            </View>
                        </View>
                        <View style={styles.totalsRow}>
                            <View style={styles.totalsLabelBox}>
                                <Text style={styles.totalsLabelTextMain}>VAT 15%</Text>
                                <Ar style={styles.totalsLabelTextMain}>الضريبة 15%</Ar>
                            </View>
                            <View style={styles.totalsValueBox}>
                                <Text style={[styles.totalsLabelTextMain, { color: "#2d6b4a" }]}>{formatCurrency(invoice.totalVat)}</Text>
                            </View>
                        </View>
                        <View style={styles.totalsRow}>
                            <View style={styles.totalsLabelBox}>
                                <Text style={[styles.totalsLabelTextMain, { color: THEME.primary }]}>NET+VAT</Text>
                                <Ar style={[styles.totalsLabelTextMain, { color: THEME.primary }]}>الصافي مع الضريبة</Ar>
                            </View>
                            <View style={[styles.totalsValueBox, { backgroundColor: THEME.gray }]}>
                                <Text style={[styles.totalsLabelTextMain, { color: THEME.primary }]}>{formatCurrency(invoice.total)}</Text>
                            </View>
                        </View>
                        {/* Signatures & Terms Block pushed to bottom of content block */}
                        <View style={{ marginTop: "auto", paddingTop: 10 }}>
                            <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between", marginBottom: 5 }}>
                                <View style={styles.signatureBox}>
                                    <Ar style={styles.signatureText}>المستلم</Ar>
                                    <Text style={styles.signatureText}>Receiver</Text>
                                </View>
                                <View style={styles.signatureBox}>
                                    <Ar style={styles.signatureText}>البائع</Ar>
                                    <Text style={styles.signatureText}>Seller</Text>
                                </View>
                            </View>

                            <View style={{ borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 4, alignItems: "center", paddingBottom: 5 }}>
                                <Ar style={{ fontSize: 6 }}>البضاعة المباعة لا ترد ولا تستبدل والشركة غير مسؤولة عن سوء التخزين لدى العميل</Ar>
                            </View>
                        </View>

                    </View>
                    {/* End Content Region */}
                </View>

                {/* Global Footer (Edge to Edge, using marginTop "auto" for full flow matching GST2) */}
                {hasFooter && (
                    <View style={{ width: "100%", marginTop: "auto" }} fixed>
                        <Image src={footerImageUrl} style={{ width: "100%" }} />
                    </View>
                )}
            </Page>
        </Document>
    );
}
