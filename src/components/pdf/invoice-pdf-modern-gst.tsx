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

type TaxMode = "GST" | "VAT" | "NONE";

const DEFAULT_BRAND_COLOR = "#2a3b38";

const formatCurrencyValue = (amount: number, locale: string): string => {
    return amount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const styles = StyleSheet.create({
    page: {
        paddingTop: "25mm",
        paddingBottom: "20mm",
        paddingLeft: "15mm",
        paddingRight: "15mm",
        fontSize: 9,
        fontFamily: "Helvetica",
        color: "#4a4a4a",
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 10,
        objectFit: "contain",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 25,
    },
    headerLeft: {
        width: "50%",
    },
    orgName: {
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 4,
    },
    orgText: {
        fontSize: 9,
        color: "#6b7280",
        lineHeight: 1.4,
    },
    headerRight: {
        width: "40%",
        alignItems: "flex-end",
    },
    invoiceTitle: {
        fontSize: 26,
        fontWeight: "bold",
        letterSpacing: 0.5,
    },
    invoiceNumberBox: {
        flexDirection: "row",
        marginTop: 4,
        marginBottom: 15,
    },
    invoiceNumber: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#111",
    },
    balanceDueLabelRight: {
        fontSize: 9,
        color: "#111",
        marginBottom: 4,
    },
    balanceDueAmountRight: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#111",
    },
    entitiesRow: {
        flexDirection: "row",
        marginBottom: 30,
        justifyContent: "space-between",
    },
    billToLabel: {
        fontSize: 10,
        color: "#111",
        marginBottom: 5,
    },
    billToName: {
        fontSize: 12,
        fontWeight: "bold",
        marginBottom: 5,
    },
    billToText: {
        fontSize: 9,
        color: "#6b7280",
        lineHeight: 1.4,
    },
    metaTable: {
        width: 200,
    },
    metaRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 6,
    },
    metaLabel: {
        width: 80,
        textAlign: "right",
        fontSize: 10,
        color: "#111",
        paddingRight: 10,
    },
    metaValue: {
        width: 100,
        textAlign: "right",
        fontSize: 10,
        color: "#111",
    },
    table: {
        width: "100%",
        marginBottom: 20,
    },
    tableHeaderRow: {
        flexDirection: "row",
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    tableHeaderCell: {
        color: "#fff",
        fontSize: 9,
        fontWeight: "bold",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    tableCell: {
        fontSize: 9,
        color: "#4a4a4a",
    },
    tableCellItem: {
        fontSize: 9,
        color: "#111",
    },
    tableCellDesc: {
        fontSize: 8,
        color: "#6b7280",
        marginTop: 3,
    },
    // GST column widths
    colNoGst: { width: "5%" },
    colItemGst: { width: "35%" },
    colHsn: { width: "10%", textAlign: "center" as const },
    colQtyGst: { width: "8%", textAlign: "center" as const },
    colRateGst: { width: "12%", textAlign: "right" as const },
    colTaxGst: { width: "15%", textAlign: "right" as const },
    colAmountGst: { width: "15%", textAlign: "right" as const },
    // VAT column widths
    colNoVat: { width: "5%" },
    colItemVat: { width: "35%" },
    colQtyVat: { width: "10%", textAlign: "center" as const },
    colRateVat: { width: "15%", textAlign: "right" as const },
    colVatPct: { width: "10%", textAlign: "right" as const },
    colVatAmt: { width: "10%", textAlign: "right" as const },
    colAmountVat: { width: "15%", textAlign: "right" as const },
    // NONE column widths
    colNoNone: { width: "5%" },
    colItemNone: { width: "45%" },
    colQtyNone: { width: "12%", textAlign: "center" as const },
    colRateNone: { width: "18%", textAlign: "right" as const },
    colAmountNone: { width: "20%", textAlign: "right" as const },
    // Summary
    summarySection: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 10,
    },
    summaryBlock: {
        width: 200,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    summaryLabel: {
        fontSize: 9,
        color: "#111",
    },
    summaryValue: {
        fontSize: 9,
        color: "#111",
        fontWeight: "bold",
        textAlign: "right",
    },
    summaryRowTotal: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginTop: 4,
    },
    summaryLabelTotal: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#111",
    },
    summaryValueTotal: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#111",
        textAlign: "right",
    },
    balanceDueBanner: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginTop: 8,
    },
    balanceDueBannerLabel: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#fff",
    },
    balanceDueBannerValue: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "right",
    },
    notesSection: {
        marginTop: 40,
    },
    notesTitle: {
        fontSize: 10,
        color: "#111",
        marginBottom: 4,
    },
    notesText: {
        fontSize: 9,
        color: "#6b7280",
        marginBottom: 20,
    },
});

