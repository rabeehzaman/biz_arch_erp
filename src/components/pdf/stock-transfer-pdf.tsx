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
import { translate } from "@/lib/i18n-translate";
import type { Language } from "@/lib/i18n-translate";
import { formatCurrency, getLocaleForCurrency } from "@/lib/currency";

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
  hideCost?: boolean;
  lang?: Language;
  showSignatures?: boolean;
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  en: { DRAFT: "Draft", APPROVED: "Approved", IN_TRANSIT: "In Transit", COMPLETED: "Completed", CANCELLED: "Cancelled", REVERSED: "Reversed" },
  ar: { DRAFT: "مسودة", APPROVED: "معتمد", IN_TRANSIT: "قيد النقل", COMPLETED: "مكتمل", CANCELLED: "ملغي", REVERSED: "معكوس" },
};

const MILESTONE_LABELS: Record<string, Record<string, string>> = {
  en: { created: "Created", approved: "Approved", shipped: "Shipped", completed: "Completed", cancelled: "Cancelled", reversed: "Reversed" },
  ar: { created: "تاريخ الإنشاء", approved: "تاريخ الموافقة", shipped: "تاريخ الشحن", completed: "تاريخ الاكتمال", cancelled: "تاريخ الإلغاء", reversed: "تاريخ العكس" },
};

const safeBrandColor = (brandColor?: string | null): string => {
  if (brandColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor)) {
    return brandColor;
  }
  return "#0f172a";
};

