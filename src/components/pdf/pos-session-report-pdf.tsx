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
import type { POSSessionReportData } from "@/lib/pos/session-summary";
import { getLocaleForCurrency } from "@/lib/currency";

interface POSSessionReportPDFProps {
  organization: {
    name: string;
    arabicName?: string | null;
    brandColor?: string | null;
    currency?: string | null;
  };
  report: POSSessionReportData;
  generatedAt: Date | string;
}

const safeBrandColor = (brandColor?: string | null): string => {
  if (brandColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor)) {
    return brandColor;
  }

  return "#0f172a";
};

const formatAmount = (amount: number, currency: string = "INR"): string => {
  try {
    return new Intl.NumberFormat(getLocaleForCurrency(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
};

const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return "N/A / غير متوفر";
  return format(new Date(value), "dd MMM yyyy, hh:mm a");
};

const formatDuration = (openedAt: string | Date, closedAt?: string | Date | null): string => {
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const bilingual = (en: string, ar: string) => `${en} / ${ar}`;

const bilingualValue = (primary?: string | null, secondary?: string | null) => {
  if (primary && secondary) return `${primary}\n${secondary}`;
  return primary || secondary || "N/A / غير متوفر";
};

const buildStyles = (brandColor: string) => StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 30,
    paddingHorizontal: 28,
    fontSize: 9,
    fontFamily: ARABIC_FONT_FAMILY,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  headerBand: {
    backgroundColor: brandColor,
    borderRadius: 12,
    padding: 18,
    marginBottom: 18,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orgBlock: {
    width: "52%",
  },
  orgName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  orgArabicName: {
    fontSize: 10,
    color: "#e2e8f0",
  },
  reportBlock: {
    width: "42%",
    alignItems: "flex-end",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 3,
    textAlign: "right",
  },
  reportSubtitle: {
    fontSize: 9,
    color: "#dbeafe",
    marginBottom: 2,
    textAlign: "right",
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  heroCard: {
    width: "23.5%",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe4f0",
    borderRadius: 10,
    padding: 10,
  },
  heroLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 6,
  },
  heroValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 3,
  },
  heroSub: {
    fontSize: 7.5,
    color: "#475569",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 8,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  infoCard: {
    width: "31.8%",
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 9,
  },
  infoLabel: {
    fontSize: 7.3,
    color: "#64748b",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 9.2,
    color: "#0f172a",
    fontWeight: "bold",
    marginBottom: 2,
  },
  infoSubValue: {
    fontSize: 7.7,
    color: "#475569",
  },
  notesCard: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  notesText: {
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.4,
  },
  dualGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  panel: {
    width: "48.8%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  panelTitle: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: brandColor,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  statRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  statLabel: {
    fontSize: 8.1,
    color: "#64748b",
    paddingRight: 8,
    width: "56%",
  },
  statValue: {
    fontSize: 8.8,
    color: "#0f172a",
    fontWeight: "bold",
    textAlign: "right",
    width: "44%",
  },
  statValuePositive: {
    fontSize: 8.8,
    color: "#15803d",
    fontWeight: "bold",
    textAlign: "right",
    width: "44%",
  },
  statValueNegative: {
    fontSize: 8.8,
    color: "#dc2626",
    fontWeight: "bold",
    textAlign: "right",
    width: "44%",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: brandColor,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 7.4,
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
  cellText: {
    fontSize: 7.8,
    color: "#0f172a",
  },
  cellMuted: {
    fontSize: 7.1,
    color: "#64748b",
    marginTop: 2,
  },
  alignRight: {
    textAlign: "right",
  },
  paymentsColMethod: {
    width: "40%",
    paddingRight: 6,
  },
  paymentsColCount: {
    width: "20%",
    textAlign: "right",
  },
  paymentsColTotal: {
    width: "40%",
    textAlign: "right",
  },
  productsColName: {
    width: "42%",
    paddingRight: 6,
  },
  productsColSku: {
    width: "16%",
    paddingRight: 6,
  },
  productsColQty: {
    width: "12%",
    textAlign: "right",
  },
  productsColRevenue: {
    width: "15%",
    textAlign: "right",
  },
  productsColAvg: {
    width: "15%",
    textAlign: "right",
  },
  invoicesColNumber: {
    width: "18%",
    paddingRight: 6,
  },
  invoicesColDate: {
    width: "21%",
    paddingRight: 6,
  },
  invoicesColCustomer: {
    width: "25%",
    paddingRight: 6,
  },
  invoicesColPayment: {
    width: "12%",
    paddingRight: 6,
  },
  invoicesColTotal: {
    width: "12%",
    textAlign: "right",
  },
  invoicesColBalance: {
    width: "12%",
    textAlign: "right",
  },
  emptyState: {
    padding: 14,
    textAlign: "center",
    color: "#64748b",
    fontSize: 8.2,
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.2,
    color: "#64748b",
  },
});

export function POSSessionReportPDF({
  organization,
  report,
  generatedAt,
}: POSSessionReportPDFProps) {
  const brandColor = safeBrandColor(organization.brandColor);
  const styles = buildStyles(brandColor);
  const currency = organization.currency || "INR";
  const cashDifference =
    report.session.cashDifference ??
    ((report.session.closingCash ?? 0) - (report.session.expectedCash ?? 0));

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerBand}>
          <View style={styles.headerTop}>
            <View style={styles.orgBlock}>
              <Text style={styles.orgName}>{organization.name}</Text>
              <Text style={styles.orgArabicName}>
                {organization.arabicName || "اسم المؤسسة غير متوفر"}
              </Text>
            </View>

            <View style={styles.reportBlock}>
              <Text style={styles.reportTitle}>
                POS Session Report / تقرير جلسة نقطة البيع
              </Text>
              <Text style={styles.reportSubtitle}>
                {bilingual("Session", "الجلسة")}: {report.session.sessionNumber}
              </Text>
              <Text style={styles.reportSubtitle}>
                {bilingual("Generated", "تاريخ الإنشاء")}: {formatDateTime(generatedAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>
              {report.session.totalReturns > 0
                ? bilingual("Net Sales", "صافي المبيعات")
                : bilingual("Total Sales", "إجمالي المبيعات")}
            </Text>
            <Text style={styles.heroValue}>
              {report.session.totalReturns > 0
                ? formatAmount(report.session.totalSales - report.session.totalReturns, currency)
                : formatAmount(report.session.totalSales, currency)}
            </Text>
            <Text style={styles.heroSub}>
              {report.totals.invoiceCount} {bilingual("invoices", "فاتورة")}
              {report.session.totalReturnTransactions > 0 && ` · ${report.session.totalReturnTransactions} ${bilingual("returns", "مرتجعات")}`}
            </Text>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{bilingual("Products Sold", "المنتجات المباعة")}</Text>
            <Text style={styles.heroValue}>{report.totals.totalQuantity}</Text>
            <Text style={styles.heroSub}>
              {report.totals.soldProductCount} {bilingual("unique items", "صنف مختلف")}
            </Text>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{bilingual("Session Duration", "مدة الجلسة")}</Text>
            <Text style={styles.heroValue}>
              {formatDuration(report.session.openedAt, report.session.closedAt)}
            </Text>
            <Text style={styles.heroSub}>
              {bilingual(report.session.status, report.session.status)}
            </Text>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{bilingual("Cash Difference", "فرق النقد")}</Text>
            <Text
              style={
                cashDifference > 0
                  ? styles.statValuePositive
                  : cashDifference < 0
                    ? styles.statValueNegative
                    : styles.heroValue
              }
            >
              {formatAmount(cashDifference, currency)}
            </Text>
            <Text style={styles.heroSub}>
              {bilingual("Expected vs counted", "المتوقع مقابل المعدود")}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Session Overview / نظرة عامة على الجلسة
          </Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Opened By", "فتح بواسطة")}</Text>
              <Text style={styles.infoValue}>
                {bilingualValue(
                  report.session.user.name || report.session.user.email,
                  report.session.user.email
                )}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Closed By", "أغلق بواسطة")}</Text>
              <Text style={styles.infoValue}>
                {bilingualValue(
                  report.session.closedBy?.name || report.session.closedBy?.email,
                  report.session.closedBy?.email
                )}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Branch", "الفرع")}</Text>
              <Text style={styles.infoValue}>
                {bilingualValue(report.session.branch?.name, report.session.branch?.code)}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Warehouse", "المستودع")}</Text>
              <Text style={styles.infoValue}>
                {bilingualValue(report.session.warehouse?.name, report.session.warehouse?.code)}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Opened At", "وقت الفتح")}</Text>
              <Text style={styles.infoValue}>{formatDateTime(report.session.openedAt)}</Text>
              <Text style={styles.infoSubValue}>
                {bilingual("Session start time", "وقت بداية الجلسة")}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Closed At", "وقت الإغلاق")}</Text>
              <Text style={styles.infoValue}>{formatDateTime(report.session.closedAt)}</Text>
              <Text style={styles.infoSubValue}>
                {bilingual("Session close time", "وقت إغلاق الجلسة")}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{bilingual("Transactions", "عدد العمليات")}</Text>
              <Text style={styles.infoValue}>{report.session.totalTransactions}</Text>
              <Text style={styles.infoSubValue}>
                {report.paymentBreakdown.length} {bilingual("payment methods used", "طريقة دفع مستخدمة")}
              </Text>
            </View>
          </View>

          {report.session.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>
                {bilingual("Notes", "ملاحظات")}: {report.session.notes}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.dualGrid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              Cash Summary / ملخص النقد
            </Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{bilingual("Opening Cash", "النقد الافتتاحي")}</Text>
              <Text style={styles.statValue}>
                {formatAmount(report.session.openingCash, currency)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{bilingual("Expected Cash", "النقد المتوقع")}</Text>
              <Text style={styles.statValue}>
                {formatAmount(report.session.expectedCash ?? 0, currency)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{bilingual("Closing Cash", "النقد الختامي")}</Text>
              <Text style={styles.statValue}>
                {formatAmount(report.session.closingCash ?? 0, currency)}
              </Text>
            </View>
            <View style={styles.statRowLast}>
              <Text style={styles.statLabel}>{bilingual("Difference", "الفرق")}</Text>
              <Text
                style={
                  cashDifference > 0
                    ? styles.statValuePositive
                    : cashDifference < 0
                      ? styles.statValueNegative
                      : styles.statValue
                }
              >
                {formatAmount(cashDifference, currency)}
              </Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              Sales Summary / ملخص المبيعات
            </Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{bilingual("Invoices", "الفواتير")}</Text>
              <Text style={styles.statValue}>{report.totals.invoiceCount}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{bilingual("Amount Paid", "المبلغ المدفوع")}</Text>
              <Text style={styles.statValue}>
                {formatAmount(report.totals.totalPaid, currency)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{bilingual("Balance Due", "الرصيد المستحق")}</Text>
              <Text style={styles.statValue}>
                {formatAmount(report.totals.totalBalanceDue, currency)}
              </Text>
            </View>
            <View style={report.session.totalReturns > 0 ? styles.statRow : styles.statRowLast}>
              <Text style={styles.statLabel}>{bilingual("Total Sales", "إجمالي المبيعات")}</Text>
              <Text style={styles.statValue}>
                {formatAmount(report.session.totalSales, currency)}
              </Text>
            </View>
            {report.session.totalReturns > 0 && (
              <>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>{bilingual("Total Returns", "إجمالي المرتجعات")}</Text>
                  <Text style={[styles.statValue, { color: "#dc2626" }]}>
                    {formatAmount(report.session.totalReturns, currency)}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>{bilingual("Return Transactions", "عمليات الإرجاع")}</Text>
                  <Text style={styles.statValue}>
                    {report.session.totalReturnTransactions}
                  </Text>
                </View>
                <View style={styles.statRowLast}>
                  <Text style={styles.statLabel}>{bilingual("Net Sales", "صافي المبيعات")}</Text>
                  <Text style={[styles.statValue, { fontWeight: 700 }]}>
                    {formatAmount(report.session.totalSales - report.session.totalReturns, currency)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Payment Breakdown / تفصيل المدفوعات
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.paymentsColMethod]}>
                {bilingual("Method", "الطريقة")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.paymentsColCount, styles.alignRight]}>
                {bilingual("Count", "العدد")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.paymentsColTotal, styles.alignRight]}>
                {bilingual("Total", "الإجمالي")}
              </Text>
            </View>

            {report.paymentBreakdown.length ? report.paymentBreakdown.map((payment, index) => (
              <View
                key={`${payment.method}-${index}`}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <Text style={[styles.cellText, styles.paymentsColMethod]}>
                  {payment.method}
                </Text>
                <Text style={[styles.cellText, styles.paymentsColCount, styles.alignRight]}>
                  {payment.count}
                </Text>
                <Text style={[styles.cellText, styles.paymentsColTotal, styles.alignRight]}>
                  {formatAmount(payment.total, currency)}
                </Text>
              </View>
            )) : (
              <Text style={styles.emptyState}>
                No payments recorded for this session. / لا توجد مدفوعات مسجلة لهذه الجلسة.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Products Sold / المنتجات المباعة
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.productsColName]}>
                {bilingual("Product", "المنتج")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.productsColSku]}>
                {bilingual("SKU", "الرمز")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.productsColQty, styles.alignRight]}>
                {bilingual("Qty", "الكمية")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.productsColRevenue, styles.alignRight]}>
                {bilingual("Revenue", "الإيراد")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.productsColAvg, styles.alignRight]}>
                {bilingual("Avg", "المتوسط")}
              </Text>
            </View>

            {report.soldProducts.length ? report.soldProducts.map((product, index) => (
              <View
                key={product.key}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <View style={styles.productsColName}>
                  <Text style={styles.cellText}>{product.name}</Text>
                  {product.arabicName ? (
                    <Text style={styles.cellMuted}>{product.arabicName}</Text>
                  ) : null}
                  <Text style={styles.cellMuted}>
                    {product.lineCount} {bilingual("sales lines", "سطر بيع")}
                  </Text>
                </View>
                <Text style={[styles.cellText, styles.productsColSku]}>
                  {product.sku || "-"}
                </Text>
                <Text style={[styles.cellText, styles.productsColQty, styles.alignRight]}>
                  {product.quantity}
                </Text>
                <Text style={[styles.cellText, styles.productsColRevenue, styles.alignRight]}>
                  {formatAmount(product.revenue, currency)}
                </Text>
                <Text style={[styles.cellText, styles.productsColAvg, styles.alignRight]}>
                  {formatAmount(product.quantity ? product.revenue / product.quantity : 0, currency)}
                </Text>
              </View>
            )) : (
              <Text style={styles.emptyState}>
                No products were sold in this session. / لم يتم بيع أي منتجات في هذه الجلسة.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Invoice Register / سجل الفواتير
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.invoicesColNumber]}>
                {bilingual("Invoice", "الفاتورة")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.invoicesColDate]}>
                {bilingual("Date & Time", "التاريخ والوقت")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.invoicesColCustomer]}>
                {bilingual("Customer", "العميل")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.invoicesColPayment]}>
                {bilingual("Payment", "الدفع")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.invoicesColTotal, styles.alignRight]}>
                {bilingual("Total", "الإجمالي")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.invoicesColBalance, styles.alignRight]}>
                {bilingual("Due", "المستحق")}
              </Text>
            </View>

            {report.invoices.length ? report.invoices.map((invoice, index) => (
              <View
                key={invoice.id}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <View style={styles.invoicesColNumber}>
                  <Text style={styles.cellText}>{invoice.invoiceNumber}</Text>
                  <Text style={styles.cellMuted}>
                    {invoice.items.length} {bilingual("items", "صنف")}
                  </Text>
                </View>
                <Text style={[styles.cellText, styles.invoicesColDate]}>
                  {formatDateTime(invoice.createdAt)}
                </Text>
                <View style={styles.invoicesColCustomer}>
                  <Text style={styles.cellText}>
                    {bilingualValue(invoice.customer.name, invoice.customer.arabicName)}
                  </Text>
                </View>
                <Text style={[styles.cellText, styles.invoicesColPayment]}>
                  {invoice.paymentType}
                </Text>
                <Text style={[styles.cellText, styles.invoicesColTotal, styles.alignRight]}>
                  {formatAmount(invoice.total, currency)}
                </Text>
                <Text style={[styles.cellText, styles.invoicesColBalance, styles.alignRight]}>
                  {formatAmount(invoice.balanceDue, currency)}
                </Text>
              </View>
            )) : (
              <Text style={styles.emptyState}>
                No invoices were linked to this session. / لا توجد فواتير مرتبطة بهذه الجلسة.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>POS Session Report / تقرير جلسة نقطة البيع</Text>
          <Text>{report.session.sessionNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