interface InvoiceModernItem {
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    unit?: { code: string } | null;
    product?: { unit?: { code: string } | null; name: string } | null;
    // GST fields (optional)
    hsnCode?: string | null;
    gstRate?: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    // VAT fields (optional)
    vatRate?: number;
    vatAmount?: number;
}

interface InvoiceModernGSTProps {
    invoice: {
        invoiceNumber: string;
        issueDate: Date | string;
        customer: {
            name: string;
            address?: string | null;
            city?: string | null;
            state?: string | null;
            gstin?: string | null;
            vatNumber?: string | null;
        };
        organization: {
            name: string;
            gstin?: string | null;
            vatNumber?: string | null;
        };
        items: InvoiceModernItem[];
        subtotal: number;
        totalCgst?: number;
        totalSgst?: number;
        totalIgst?: number;
        totalVat?: number;
        total: number;
        amountPaid: number;
        balanceDue: number;
        isInterState?: boolean;
        placeOfSupply?: string | null;
        notes?: string | null;
        terms?: string | null;
        paymentType?: string;
    };
    taxMode: TaxMode;
    currencySymbol: string;
    brandColor?: string;
    type: "SALES" | "PURCHASE";
    headerImageUrl?: string;
}

export function InvoiceModernGSTPDF({
    invoice,
    taxMode,
    currencySymbol,
    brandColor: brandColorProp,
    headerImageUrl,
}: InvoiceModernGSTProps) {
    const color = brandColorProp || DEFAULT_BRAND_COLOR;
    const locale = taxMode === "VAT" ? "en-US" : "en-IN";
    const fmt = (amount: number) => formatCurrencyValue(amount, locale);

    const getAddressLines = (addressStr?: string | null) => {
        if (!addressStr) return [];
        return addressStr.split("\n").filter(Boolean);
    };

    const hasNotes = invoice.notes && invoice.notes.trim().length > 0;
    const hasTerms = invoice.terms && invoice.terms.trim().length > 0;

    // Tax ID label / value
    const taxIdLabel = taxMode === "GST" ? "GSTIN" : taxMode === "VAT" ? "TRN" : null;
    const orgTaxId = taxMode === "GST" ? invoice.organization.gstin : taxMode === "VAT" ? invoice.organization.vatNumber : null;
    const custTaxId = taxMode === "GST" ? invoice.customer.gstin : taxMode === "VAT" ? invoice.customer.vatNumber : null;

    // Pre-calculate items for GST mode
    const itemsComputed = invoice.items.map((item) => {
        const gross = item.quantity * item.unitPrice;
        const discountAmt = (gross * item.discount) / 100;
        const taxableValue = gross - discountAmt;

        let taxLabel = "";
        let taxAmount = 0;
        if (taxMode === "GST") {
            const isIgst = invoice.isInterState;
            const totalTaxRate = isIgst ? (item.igstRate ?? 0) : (item.cgstRate ?? 0) + (item.sgstRate ?? 0);
            taxLabel = `${totalTaxRate}%`;
            taxAmount = isIgst
                ? (item.igstAmount ?? 0)
                : (item.cgstAmount ?? 0) + (item.sgstAmount ?? 0);
        } else if (taxMode === "VAT") {
            taxLabel = `${item.vatRate ?? 0}%`;
            taxAmount = item.vatAmount ?? 0;
        }

        return { ...item, gross, discountAmt, taxableValue, taxLabel, taxAmount };
    });

    return (
        <Document>
            <Page size="A4" orientation="portrait" style={styles.page}>

                {/* Header Section */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        {headerImageUrl ? (
                            <Image src={headerImageUrl} style={styles.logo} />
                        ) : (
                            <View style={{ height: 65, width: 65, borderRadius: 32.5, backgroundColor: color, marginBottom: 10, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontSize: 30, fontWeight: 'bold' }}>
                                    {invoice.organization.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <Text style={[styles.orgName, { color }]}>{invoice.organization.name}</Text>
                        {taxIdLabel && orgTaxId && (
                            <Text style={styles.orgText}>{taxIdLabel}: {orgTaxId}</Text>
                        )}
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={[styles.invoiceTitle, { color }]}>INVOICE</Text>
                        <View style={styles.invoiceNumberBox}>
                            <Text style={styles.invoiceNumber}># {invoice.invoiceNumber}</Text>
                        </View>
                        <Text style={styles.balanceDueLabelRight}>Balance Due</Text>
                        <Text style={styles.balanceDueAmountRight}>{currencySymbol}{fmt(invoice.balanceDue)}</Text>
                    </View>
                </View>

                {/* Entities Section */}
                <View style={styles.entitiesRow}>
                    <View style={{ width: "50%" }}>
                        <Text style={styles.billToLabel}>Bill To</Text>
                        <Text style={[styles.billToName, { color }]}>{invoice.customer.name}</Text>
                        {getAddressLines(invoice.customer.address).map((line, i) => (
                            <Text key={i} style={styles.billToText}>{line}</Text>
                        ))}
                        {invoice.customer.city && invoice.customer.state && (
                            <Text style={styles.billToText}>
                                {invoice.customer.city}, {invoice.customer.state}
                            </Text>
                        )}
                        {taxIdLabel && custTaxId && (
                            <Text style={styles.billToText}>{taxIdLabel}: {custTaxId}</Text>
                        )}
                        {taxMode === "GST" && invoice.placeOfSupply && invoice.isInterState && (
                            <Text style={styles.billToText}>Place of Supply: {invoice.placeOfSupply}</Text>
                        )}
                    </View>

                    <View style={{ width: "50%", alignItems: "flex-end", justifyContent: "flex-end", paddingBottom: 10 }}>
                        <View style={styles.metaTable}>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Invoice Date:</Text>
                                <Text style={styles.metaValue}>{format(new Date(invoice.issueDate), "dd MMM yyyy")}</Text>
                            </View>
                            {invoice.paymentType && (
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Payment Type:</Text>
                                    <Text style={styles.metaValue}>{invoice.paymentType === "CREDIT" ? "Credit" : "Cash"}</Text>
                                </View>
                            )}
                            {invoice.terms && (
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Terms:</Text>
                                    <Text style={styles.metaValue}>{invoice.terms.split('\n')[0].substring(0, 20)}...</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={[styles.tableHeaderRow, { backgroundColor: color }]}>
                        {taxMode === "GST" && (
                            <>
                                <Text style={[styles.tableHeaderCell, styles.colNoGst]}>#</Text>
                                <Text style={[styles.tableHeaderCell, styles.colItemGst]}>Item & Description</Text>
                                <Text style={[styles.tableHeaderCell, styles.colHsn]}>HSN</Text>
                                <Text style={[styles.tableHeaderCell, styles.colQtyGst]}>Qty</Text>
                                <Text style={[styles.tableHeaderCell, styles.colRateGst]}>Rate</Text>
                                <Text style={[styles.tableHeaderCell, styles.colTaxGst]}>Tax Info</Text>
                                <Text style={[styles.tableHeaderCell, styles.colAmountGst]}>Amount</Text>
                            </>
                        )}
                        {taxMode === "VAT" && (
                            <>
                                <Text style={[styles.tableHeaderCell, styles.colNoVat]}>#</Text>
                                <Text style={[styles.tableHeaderCell, styles.colItemVat]}>Item & Description</Text>
                                <Text style={[styles.tableHeaderCell, styles.colQtyVat]}>Qty</Text>
                                <Text style={[styles.tableHeaderCell, styles.colRateVat]}>Rate</Text>
                                <Text style={[styles.tableHeaderCell, styles.colVatPct]}>VAT %</Text>
                                <Text style={[styles.tableHeaderCell, styles.colVatAmt]}>VAT Amount</Text>
                                <Text style={[styles.tableHeaderCell, styles.colAmountVat]}>Amount</Text>
                            </>
                        )}
                        {taxMode === "NONE" && (
                            <>
                                <Text style={[styles.tableHeaderCell, styles.colNoNone]}>#</Text>
                                <Text style={[styles.tableHeaderCell, styles.colItemNone]}>Item & Description</Text>
                                <Text style={[styles.tableHeaderCell, styles.colQtyNone]}>Qty</Text>
                                <Text style={[styles.tableHeaderCell, styles.colRateNone]}>Rate</Text>
                                <Text style={[styles.tableHeaderCell, styles.colAmountNone]}>Amount</Text>
                            </>
                        )}
                    </View>

                    {/* Table Rows */}
                    {itemsComputed.map((item, index) => {
                        const unitCode = item.unit?.code || item.product?.unit?.code || "";
                        return (
                            <View key={index} style={styles.tableRow}>
                                {taxMode === "GST" && (
                                    <>
                                        <Text style={[styles.tableCell, styles.colNoGst]}>{index + 1}</Text>
                                        <View style={styles.colItemGst}>
                                            <Text style={styles.tableCellItem}>{item.product?.name || item.description.split('\n')[0]}</Text>
                                            <Text style={styles.tableCellDesc}>{item.description}</Text>
                                        </View>
                                        <Text style={[styles.tableCell, styles.colHsn]}>{item.hsnCode || "-"}</Text>
                                        <Text style={[styles.tableCell, styles.colQtyGst]}>{item.quantity} {unitCode}</Text>
                                        <Text style={[styles.tableCell, styles.colRateGst]}>{fmt(item.unitPrice)}</Text>
                                        <View style={[styles.colTaxGst, { alignItems: 'flex-end' }]}>
                                            <Text style={[styles.tableCell, { textAlign: 'right' }]}>{item.taxLabel}</Text>
                                            <Text style={styles.tableCellDesc}>{fmt(item.taxAmount)}</Text>
                                        </View>
                                        <Text style={[styles.tableCell, styles.colAmountGst]}>{fmt(item.total)}</Text>
                                    </>
                                )}
                                {taxMode === "VAT" && (
                                    <>
                                        <Text style={[styles.tableCell, styles.colNoVat]}>{index + 1}</Text>
                                        <View style={styles.colItemVat}>
                                            <Text style={styles.tableCellItem}>{item.product?.name || item.description.split('\n')[0]}</Text>
                                            <Text style={styles.tableCellDesc}>{item.description}</Text>
                                        </View>
                                        <Text style={[styles.tableCell, styles.colQtyVat]}>{item.quantity} {unitCode}</Text>
                                        <Text style={[styles.tableCell, styles.colRateVat]}>{fmt(item.unitPrice)}</Text>
                                        <Text style={[styles.tableCell, styles.colVatPct]}>{item.vatRate ?? 0}%</Text>
                                        <Text style={[styles.tableCell, styles.colVatAmt]}>{fmt(item.vatAmount ?? 0)}</Text>
                                        <Text style={[styles.tableCell, styles.colAmountVat]}>{fmt(item.total)}</Text>
                                    </>
                                )}
                                {taxMode === "NONE" && (
                                    <>
                                        <Text style={[styles.tableCell, styles.colNoNone]}>{index + 1}</Text>
                                        <View style={styles.colItemNone}>
                                            <Text style={styles.tableCellItem}>{item.product?.name || item.description.split('\n')[0]}</Text>
                                            <Text style={styles.tableCellDesc}>{item.description}</Text>
                                        </View>
                                        <Text style={[styles.tableCell, styles.colQtyNone]}>{item.quantity} {unitCode}</Text>
                                        <Text style={[styles.tableCell, styles.colRateNone]}>{fmt(item.unitPrice)}</Text>
                                        <Text style={[styles.tableCell, styles.colAmountNone]}>{fmt(item.total)}</Text>
                                    </>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Summary */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryBlock}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Sub Total</Text>
                            <Text style={styles.summaryValue}>{fmt(invoice.subtotal)}</Text>
                        </View>

                        {taxMode === "GST" && (
                            invoice.isInterState ? (
                                (invoice.totalIgst ?? 0) > 0 && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>IGST</Text>
                                        <Text style={styles.summaryValue}>{fmt(invoice.totalIgst ?? 0)}</Text>
                                    </View>
                                )
                            ) : (
                                <>
                                    {(invoice.totalCgst ?? 0) > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>CGST</Text>
                                            <Text style={styles.summaryValue}>{fmt(invoice.totalCgst ?? 0)}</Text>
                                        </View>
                                    )}
                                    {(invoice.totalSgst ?? 0) > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>SGST</Text>
                                            <Text style={styles.summaryValue}>{fmt(invoice.totalSgst ?? 0)}</Text>
                                        </View>
                                    )}
                                </>
                            )
                        )}

                        {taxMode === "VAT" && (invoice.totalVat ?? 0) > 0 && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>VAT</Text>
                                <Text style={styles.summaryValue}>{fmt(invoice.totalVat ?? 0)}</Text>
                            </View>
                        )}

                        <View style={styles.summaryRowTotal}>
                            <Text style={styles.summaryLabelTotal}>Total</Text>
                            <Text style={styles.summaryValueTotal}>{currencySymbol}{fmt(invoice.total)}</Text>
                        </View>

                        {invoice.amountPaid > 0 && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Amount Paid</Text>
                                <Text style={styles.summaryValue}>{currencySymbol}{fmt(invoice.amountPaid)}</Text>
                            </View>
                        )}

                        <View style={[styles.balanceDueBanner, { backgroundColor: color }]}>
                            <Text style={styles.balanceDueBannerLabel}>Balance Due</Text>
                            <Text style={styles.balanceDueBannerValue}>{currencySymbol}{fmt(invoice.balanceDue)}</Text>
                        </View>
                    </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                    <Text style={{ fontSize: 8, color: "#6b7280" }}>
                        {numberToWordsLocalized(invoice.total, "en")}
                    </Text>
                </View>

                {/* Notes & Terms */}
                <View style={styles.notesSection}>
                    {hasNotes && (
                        <View style={{ marginBottom: 15 }}>
                            <Text style={styles.notesTitle}>Notes</Text>
                            <Text style={styles.notesText}>{invoice.notes}</Text>
                        </View>
                    )}
                    {hasTerms && (
                        <View>
                            <Text style={styles.notesTitle}>Terms & Conditions</Text>
                            <Text style={styles.notesText}>{invoice.terms}</Text>
                        </View>
                    )}
                </View>

            </Page>
        </Document>
    );
}