const buildStyles = (brandColor: string, isRTL: boolean) => StyleSheet.create({
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
    ...(isRTL ? { alignItems: "flex-end" as const } : {}),
  },
  organizationName: {
    fontSize: 18,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 4,
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  organizationSubName: {
    fontSize: 11,
    color: "#475569",
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  documentBlock: {
    width: "42%",
    alignItems: isRTL ? "flex-start" as const : "flex-end" as const,
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
    ...(isRTL ? { alignItems: "flex-end" as const } : {}),
  },
  cardLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 6,
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  cardValue: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 3,
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  cardSubValue: {
    fontSize: 9,
    color: "#475569",
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  statusPill: {
    alignSelf: isRTL ? "flex-end" as const : "flex-start" as const,
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
    ...(isRTL ? { textAlign: "right" as const } : {}),
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
    ...(isRTL ? { alignItems: "flex-end" as const } : {}),
  },
  milestoneLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  milestoneValue: {
    fontSize: 9,
    color: "#0f172a",
    ...(isRTL ? { textAlign: "right" as const } : {}),
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
    ...(isRTL ? { textAlign: "right" as const } : {}),
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
  colIndex: { width: "7%", ...(isRTL ? { textAlign: "right" as const } : {}) },
  colProduct: { width: "39%", paddingRight: 8 },
  colSku: { width: "16%", paddingRight: 8 },
  colQty: { width: "10%", textAlign: "right" as const },
  colUnitCost: { width: "14%", textAlign: "right" as const, ...(isRTL ? { paddingRight: 4 } : {}) },
  colLineTotal: { width: "14%", textAlign: "right" as const },
  cellText: {
    fontSize: 9,
    color: "#0f172a",
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  cellTextRight: {
    fontSize: 9,
    color: "#0f172a",
    textAlign: "right" as const,
  },
  productName: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  productSubtext: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 1,
    ...(isRTL ? { textAlign: "right" as const } : {}),
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
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  notesText: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.45,
    ...(isRTL ? { textAlign: "right" as const } : {}),
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
    ...(isRTL ? { textAlign: "right" as const } : {}),
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#475569",
    ...(isRTL ? { textAlign: "right" as const } : {}),
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
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    paddingHorizontal: 8,
  },
  signatureBlock: {
    width: "28%",
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#475569",
    marginBottom: 6,
    height: 40,
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "center",
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

export function StockTransferPDF({ organization, transfer, hideCost, lang = "en", showSignatures }: StockTransferPDFProps) {
  const currency = organization.currency || "INR";
  const locale = getLocaleForCurrency(currency);
  const isRTL = lang === "ar";
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor, isRTL);
  const t = (key: string) => translate(key, lang);

  const totalQuantity = transfer.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = transfer.items.reduce(
    (sum, item) => sum + (item.quantity * item.unitCost),
    0
  );

  const statusLabels = STATUS_LABELS[lang] || STATUS_LABELS.en;
  const milestoneLabels = MILESTONE_LABELS[lang] || MILESTONE_LABELS.en;

  const milestones = [
    { label: milestoneLabels.created, value: transfer.createdAt },
    { label: milestoneLabels.approved, value: transfer.approvedAt ?? null },
    { label: milestoneLabels.shipped, value: transfer.shippedAt ?? null },
    { label: milestoneLabels.completed, value: transfer.completedAt ?? null },
    { label: milestoneLabels.cancelled, value: transfer.cancelledAt ?? null },
    { label: milestoneLabels.reversed, value: transfer.reversedAt ?? null },
  ].filter((m) => m.value != null);

  const displayOrgName = isRTL
    ? (organization.arabicName || organization.name)
    : organization.name;
  const displayOrgSubName = isRTL
    ? (organization.arabicName ? organization.name : null)
    : (organization.arabicName && organization.arabicName !== organization.name ? organization.arabicName : null);

  // For Arabic, show primary product name as arabicName if available
  const getProductName = (item: TransferItemPDF) => {
    if (isRTL && item.product.arabicName && item.product.arabicName !== item.product.name) {
      return item.product.arabicName;
    }
    return item.product.name;
  };
  const getProductSubtext = (item: TransferItemPDF) => {
    if (isRTL && item.product.arabicName && item.product.arabicName !== item.product.name) {
      return item.product.name;
    }
    if (!isRTL && item.product.arabicName && item.product.arabicName !== item.product.name) {
      return item.product.arabicName;
    }
    return null;
  };

  // RTL: header order is doc block left, org block right
  const headerLeft = isRTL ? (
    <View style={styles.documentBlock}>
      <Text style={styles.documentLabel}>{t("pdf.transferOrder")}</Text>
      <Text style={styles.documentNumber}>{transfer.transferNumber}</Text>
      <Text style={styles.documentMeta}>
        {format(new Date(transfer.transferDate), "dd MMM yyyy")}
      </Text>
    </View>
  ) : (
    <View style={styles.organizationBlock}>
      <Text style={styles.organizationName}>{displayOrgName}</Text>
      {displayOrgSubName && (
        <Text style={styles.organizationSubName}>{displayOrgSubName}</Text>
      )}
    </View>
  );

  const headerRight = isRTL ? (
    <View style={styles.organizationBlock}>
      <Text style={styles.organizationName}>{displayOrgName}</Text>
      {displayOrgSubName && (
        <Text style={styles.organizationSubName}>{displayOrgSubName}</Text>
      )}
    </View>
  ) : (
    <View style={styles.documentBlock}>
      <Text style={styles.documentLabel}>{t("pdf.transferOrder")}</Text>
      <Text style={styles.documentNumber}>{transfer.transferNumber}</Text>
      <Text style={styles.documentMeta}>
        {format(new Date(transfer.transferDate), "dd MMM yyyy")}
      </Text>
    </View>
  );

  // RTL card order: status, to, from (visual right-to-left)
  const cards = isRTL ? (
    <>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("pdf.status")}</Text>
        <Text style={styles.statusPill}>
          {statusLabels[transfer.status] || transfer.status.replace(/_/g, " ")}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("pdf.to")}</Text>
        <Text style={styles.cardValue}>{transfer.destinationWarehouse.name}</Text>
        <Text style={styles.cardSubValue}>{transfer.destinationBranch.name}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("pdf.from")}</Text>
        <Text style={styles.cardValue}>{transfer.sourceWarehouse.name}</Text>
        <Text style={styles.cardSubValue}>{transfer.sourceBranch.name}</Text>
      </View>
    </>
  ) : (
    <>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("pdf.status")}</Text>
        <Text style={styles.statusPill}>
          {statusLabels[transfer.status] || transfer.status.replace(/_/g, " ")}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("pdf.from")}</Text>
        <Text style={styles.cardValue}>{transfer.sourceWarehouse.name}</Text>
        <Text style={styles.cardSubValue}>{transfer.sourceBranch.name}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("pdf.to")}</Text>
        <Text style={styles.cardValue}>{transfer.destinationWarehouse.name}</Text>
        <Text style={styles.cardSubValue}>{transfer.destinationBranch.name}</Text>
      </View>
    </>
  );

  // RTL table: columns ordered right-to-left visually (lineTotal...product...index)
  const tableHeaderCells = isRTL ? (
    <>
      {!hideCost && <Text style={[styles.tableHeaderText, styles.colLineTotal]}>{t("pdf.lineTotal")}</Text>}
      {!hideCost && <Text style={[styles.tableHeaderText, styles.colUnitCost]}>{t("pdf.unitCost")}</Text>}
      <Text style={[styles.tableHeaderText, hideCost ? { width: "15%" } : styles.colQty]}>{t("pdf.qty")}</Text>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "20%", paddingRight: 8 } : styles.colSku]}>{t("pdf.sku")}</Text>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "55%", paddingRight: 8 } : styles.colProduct]}>{t("pdf.product")}</Text>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "10%", textAlign: "right" as const } : styles.colIndex]}>#</Text>
    </>
  ) : (
    <>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "10%" } : styles.colIndex]}>#</Text>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "55%", paddingRight: 8 } : styles.colProduct]}>{t("pdf.product")}</Text>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "20%", paddingRight: 8 } : styles.colSku]}>{t("pdf.sku")}</Text>
      <Text style={[styles.tableHeaderText, hideCost ? { width: "15%", textAlign: "right" as const } : styles.colQty]}>{t("pdf.qty")}</Text>
      {!hideCost && <Text style={[styles.tableHeaderText, styles.colUnitCost]}>{t("pdf.unitCost")}</Text>}
      {!hideCost && <Text style={[styles.tableHeaderText, styles.colLineTotal]}>{t("pdf.lineTotal")}</Text>}
    </>
  );

  const renderRow = (item: TransferItemPDF, index: number) => {
    const productName = getProductName(item);
    const productSub = getProductSubtext(item);

    const cells = isRTL ? (
      <>
        {!hideCost && (
          <Text style={[styles.cellText, styles.colLineTotal]}>
            {formatCurrency(item.quantity * item.unitCost, currency)}
          </Text>
        )}
        {!hideCost && (
          <Text style={[styles.cellText, styles.colUnitCost]}>
            {formatCurrency(item.unitCost, currency)}
          </Text>
        )}
        <Text style={[styles.cellText, hideCost ? { width: "15%" } : styles.colQty]}>
          {item.quantity.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </Text>
        <Text style={[styles.cellText, hideCost ? { width: "20%", paddingRight: 8 } : styles.colSku]}>
          {item.product.sku || "-"}
        </Text>
        <View style={hideCost ? { width: "55%", paddingRight: 8 } : styles.colProduct}>
          <Text style={styles.productName}>{productName}</Text>
          {productSub && <Text style={styles.productSubtext}>{productSub}</Text>}
          {item.notes && <Text style={styles.productSubtext}>{item.notes}</Text>}
        </View>
        <Text style={[styles.cellText, hideCost ? { width: "10%", textAlign: "right" as const } : styles.colIndex]}>{index + 1}</Text>
      </>
    ) : (
      <>
        <Text style={[styles.cellText, hideCost ? { width: "10%" } : styles.colIndex]}>{index + 1}</Text>
        <View style={hideCost ? { width: "55%", paddingRight: 8 } : styles.colProduct}>
          <Text style={styles.productName}>{productName}</Text>
          {productSub && <Text style={styles.productSubtext}>{productSub}</Text>}
          {item.notes && <Text style={styles.productSubtext}>{item.notes}</Text>}
        </View>
        <Text style={[styles.cellText, hideCost ? { width: "20%", paddingRight: 8 } : styles.colSku]}>{item.product.sku || "-"}</Text>
        <Text style={[styles.cellTextRight, hideCost ? { width: "15%", textAlign: "right" as const } : styles.colQty]}>
          {item.quantity.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </Text>
        {!hideCost && (
          <Text style={[styles.cellTextRight, styles.colUnitCost]}>
            {formatCurrency(item.unitCost, currency)}
          </Text>
        )}
        {!hideCost && (
          <Text style={[styles.cellTextRight, styles.colLineTotal]}>
            {formatCurrency(item.quantity * item.unitCost, currency)}
          </Text>
        )}
      </>
    );

    return (
      <View
        key={item.id}
        style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
        wrap={false}
      >
        {cells}
      </View>
    );
  };

  // RTL footer: summary on left, notes on right
  const footerGridContent = isRTL ? (
    <>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>{t("pdf.summary")}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryValue}>{transfer.items.length}</Text>
          <Text style={styles.summaryLabel}>{t("pdf.items")}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryValue}>
            {totalQuantity.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.summaryLabel}>{t("pdf.totalQuantity")}</Text>
        </View>
        {!hideCost && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>{formatCurrency(totalValue, currency)}</Text>
              <Text style={styles.summaryLabel}>{t("pdf.transferValue")}</Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.notesBox}>
        <Text style={styles.notesLabel}>{t("pdf.notes")}</Text>
        <Text style={styles.notesText}>
          {transfer.notes?.trim() || t("pdf.noNotes")}
        </Text>
      </View>
    </>
  ) : (
    <>
      <View style={styles.notesBox}>
        <Text style={styles.notesLabel}>{t("pdf.notes")}</Text>
        <Text style={styles.notesText}>
          {transfer.notes?.trim() || t("pdf.noNotes")}
        </Text>
      </View>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>{t("pdf.summary")}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t("pdf.items")}</Text>
          <Text style={styles.summaryValue}>{transfer.items.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t("pdf.totalQuantity")}</Text>
          <Text style={styles.summaryValue}>
            {totalQuantity.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </Text>
        </View>
        {!hideCost && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("pdf.transferValue")}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalValue, currency)}</Text>
            </View>
          </>
        )}
      </View>
    </>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {headerLeft}
          {headerRight}
        </View>

        <View style={styles.cardGrid}>
          {cards}
        </View>

        {milestones.length > 0 && (
          <View style={styles.milestoneSection}>
            <Text style={styles.sectionTitle}>{t("pdf.transferTimeline")}</Text>
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

        <Text style={styles.sectionTitle}>{t("pdf.items")}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {tableHeaderCells}
          </View>

          {transfer.items.length === 0 ? (
            <Text style={styles.emptyState}>{t("pdf.noItems")}</Text>
          ) : (
            transfer.items.map((item, index) => renderRow(item, index))
          )}
        </View>

        <View style={styles.footerGrid}>
          {footerGridContent}
        </View>

        {(showSignatures || isRTL) && (
          <View style={styles.signatureSection}>
            {isRTL ? (
              <>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>{t("pdf.receiver")}</Text>
                </View>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>{t("pdf.driver")}</Text>
                </View>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>{t("pdf.sender")}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>{t("pdf.sender")}</Text>
                </View>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>{t("pdf.driver")}</Text>
                </View>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>{t("pdf.receiver")}</Text>
                </View>
              </>
            )}
          </View>
        )}

        <Text style={styles.footer}>
          {t("pdf.generatedOn")} {format(new Date(), "dd MMM yyyy, hh:mm a")}
        </Text>
      </Page>
    </Document>
  );
}
