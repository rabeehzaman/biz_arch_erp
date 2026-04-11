/**
 * System (predefined) views per module — Zoho Books-style.
 * Each view defines a set of filter params that map directly
 * to the query parameters accepted by the list API routes.
 */

export interface ViewFilters {
  /** Key-value pairs sent as query params to the API */
  params: Record<string, string>;
  /** Client-side status filter (for pages that filter locally) */
  statusFilter?: string;
  /** Client-side date filter preset */
  dateFilter?: string;
}

export interface SystemView {
  id: string;
  labelKey: string;
  filters: ViewFilters;
}

// ==================== INVOICES ====================

export const INVOICE_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allInvoices",
    filters: { params: {}, statusFilter: "all", dateFilter: "all" },
  },
  {
    id: "paid",
    labelKey: "common.paid",
    filters: { params: { status: "paid" }, statusFilter: "paid", dateFilter: "all" },
  },
  {
    id: "unpaid",
    labelKey: "common.unpaid",
    filters: { params: { status: "unpaid" }, statusFilter: "unpaid", dateFilter: "all" },
  },
  {
    id: "overdue",
    labelKey: "common.overdue",
    filters: { params: { status: "overdue" }, statusFilter: "overdue", dateFilter: "all" },
  },
  {
    id: "thisMonth",
    labelKey: "views.thisMonthInvoices",
    filters: { params: {}, statusFilter: "all", dateFilter: "thisMonth" },
  },
];

// ==================== PURCHASE INVOICES ====================

export const PURCHASE_INVOICE_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allPurchaseInvoices",
    filters: { params: {}, statusFilter: "all" },
  },
  {
    id: "draft",
    labelKey: "common.draft",
    filters: { params: { status: "DRAFT" }, statusFilter: "DRAFT" },
  },
  {
    id: "received",
    labelKey: "common.received",
    filters: { params: { status: "RECEIVED" }, statusFilter: "RECEIVED" },
  },
  {
    id: "paid",
    labelKey: "common.paid",
    filters: { params: { status: "PAID" }, statusFilter: "PAID" },
  },
  {
    id: "partiallyPaid",
    labelKey: "common.partiallyPaid",
    filters: { params: { status: "PARTIALLY_PAID" }, statusFilter: "PARTIALLY_PAID" },
  },
];

// ==================== QUOTATIONS ====================

export const QUOTATION_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allQuotations",
    filters: { params: {} },
  },
  {
    id: "sent",
    labelKey: "common.sent",
    filters: { params: { status: "SENT" } },
  },
  {
    id: "converted",
    labelKey: "common.converted",
    filters: { params: { status: "CONVERTED" } },
  },
  {
    id: "expired",
    labelKey: "common.expired",
    filters: { params: { status: "EXPIRED" } },
  },
];

// ==================== CREDIT NOTES ====================

export const CREDIT_NOTE_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allCreditNotes",
    filters: { params: {} },
  },
];

// ==================== DEBIT NOTES ====================

export const DEBIT_NOTE_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allDebitNotes",
    filters: { params: {} },
  },
];

// ==================== PAYMENTS ====================

export const PAYMENT_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allPayments",
    filters: { params: {} },
  },
  {
    id: "cash",
    labelKey: "common.cash",
    filters: { params: { paymentMethod: "CASH" } },
  },
  {
    id: "bankTransfer",
    labelKey: "common.bankTransfer",
    filters: { params: { paymentMethod: "BANK_TRANSFER" } },
  },
];

// ==================== SUPPLIER PAYMENTS ====================

export const SUPPLIER_PAYMENT_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allSupplierPayments",
    filters: { params: {} },
  },
  {
    id: "cash",
    labelKey: "common.cash",
    filters: { params: { paymentMethod: "CASH" } },
  },
  {
    id: "bankTransfer",
    labelKey: "common.bankTransfer",
    filters: { params: { paymentMethod: "BANK_TRANSFER" } },
  },
];

// ==================== EXPENSES ====================

export const EXPENSE_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allExpenses",
    filters: { params: {} },
  },
];

// ==================== JOURNAL ENTRIES ====================

export const JOURNAL_ENTRY_SYSTEM_VIEWS: SystemView[] = [
  {
    id: "all",
    labelKey: "views.allJournalEntries",
    filters: { params: {} },
  },
];

/** Registry lookup by module name */
export const SYSTEM_VIEWS: Record<string, SystemView[]> = {
  invoices: INVOICE_SYSTEM_VIEWS,
  "purchase-invoices": PURCHASE_INVOICE_SYSTEM_VIEWS,
  quotations: QUOTATION_SYSTEM_VIEWS,
  "credit-notes": CREDIT_NOTE_SYSTEM_VIEWS,
  "debit-notes": DEBIT_NOTE_SYSTEM_VIEWS,
  payments: PAYMENT_SYSTEM_VIEWS,
  "supplier-payments": SUPPLIER_PAYMENT_SYSTEM_VIEWS,
  expenses: EXPENSE_SYSTEM_VIEWS,
  "journal-entries": JOURNAL_ENTRY_SYSTEM_VIEWS,
};
