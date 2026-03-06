import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
    Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { numberToWordsLocalized } from "@/lib/number-to-words";

const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const BRAND_COLOR = "#bd4410"; // Dark orange / terracotta from the image

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
        width: 65,
        height: 65,
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
        color: BRAND_COLOR,
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
        color: BRAND_COLOR,
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
    // Entities row
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
        color: BRAND_COLOR,
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
    // Table
    table: {
        width: "100%",
        marginBottom: 20,
    },
    tableHeaderRow: {
        flexDirection: "row",
        backgroundColor: BRAND_COLOR,
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
    // Column Widths
    colNo: { width: "5%" },
    colItem: { width: "35%" },
    colHsn: { width: "10%", textAlign: "center" },
    colQty: { width: "8%", textAlign: "center" },
    colRate: { width: "12%", textAlign: "right" },
    colTax: { width: "15%", textAlign: "right" },
    colAmount: { width: "15%", textAlign: "right" },

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
        backgroundColor: BRAND_COLOR,
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
    // Notes
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

interface InvoiceModernGSTItem {
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
    product?: { unit?: { code: string } | null, name: string } | null;
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
        };
        organization: { name: string; gstin?: string | null };
        items: InvoiceModernGSTItem[];
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
        paymentType?: string;
    };
    type: "SALES" | "PURCHASE";
    headerImageUrl?: string;
}

export function InvoiceModernGSTPDF({
    invoice,
    headerImageUrl,
}: InvoiceModernGSTProps) {
    // Pre-calculate line items
    const itemsComputed = invoice.items.map((item) => {
        const gross = item.quantity * item.unitPrice;
        const discountAmt = (gross * item.discount) / 100;
        const taxableValue = gross - discountAmt;
        const isIgst = invoice.isInterState;
        const taxLabel = isIgst
            ? `IGST ${item.igstRate}%`
            : `CGST ${item.cgstRate}% + SGST ${item.sgstRate}%`;
        const taxAmount = isIgst
            ? item.igstAmount
            : item.cgstAmount + item.sgstAmount;

        return { ...item, gross, discountAmt, taxableValue, taxLabel, taxAmount };
    });

    const hasNotes = invoice.notes && invoice.notes.trim().length > 0;
    const hasTerms = invoice.terms && invoice.terms.trim().length > 0;

    const getAddressLines = (addressStr?: string | null) => {
        if (!addressStr) return [];
        return addressStr.split("\n").filter(Boolean);
    };

    const orgAddress = []; // Replace with actual org address if we decide to fetch it, for now using dummy or just hiding

    return (
        <Document>
            <Page size="A4" orientation="portrait" style={styles.page}>

                {/* Header Section */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        {headerImageUrl ? (
                            <Image src={headerImageUrl} style={styles.logo} />
                        ) : (
                            <View style={{ height: 65, width: 65, borderRadius: 32.5, backgroundColor: BRAND_COLOR, marginBottom: 10, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontSize: 30, fontWeight: 'bold' }}>
                                    {invoice.organization.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.orgName}>{invoice.organization.name}</Text>
                        {/* If org address fields are passed, render them here. Assuming not present in `organization` obj currently except gstin */}
                        {invoice.organization.gstin && (
                            <Text style={styles.orgText}>GSTIN: {invoice.organization.gstin}</Text>
                        )}
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={styles.invoiceTitle}>INVOICE</Text>
                        <View style={styles.invoiceNumberBox}>
                            <Text style={styles.invoiceNumber}># {invoice.invoiceNumber}</Text>
                        </View>
                        <Text style={styles.balanceDueLabelRight}>Balance Due</Text>
                        <Text style={styles.balanceDueAmountRight}>{formatCurrency(invoice.balanceDue)}</Text>
                    </View>
                </View>

                {/* Entities Section */}
                <View style={styles.entitiesRow}>
                    <View style={{ width: "50%" }}>
                        <Text style={styles.billToLabel}>Bill To</Text>
                        <Text style={styles.billToName}>{invoice.customer.name}</Text>
                        {getAddressLines(invoice.customer.address).map((line, i) => (
                            <Text key={i} style={styles.billToText}>{line}</Text>
                        ))}
                        {invoice.customer.city && invoice.customer.state && (
                            <Text style={styles.billToText}>
                                {invoice.customer.city}, {invoice.customer.state}
                            </Text>
                        )}
                        {invoice.customer.gstin && (
                            <Text style={styles.billToText}>GSTIN: {invoice.customer.gstin}</Text>
                        )}
                        {invoice.placeOfSupply && invoice.isInterState && (
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
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, styles.colNo]}>#</Text>
                        <Text style={[styles.tableHeaderCell, styles.colItem]}>Item & Description</Text>
                        <Text style={[styles.tableHeaderCell, styles.colHsn]}>HSN</Text>
                        <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
                        <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
                        <Text style={[styles.tableHeaderCell, styles.colTax]}>Tax Info</Text>
                        <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
                    </View>

                    {itemsComputed.map((item, index) => {
                        const unitCode = item.unit?.code || item.product?.unit?.code || "";
                        return (
                            <View key={index} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.colNo]}>{index + 1}</Text>
                                <View style={styles.colItem}>
                                    <Text style={styles.tableCellItem}>{item.product?.name || item.description.split('\n')[0]}</Text>
                                    <Text style={styles.tableCellDesc}>{item.description}</Text>
                                </View>
                                <Text style={[styles.tableCell, styles.colHsn]}>{item.hsnCode || "-"}</Text>
                                <Text style={[styles.tableCell, styles.colQty]}>{item.quantity} {unitCode}</Text>
                                <Text style={[styles.tableCell, styles.colRate]}>{formatCurrency(item.unitPrice)}</Text>
                                <View style={[styles.colTax, { alignItems: 'flex-end' }]}>
                                    <Text style={[styles.tableCell, { textAlign: 'right' }]}>{item.taxLabel}</Text>
                                    <Text style={styles.tableCellDesc}>{formatCurrency(item.taxAmount)}</Text>
                                </View>
                                <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(item.total)}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Summary */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryBlock}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Sub Total</Text>
                            <Text style={styles.summaryValue}>{formatCurrency(invoice.subtotal)}</Text>
                        </View>

                        {invoice.isInterState ? (
                            invoice.totalIgst > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>IGST</Text>
                                    <Text style={styles.summaryValue}>{formatCurrency(invoice.totalIgst)}</Text>
                                </View>
                            )
                        ) : (
                            <>
                                {invoice.totalCgst > 0 && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>CGST</Text>
                                        <Text style={styles.summaryValue}>{formatCurrency(invoice.totalCgst)}</Text>
                                    </View>
                                )}
                                {invoice.totalSgst > 0 && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>SGST</Text>
                                        <Text style={styles.summaryValue}>{formatCurrency(invoice.totalSgst)}</Text>
                                    </View>
                                )}
                            </>
                        )}

                        <View style={styles.summaryRowTotal}>
                            <Text style={styles.summaryLabelTotal}>Total</Text>
                            <Text style={styles.summaryValueTotal}>₹{formatCurrency(invoice.total)}</Text>
                        </View>

                        <View style={styles.balanceDueBanner}>
                            <Text style={styles.balanceDueBannerLabel}>Balance Due</Text>
                            <Text style={styles.balanceDueBannerValue}>₹{formatCurrency(invoice.balanceDue)}</Text>
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
