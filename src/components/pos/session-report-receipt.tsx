import React from "react";

export type SessionReportLanguage = "en" | "ar";

export interface SessionReportCompanyInfo {
  companyName?: string | null;
  arabicName?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyPhone?: string | null;
  companyGstNumber?: string | null;
}

export interface SessionReportOrganizationInfo {
  name?: string | null;
  arabicName?: string | null;
  currency?: string | null;
  brandColor?: string | null;
}

export interface SessionReportInvoiceItemData {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  productId: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    arabicName: string | null;
  } | null;
}

export interface SessionReportInvoicePaymentData {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  paymentDate: string | Date;
}

export interface SessionReportInvoiceData {
  id: string;
  invoiceNumber: string;
  issueDate: string | Date;
  createdAt: string | Date;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentType: string;
  customer: {
    id: string;
    name: string;
    arabicName: string | null;
  };
  payments: SessionReportInvoicePaymentData[];
  items: SessionReportInvoiceItemData[];
}

export interface SessionReportSoldProductData {
  key: string;
  name: string;
  arabicName: string | null;
  sku: string | null;
  quantity: number;
  revenue: number;
  lineCount: number;
}

export interface SessionReportPaymentBreakdownData {
  method: string;
  total: number;
  count: number;
}

export interface SessionReportData {
  session: {
    id: string;
    sessionNumber: string;
    status: string;
    openedAt: string | Date;
    closedAt: string | Date | null;
    openingCash: number;
    closingCash: number | null;
    expectedCash: number | null;
    cashDifference: number | null;
    totalSales: number;
    totalTransactions: number;
    totalReturns: number;
    totalReturnTransactions: number;
    notes: string | null;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
    employee: {
      id: string;
      name: string;
    } | null;
    branch: {
      id: string;
      name: string;
      code: string;
    } | null;
    warehouse: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  invoices: SessionReportInvoiceData[];
  paymentBreakdown: SessionReportPaymentBreakdownData[];
  soldProducts: SessionReportSoldProductData[];
  totals: {
    invoiceCount: number;
    soldProductCount: number;
    totalQuantity: number;
    totalPaid: number;
    totalBalanceDue: number;
  };
  organization?: SessionReportOrganizationInfo;
}

interface SessionReportReceiptProps {
  report: SessionReportData;
  company?: SessionReportCompanyInfo;
  language: SessionReportLanguage;
}

type Labels = {
  title: string;
  generatedAt: string;
  reportFor: string;
  overview: string;
  sessionNumber: string;
  cashier: string;
  employee: string;
  branch: string;
  warehouse: string;
  openedAt: string;
  closedAt: string;
  duration: string;
  notes: string;
  status: string;
  cashSummary: string;
  openingCash: string;
  expectedCash: string;
  countedCash: string;
  cashDifference: string;
  salesSummary: string;
  totalSales: string;
  transactions: string;
  invoiceCount: string;
  totalQuantity: string;
  amountPaid: string;
  balanceDue: string;
  paymentBreakdown: string;
  method: string;
  total: string;
  productsSold: string;
  qty: string;
  revenue: string;
  lines: string;
  invoiceRegister: string;
  customer: string;
  paymentType: string;
  invoiceDate: string;
  items: string;
  payments: string;
  reference: string;
  paymentDate: string;
  product: string;
  unitPrice: string;
  discount: string;
  noPayments: string;
  noProducts: string;
  noInvoices: string;
  notAvailable: string;
  totalReturns: string;
  returnTransactions: string;
  netSales: string;
};

const LABELS: Record<SessionReportLanguage, Labels> = {
  en: {
    title: "POS Session Report",
    generatedAt: "Printed",
    reportFor: "Closed Session",
    overview: "Session Overview",
    sessionNumber: "Session #",
    cashier: "Cashier",
    employee: "Employee",
    branch: "Branch",
    warehouse: "Warehouse",
    openedAt: "Opened At",
    closedAt: "Closed At",
    duration: "Duration",
    notes: "Notes",
    status: "Status",
    cashSummary: "Cash Summary",
    openingCash: "Opening Cash",
    expectedCash: "Expected Cash",
    countedCash: "Counted Cash",
    cashDifference: "Cash Difference",
    salesSummary: "Sales Summary",
    totalSales: "Total Sales",
    transactions: "Transactions",
    invoiceCount: "Invoices",
    totalQuantity: "Total Qty Sold",
    amountPaid: "Amount Paid",
    balanceDue: "Balance Due",
    paymentBreakdown: "Payment Breakdown",
    method: "Method",
    total: "Total",
    productsSold: "Products Summary",
    qty: "Qty",
    revenue: "Revenue",
    lines: "Lines",
    invoiceRegister: "Invoice Totals",
    customer: "Customer",
    paymentType: "Payment Type",
    invoiceDate: "Invoice Time",
    items: "Items",
    payments: "Payments",
    reference: "Reference",
    paymentDate: "Payment Time",
    product: "Product",
    unitPrice: "Price",
    discount: "Disc.",
    noPayments: "No payments recorded.",
    noProducts: "No products sold in this session.",
    noInvoices: "No invoices linked to this session.",
    notAvailable: "N/A",
    totalReturns: "Total Returns",
    returnTransactions: "Return Transactions",
    netSales: "Net Sales",
  },
  ar: {
    title: "تقرير جلسة نقطة البيع",
    generatedAt: "وقت الطباعة",
    reportFor: "الجلسة المغلقة",
    overview: "ملخص الجلسة",
    sessionNumber: "رقم الجلسة",
    cashier: "الكاشير",
    employee: "الموظف",
    branch: "الفرع",
    warehouse: "المستودع",
    openedAt: "وقت الفتح",
    closedAt: "وقت الإغلاق",
    duration: "المدة",
    notes: "ملاحظات",
    status: "الحالة",
    cashSummary: "ملخص النقد",
    openingCash: "النقد الافتتاحي",
    expectedCash: "النقد المتوقع",
    countedCash: "النقد المعدود",
    cashDifference: "فرق النقد",
    salesSummary: "ملخص المبيعات",
    totalSales: "إجمالي المبيعات",
    transactions: "عدد العمليات",
    invoiceCount: "عدد الفواتير",
    totalQuantity: "إجمالي الكمية المباعة",
    amountPaid: "المبلغ المدفوع",
    balanceDue: "الرصيد المستحق",
    paymentBreakdown: "تفصيل المدفوعات",
    method: "الطريقة",
    total: "الإجمالي",
    productsSold: "ملخص المنتجات",
    qty: "الكمية",
    revenue: "الإيراد",
    lines: "السطور",
    invoiceRegister: "إجماليات الفواتير",
    customer: "العميل",
    paymentType: "نوع الدفع",
    invoiceDate: "وقت الفاتورة",
    items: "الأصناف",
    payments: "المدفوعات",
    reference: "المرجع",
    paymentDate: "وقت الدفع",
    product: "الصنف",
    unitPrice: "السعر",
    discount: "الخصم",
    noPayments: "لا توجد مدفوعات مسجلة.",
    noProducts: "لم يتم بيع أي منتجات في هذه الجلسة.",
    noInvoices: "لا توجد فواتير مرتبطة بهذه الجلسة.",
    notAvailable: "غير متوفر",
    totalReturns: "إجمالي المرتجعات",
    returnTransactions: "عمليات الإرجاع",
    netSales: "صافي المبيعات",
  },
};

const PAYMENT_LABELS: Record<SessionReportLanguage, Record<string, string>> = {
  en: {
    CASH: "Cash",
    CREDIT_CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    UPI: "UPI",
    CHECK: "Check",
    OTHER: "Other",
  },
  ar: {
    CASH: "نقداً",
    CREDIT_CARD: "بطاقة",
    BANK_TRANSFER: "تحويل بنكي",
    UPI: "UPI",
    CHECK: "شيك",
    OTHER: "أخرى",
  },
};

const formatCurrency = (
  amount: number,
  currency: string,
  language: SessionReportLanguage
) => {
  const locale = language === "ar" ? "ar-SA" : currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
};

const formatDateTime = (
  value: string | Date | null | undefined,
  language: SessionReportLanguage,
  fallback: string
) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDuration = (
  openedAt: string | Date,
  closedAt: string | Date | null,
  language: SessionReportLanguage
) => {
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (language === "ar") {
    return `${hours} ساعة ${minutes} دقيقة`;
  }

  return `${hours}h ${minutes}m`;
};

const formatPaymentMethod = (
  method: string,
  language: SessionReportLanguage
) => PAYMENT_LABELS[language][method] || method.replace(/_/g, " ");

const containerStyle = (language: SessionReportLanguage): React.CSSProperties => ({
  width: "100%",
  fontFamily: "'Arial', 'Noto Sans Arabic', sans-serif",
  fontSize: "12px",
  lineHeight: 1.45,
  color: "#111827",
  direction: language === "ar" ? "rtl" : "ltr",
  textAlign: language === "ar" ? "right" : "left",
  paddingBottom: "4mm",
});

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "4px",
};

