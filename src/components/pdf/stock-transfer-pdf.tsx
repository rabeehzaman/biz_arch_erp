import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import "@/lib/pdf-fonts";
import { ARABIC_FONT_FAMILY } from "@/lib/pdf-fonts";

interface TransferItemPDF {
  id: string;
  quantity: number;
  unitCost: number;
  notes: string | null;
  product: {
    name: string;
    arabicName?: string | null;
    sku: string | null;
  };
}

interface StockTransferPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  transfer: {
    transferNumber: string;
    status: string;
    transferDate: Date | string;
    notes: string | null;
    createdAt: Date | string;
    approvedAt?: Date | string | null;
    shippedAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    reversedAt?: Date | string | null;
    sourceBranch: { name: string };
    sourceWarehouse: { name: string };
    destinationBranch: { name: string };
    destinationWarehouse: { name: string };
    items: TransferItemPDF[];
  };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  IN_TRANSIT: "In Transit",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
};

const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string }> = {
  INR: { symbol: "₹", locale: "en-IN" },
  SAR: { symbol: "SAR ", locale: "en-US" },
};

const formatAmount = (amount: number, currency: string = "INR"): string => {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  return `${config.symbol}${amount.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const safeBrandColor = (brandColor?: string | null): string => {
  if (brandColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor)) {
    return brandColor;
  }

  return "#0f172a";
};

const buildStyles = (brandColor: string) => StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: ARABIC_FONT_FAMILY,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  organizationBlock: {
    width: "48%",
  },
  organizationName: {
    fontSize: 18,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 4,
  },
  organizationArabicName: {
    fontSize: 11,
    color: "#475569",
  },
  documentBlock: {
    width: "42%",
    alignItems: "flex-end",
  },
  documentLabel: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 4,
  },
  documentNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 10,
    color: "#475569",
  },
  cardGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  card: {
    width: "31.5%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  cardLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 3,
  },
  cardSubValue: {
    fontSize: 9,
    color: "#475569",
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: brandColor,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
  },
  milestoneSection: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 8,
  },
  milestoneRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  milestoneCard: {
    width: "31.5%",
    marginHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 8,
  },
  milestoneLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
  },
  milestoneValue: {
    fontSize: 9,
    color: "#0f172a",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: brandColor,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  colIndex: {
    width: "7%",
  },
  colProduct: {
    width: "39%",
    paddingRight: 8,
  },
  colSku: {
    width: "16%",
    paddingRight: 8,
  },
  colQty: {
    width: "10%",
    textAlign: "right",
  },
  colUnitCost: {
    width: "14%",
    textAlign: "right",
  },
  colLineTotal: {
    width: "14%",
    textAlign: "right",
  },
  cellText: {
    fontSize: 9,
    color: "#0f172a",
  },
  cellTextRight: {
    fontSize: 9,
    color: "#0f172a",
    textAlign: "right",
  },
  productName: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
  },
  productSubtext: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 1,
  },
  emptyState: {
    padding: 14,
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
  },
  footerGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  notesBox: {
    width: "58%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    minHeight: 96,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.45,
  },
  summaryBox: {
    width: "38%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#475569",
  },
  summaryValue: {
    fontSize: 9,
    color: "#0f172a",
    fontWeight: "bold",
  },
  summaryDivider: {
    marginVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  footer: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
  },
});

export function StockTransferPDF({ organization, transfer }: StockTransferPDFProps) {
  const currency = organization.currency || "INR";
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor);

  const totalQuantity = transfer.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = transfer.items.reduce(
    (sum, item) => sum + (item.quantity * item.unitCost),
    0
  );

  const milestones = [
    { label: "Created", value: transfer.createdAt },
    { label: "Approved", value: transfer.approvedAt ?? null },
    { label: "Shipped", value: transfer.shippedAt ?? null },
    { label: "Completed", value: transfer.completedAt ?? null },
    { label: "Cancelled", value: transfer.cancelledAt ?? null },
    { label: "Reversed", value: transfer.reversedAt ?? null },
  ].filter((milestone) => milestone.value);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.organizationBlock}>
            <Text style={styles.organizationName}>{organization.name}</Text>
            {organization.arabicName && organization.arabicName !== organization.name && (
              <Text style={styles.organizationArabicName}>{organization.arabicName}</Text>
            )}
          </View>

          <View style={styles.documentBlock}>
            <Text style={styles.documentLabel}>TRANSFER ORDER</Text>
            <Text style={styles.documentNumber}>{transfer.transferNumber}</Text>
            <Text style={styles.documentMeta}>
              {format(new Date(transfer.transferDate), "dd MMM yyyy")}
            </Text>
          </View>
        </View>

        <View style={styles.cardGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Status</Text>
            <Text style={styles.statusPill}>
              {STATUS_LABELS[transfer.status] || transfer.status.replace(/_/g, " ")}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>From</Text>
            <Text style={styles.cardValue}>{transfer.sourceWarehouse.name}</Text>
            <Text style={styles.cardSubValue}>{transfer.sourceBranch.name}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>To</Text>
            <Text style={styles.cardValue}>{transfer.destinationWarehouse.name}</Text>
            <Text style={styles.cardSubValue}>{transfer.destinationBranch.name}</Text>
          </View>
        </View>

        {milestones.length > 0 && (
          <View style={styles.milestoneSection}>
            <Text style={styles.sectionTitle}>Transfer Timeline</Text>
            <View style={styles.milestoneRow}>
              {milestones.map((milestone) => (
                <View key={milestone.label} style={styles.milestoneCard}>
                  <Text style={styles.milestoneLabel}>{milestone.label}</Text>
                  <Text style={styles.milestoneValue}>
                    {format(new Date(milestone.value as Date | string), "dd MMM yyyy, hh:mm a")}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colIndex]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.colProduct]}>Product</Text>
            <Text style={[styles.tableHeaderText, styles.colSku]}>SKU</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colUnitCost]}>Unit Cost</Text>
            <Text style={[styles.tableHeaderText, styles.colLineTotal]}>Line Total</Text>
          </View>

          {transfer.items.length === 0 ? (
            <Text style={styles.emptyState}>No items in this transfer.</Text>
          ) : (
            transfer.items.map((item, index) => (
              <View
                key={item.id}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colIndex]}>{index + 1}</Text>
                <View style={styles.colProduct}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  {item.product.arabicName && item.product.arabicName !== item.product.name && (
                    <Text style={styles.productSubtext}>{item.product.arabicName}</Text>
                  )}
                  {item.notes && (
                    <Text style={styles.productSubtext}>{item.notes}</Text>
                  )}
                </View>
                <Text style={[styles.cellText, styles.colSku]}>{item.product.sku || "-"}</Text>
                <Text style={[styles.cellTextRight, styles.colQty]}>
                  {item.quantity.toLocaleString("en-IN", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text style={[styles.cellTextRight, styles.colUnitCost]}>
                  {formatAmount(item.unitCost, currency)}
                </Text>
                <Text style={[styles.cellTextRight, styles.colLineTotal]}>
                  {formatAmount(item.quantity * item.unitCost, currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footerGrid}>
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>
              {transfer.notes?.trim() || "No additional notes for this transfer."}
            </Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>{transfer.items.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Quantity</Text>
              <Text style={styles.summaryValue}>
                {totalQuantity.toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Transfer Value</Text>
              <Text style={styles.summaryValue}>{formatAmount(totalValue, currency)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Generated on {format(new Date(), "dd MMM yyyy, hh:mm a")}
        </Text>
      </Page>
    </Document>
  );
}
