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

export interface StockTransferPDFProps {
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

const STATUS_LABELS_AR: Record<string, string> = {
  DRAFT: "مسودة",
  APPROVED: "معتمد",
  IN_TRANSIT: "قيد النقل",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
  REVERSED: "معكوس",
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
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  organizationBlock: {
    width: "48%",
    alignItems: "flex-end",
  },
  organizationName: {
    fontSize: 18,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 4,
    textAlign: "right",
  },
  organizationSubName: {
    fontSize: 11,
    color: "#475569",
    textAlign: "right",
  },
  documentBlock: {
    width: "42%",
    alignItems: "flex-start",
  },
  documentLabel: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 4,
    textAlign: "left",
  },
  documentNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
    textAlign: "left",
  },
  documentMeta: {
    fontSize: 10,
    color: "#475569",
    textAlign: "left",
  },
  cardGrid: {
    flexDirection: "row-reverse",
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
    alignItems: "flex-end",
  },
  cardLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 6,
    textAlign: "right",
  },
  cardValue: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 3,
    textAlign: "right",
  },
  cardSubValue: {
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
  },
  statusPill: {
    alignSelf: "flex-end",
    backgroundColor: brandColor,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
  milestoneSection: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 8,
    textAlign: "right",
  },
  milestoneRow: {
    flexDirection: "row-reverse",
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
    alignItems: "flex-end",
  },
  milestoneLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
    textAlign: "right",
  },
  milestoneValue: {
    fontSize: 9,
    color: "#0f172a",
    textAlign: "right",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: brandColor,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  tableRowAlt: {
    flexDirection: "row-reverse",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  colIndex: {
    width: "7%",
    textAlign: "right",
  },
  colProduct: {
    width: "39%",
    paddingLeft: 8,
    alignItems: "flex-end",
  },
  colSku: {
    width: "16%",
    paddingLeft: 8,
    textAlign: "right",
  },
  colQty: {
    width: "10%",
    textAlign: "left",
  },
  colUnitCost: {
    width: "14%",
    textAlign: "left",
  },
  colLineTotal: {
    width: "14%",
    textAlign: "left",
  },
  cellText: {
    fontSize: 9,
    color: "#0f172a",
    textAlign: "right",
  },
  cellTextLeft: {
    fontSize: 9,
    color: "#0f172a",
    textAlign: "left",
  },
  productName: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "right",
  },
  productSubtext: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 1,
    textAlign: "right",
  },
  emptyState: {
    padding: 14,
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
  },
  footerGrid: {
    flexDirection: "row-reverse",
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
    alignItems: "flex-end",
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 6,
    textAlign: "right",
  },
  notesText: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.45,
    textAlign: "right",
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
    textAlign: "right",
  },
  summaryRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
  },
  summaryValue: {
    fontSize: 9,
    color: "#0f172a",
    fontWeight: "bold",
    textAlign: "left",
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

export function StockTransferArabicPDF({ organization, transfer }: StockTransferPDFProps) {
  const currency = organization.currency || "INR";
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor);

  const totalQuantity = transfer.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = transfer.items.reduce(
    (sum, item) => sum + (item.quantity * item.unitCost),
    0
  );

  const milestones = [
    { label: "تاريخ الإنشاء", value: transfer.createdAt },
    { label: "تاريخ الموافقة", value: transfer.approvedAt ?? null },
    { label: "تاريخ الشحن", value: transfer.shippedAt ?? null },
    { label: "تاريخ الاكتمال", value: transfer.completedAt ?? null },
    { label: "تاريخ الإلغاء", value: transfer.cancelledAt ?? null },
    { label: "تاريخ العكس", value: transfer.reversedAt ?? null },
  ].filter((m) => m.value);

  const displayOrgName = organization.arabicName || organization.name;
  const displayOrgSubName = organization.arabicName ? organization.name : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.organizationBlock}>
            <Text style={styles.organizationName}>{displayOrgName}</Text>
            {displayOrgSubName && (
              <Text style={styles.organizationSubName}>{displayOrgSubName}</Text>
            )}
          </View>

          <View style={styles.documentBlock}>
            <Text style={styles.documentLabel}>أمر تحويل</Text>
            <Text style={styles.documentNumber}>{transfer.transferNumber}</Text>
            <Text style={styles.documentMeta}>
              {format(new Date(transfer.transferDate), "dd MMM yyyy")}
            </Text>
          </View>
        </View>

        {/* Status / From / To cards */}
        <View style={styles.cardGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>الحالة</Text>
            <Text style={styles.statusPill}>
              {STATUS_LABELS_AR[transfer.status] || transfer.status.replace(/_/g, " ")}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>من</Text>
            <Text style={styles.cardValue}>{transfer.sourceWarehouse.name}</Text>
            <Text style={styles.cardSubValue}>{transfer.sourceBranch.name}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>إلى</Text>
            <Text style={styles.cardValue}>{transfer.destinationWarehouse.name}</Text>
            <Text style={styles.cardSubValue}>{transfer.destinationBranch.name}</Text>
          </View>
        </View>

        {/* Timeline */}
        {milestones.length > 0 && (
          <View style={styles.milestoneSection}>
            <Text style={styles.sectionTitle}>الجدول الزمني للتحويل</Text>
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

        {/* Items table */}
        <Text style={styles.sectionTitle}>البنود</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colIndex]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.colProduct]}>المنتج</Text>
            <Text style={[styles.tableHeaderText, styles.colSku]}>رمز المنتج</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>الكمية</Text>
            <Text style={[styles.tableHeaderText, styles.colUnitCost]}>تكلفة الوحدة</Text>
            <Text style={[styles.tableHeaderText, styles.colLineTotal]}>الإجمالي</Text>
          </View>

          {transfer.items.length === 0 ? (
            <Text style={styles.emptyState}>لا توجد بنود في هذا التحويل.</Text>
          ) : (
            transfer.items.map((item, index) => (
              <View
                key={item.id}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                wrap={false}
              >
                <Text style={[styles.cellText, styles.colIndex]}>{index + 1}</Text>
                <View style={styles.colProduct}>
                  {/* Arabic name primary, English as subtext */}
                  <Text style={styles.productName}>
                    {item.product.arabicName && item.product.arabicName !== item.product.name
                      ? item.product.arabicName
                      : item.product.name}
                  </Text>
                  {item.product.arabicName && item.product.arabicName !== item.product.name && (
                    <Text style={styles.productSubtext}>{item.product.name}</Text>
                  )}
                  {item.notes && (
                    <Text style={styles.productSubtext}>{item.notes}</Text>
                  )}
                </View>
                <Text style={[styles.cellText, styles.colSku]}>{item.product.sku || "-"}</Text>
                <Text style={[styles.cellTextLeft, styles.colQty]}>
                  {item.quantity.toLocaleString("en-IN", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text style={[styles.cellTextLeft, styles.colUnitCost]}>
                  {formatAmount(item.unitCost, currency)}
                </Text>
                <Text style={[styles.cellTextLeft, styles.colLineTotal]}>
                  {formatAmount(item.quantity * item.unitCost, currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Footer: Notes + Summary */}
        <View style={styles.footerGrid}>
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>ملاحظات</Text>
            <Text style={styles.notesText}>
              {transfer.notes?.trim() || "لا توجد ملاحظات إضافية لهذا التحويل."}
            </Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>الملخص</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>البنود</Text>
              <Text style={styles.summaryValue}>{transfer.items.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>إجمالي الكمية</Text>
              <Text style={styles.summaryValue}>
                {totalQuantity.toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>قيمة التحويل</Text>
              <Text style={styles.summaryValue}>{formatAmount(totalValue, currency)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          صدر بتاريخ {format(new Date(), "dd MMM yyyy, hh:mm a")}
        </Text>
      </Page>
    </Document>
  );
}