const dividerStyle: React.CSSProperties = {
  borderTop: "1px dashed #94a3b8",
  margin: "6px 0",
};

const itemDividerStyle: React.CSSProperties = {
  borderTop: "1px dotted #cbd5e1",
  margin: "4px 0",
};

function KeyValueRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        alignItems: "flex-start",
        marginBottom: "3px",
      }}
    >
      <span style={{ color: "#475569" }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: "end" }}>{value}</span>
    </div>
  );
}

export function POSSessionReportReceipt({
  report,
  company,
  language,
}: SessionReportReceiptProps) {
  const labels = LABELS[language];
  const currency = report.organization?.currency || "INR";
  const countedCash = report.session.closingCash ?? 0;
  const expectedCash = report.session.expectedCash ?? 0;
  const cashDifference = report.session.cashDifference ?? countedCash - expectedCash;
  const displayName = language === "ar"
    ? company?.arabicName || report.organization?.arabicName || company?.companyName || report.organization?.name || labels.title
    : company?.companyName || report.organization?.name || labels.title;
  const subName = language === "ar"
    ? company?.companyName || report.organization?.name || ""
    : company?.arabicName || report.organization?.arabicName || "";
  const address = [company?.companyAddress, company?.companyCity, company?.companyState]
    .filter(Boolean)
    .join(", ");
  const generatedAt = report.session.closedAt || new Date().toISOString();
  const noteText = report.session.notes?.trim();

  return (
    <div style={containerStyle(language)}>
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontSize: "17px", fontWeight: 800 }}>{displayName}</div>
        {subName ? (
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "1px" }}>
            {subName}
          </div>
        ) : null}
        {address ? (
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
            {address}
          </div>
        ) : null}
        {company?.companyPhone ? (
          <div style={{ fontSize: "10px", color: "#475569" }}>
            {company.companyPhone}
          </div>
        ) : null}
        {company?.companyGstNumber ? (
          <div style={{ fontSize: "10px", color: "#475569" }}>
            {company.companyGstNumber}
          </div>
        ) : null}
        <div style={{ marginTop: "5px", fontSize: "13px", fontWeight: 800 }}>
          {labels.title}
        </div>
        <div style={{ fontSize: "10px", color: "#475569" }}>
          {labels.reportFor}
        </div>
      </div>

      <div style={dividerStyle} />

      <div style={{ marginBottom: "6px" }}>
        <KeyValueRow label={labels.generatedAt} value={formatDateTime(generatedAt, language, labels.notAvailable)} />
        <KeyValueRow label={labels.sessionNumber} value={report.session.sessionNumber} />
      </div>

      <div style={dividerStyle} />

      <div style={{ marginBottom: "7px" }}>
        <div style={sectionTitleStyle}>{labels.overview}</div>
        <KeyValueRow
          label={labels.cashier}
          value={report.session.user.name || report.session.user.email || labels.notAvailable}
        />
        <KeyValueRow
          label={labels.employee}
          value={report.session.employee?.name || labels.notAvailable}
        />
        <KeyValueRow
          label={labels.branch}
          value={report.session.branch?.name || labels.notAvailable}
        />
        <KeyValueRow
          label={labels.warehouse}
          value={report.session.warehouse?.name || labels.notAvailable}
        />
        <KeyValueRow
          label={labels.status}
          value={report.session.status}
        />
        <KeyValueRow
          label={labels.openedAt}
          value={formatDateTime(report.session.openedAt, language, labels.notAvailable)}
        />
        <KeyValueRow
          label={labels.closedAt}
          value={formatDateTime(report.session.closedAt, language, labels.notAvailable)}
        />
        <KeyValueRow
          label={labels.duration}
          value={formatDuration(report.session.openedAt, report.session.closedAt, language)}
        />
        {noteText ? (
          <div style={{ marginTop: "4px" }}>
            <div style={{ color: "#475569", marginBottom: "2px" }}>{labels.notes}</div>
            <div style={{ fontWeight: 700 }}>{noteText}</div>
          </div>
        ) : null}
      </div>

      <div style={dividerStyle} />

      <div style={{ marginBottom: "7px" }}>
        <div style={sectionTitleStyle}>{labels.cashSummary}</div>
        <KeyValueRow
          label={labels.openingCash}
          value={formatCurrency(report.session.openingCash, currency, language)}
        />
        <KeyValueRow
          label={labels.expectedCash}
          value={formatCurrency(expectedCash, currency, language)}
        />
        <KeyValueRow
          label={labels.countedCash}
          value={formatCurrency(countedCash, currency, language)}
        />
        <KeyValueRow
          label={labels.cashDifference}
          value={formatCurrency(cashDifference, currency, language)}
        />
      </div>

      <div style={dividerStyle} />

      <div style={{ marginBottom: "7px" }}>
        <div style={sectionTitleStyle}>{labels.salesSummary}</div>
        <KeyValueRow
          label={labels.totalSales}
          value={formatCurrency(report.session.totalSales, currency, language)}
        />
        <KeyValueRow
          label={labels.transactions}
          value={String(report.session.totalTransactions)}
        />
        {report.session.totalReturns > 0 && (
          <>
            <KeyValueRow
              label={labels.totalReturns}
              value={formatCurrency(report.session.totalReturns, currency, language)}
            />
            <KeyValueRow
              label={labels.returnTransactions}
              value={String(report.session.totalReturnTransactions)}
            />
            <KeyValueRow
              label={labels.netSales}
              value={formatCurrency(report.session.totalSales - report.session.totalReturns, currency, language)}
            />
          </>
        )}
        <KeyValueRow
          label={labels.invoiceCount}
          value={String(report.totals.invoiceCount)}
        />
        <KeyValueRow
          label={labels.totalQuantity}
          value={String(report.totals.totalQuantity)}
        />
        <KeyValueRow
          label={labels.amountPaid}
          value={formatCurrency(report.totals.totalPaid, currency, language)}
        />
        <KeyValueRow
          label={labels.balanceDue}
          value={formatCurrency(report.totals.totalBalanceDue, currency, language)}
        />
      </div>

      <div style={dividerStyle} />

      <div style={{ marginBottom: "7px" }}>
        <div style={sectionTitleStyle}>{labels.paymentBreakdown}</div>
        {report.paymentBreakdown.length ? report.paymentBreakdown.map((payment) => (
          <div key={payment.method} style={{ marginBottom: "4px" }}>
            <KeyValueRow
              label={`${formatPaymentMethod(payment.method, language)} (${payment.count})`}
              value={formatCurrency(payment.total, currency, language)}
            />
          </div>
        )) : (
          <div style={{ color: "#64748b" }}>{labels.noPayments}</div>
        )}
      </div>

      <div style={dividerStyle} />

      <div style={{ marginBottom: "7px" }}>
        <div style={sectionTitleStyle}>{labels.productsSold}</div>
        {report.soldProducts.length ? report.soldProducts.map((product) => (
          <div key={product.key} style={{ marginBottom: "4px" }}>
            <KeyValueRow
              label={language === "ar" ? product.arabicName || product.name : product.name}
              value={formatCurrency(product.revenue, currency, language)}
            />
            <KeyValueRow
              label={labels.qty}
              value={String(product.quantity)}
            />
            <div style={itemDividerStyle} />
          </div>
        )) : (
          <div style={{ color: "#64748b" }}>{labels.noProducts}</div>
        )}
      </div>

      <div style={dividerStyle} />

      <div>
        <div style={sectionTitleStyle}>{labels.invoiceRegister}</div>
        {report.invoices.length ? report.invoices.map((invoice) => (
          <div key={invoice.id} style={{ marginBottom: "4px" }}>
            <KeyValueRow
              label={invoice.invoiceNumber}
              value={formatCurrency(invoice.total, currency, language)}
            />
            <div style={itemDividerStyle} />
          </div>
        )) : (
          <div style={{ color: "#64748b" }}>{labels.noInvoices}</div>
        )}
      </div>
    </div>
  );
}
