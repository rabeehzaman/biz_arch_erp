export interface ColumnDef {
  /** Unique key for this column */
  key: string;
  /** Translation key for the column header label */
  labelKey: string;
  /** If true, column is always visible and can't be hidden */
  required?: boolean;
  /** If true, shown by default (before user customizes) */
  defaultVisible?: boolean;
  /** Text alignment */
  align?: "left" | "right";
}

// ==================== INVOICES ====================

export const INVOICE_COLUMNS: ColumnDef[] = [
  { key: "invoiceNumber", labelKey: "sales.invoiceNumber", required: true, defaultVisible: true },
  { key: "customer", labelKey: "sales.customer", defaultVisible: true },
  { key: "status", labelKey: "common.status", defaultVisible: true },
  { key: "issueDate", labelKey: "sales.issueDate", defaultVisible: true },
  { key: "dueDate", labelKey: "sales.dueDate", defaultVisible: true },
  { key: "total", labelKey: "common.total", defaultVisible: true, align: "right" },
  { key: "balance", labelKey: "common.balance", defaultVisible: true, align: "right" },
  { key: "createdBy", labelKey: "common.createdBy", defaultVisible: false },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "warehouse", labelKey: "common.warehouse", defaultVisible: false },
  { key: "subtotal", labelKey: "common.subtotal", defaultVisible: false, align: "right" },
  { key: "amountPaid", labelKey: "common.amountPaid", defaultVisible: false, align: "right" },
  { key: "paymentType", labelKey: "sales.paymentType", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
  { key: "itemCount", labelKey: "common.items", defaultVisible: false, align: "right" },
];

// ==================== PAYMENTS ====================

export const PAYMENT_COLUMNS: ColumnDef[] = [
  { key: "paymentNumber", labelKey: "payments.paymentNo", required: true, defaultVisible: true },
  { key: "customer", labelKey: "sales.customer", defaultVisible: true },
  { key: "invoice", labelKey: "sales.invoiceNumber", defaultVisible: true },
  { key: "paymentDate", labelKey: "common.date", defaultVisible: true },
  { key: "paymentMethod", labelKey: "payments.paymentMethod", defaultVisible: true },
  { key: "amount", labelKey: "common.amount", defaultVisible: true, align: "right" },
  { key: "discount", labelKey: "common.discount", defaultVisible: true, align: "right" },
  { key: "reference", labelKey: "common.reference", defaultVisible: false },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
  { key: "isAdvance", labelKey: "common.advance", defaultVisible: false },
];

// ==================== PURCHASE INVOICES ====================

export const PURCHASE_INVOICE_COLUMNS: ColumnDef[] = [
  { key: "purchaseInvoiceNumber", labelKey: "purchases.purchaseInvoiceNumber", required: true, defaultVisible: true },
  { key: "supplier", labelKey: "suppliers.supplier", defaultVisible: true },
  { key: "supplierRef", labelKey: "common.supplierRef", defaultVisible: true },
  { key: "invoiceDate", labelKey: "common.date", defaultVisible: true },
  { key: "dueDate", labelKey: "sales.dueDate", defaultVisible: true },
  { key: "status", labelKey: "common.status", defaultVisible: true },
  { key: "total", labelKey: "common.total", defaultVisible: true, align: "right" },
  { key: "balance", labelKey: "common.balance", defaultVisible: true, align: "right" },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "warehouse", labelKey: "common.warehouse", defaultVisible: false },
  { key: "subtotal", labelKey: "common.subtotal", defaultVisible: false, align: "right" },
  { key: "amountPaid", labelKey: "common.amountPaid", defaultVisible: false, align: "right" },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
  { key: "itemCount", labelKey: "common.items", defaultVisible: false, align: "right" },
];

// ==================== QUOTATIONS ====================

export const QUOTATION_COLUMNS: ColumnDef[] = [
  { key: "quotationNumber", labelKey: "quotations.quotationNumber", required: true, defaultVisible: true },
  { key: "customer", labelKey: "sales.customer", defaultVisible: true },
  { key: "issueDate", labelKey: "sales.issueDate", defaultVisible: true },
  { key: "validUntil", labelKey: "quotations.validUntil", defaultVisible: true },
  { key: "status", labelKey: "common.status", defaultVisible: true },
  { key: "total", labelKey: "common.total", defaultVisible: true, align: "right" },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "warehouse", labelKey: "common.warehouse", defaultVisible: false },
  { key: "subtotal", labelKey: "common.subtotal", defaultVisible: false, align: "right" },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
  { key: "itemCount", labelKey: "common.items", defaultVisible: false, align: "right" },
];

// ==================== CREDIT NOTES ====================

export const CREDIT_NOTE_COLUMNS: ColumnDef[] = [
  { key: "creditNoteNumber", labelKey: "creditNotes.cnNo", required: true, defaultVisible: true },
  { key: "customer", labelKey: "sales.customer", defaultVisible: true },
  { key: "invoice", labelKey: "sales.invoiceNumber", defaultVisible: true },
  { key: "issueDate", labelKey: "sales.issueDate", defaultVisible: true },
  { key: "total", labelKey: "common.total", defaultVisible: true, align: "right" },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "warehouse", labelKey: "common.warehouse", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
];

// ==================== DEBIT NOTES ====================

export const DEBIT_NOTE_COLUMNS: ColumnDef[] = [
  { key: "debitNoteNumber", labelKey: "debitNotes.dnNo", required: true, defaultVisible: true },
  { key: "supplier", labelKey: "suppliers.supplier", defaultVisible: true },
  { key: "purchaseInvoice", labelKey: "purchases.purchaseInvoiceNumber", defaultVisible: true },
  { key: "issueDate", labelKey: "sales.issueDate", defaultVisible: true },
  { key: "total", labelKey: "common.total", defaultVisible: true, align: "right" },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "warehouse", labelKey: "common.warehouse", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
];

// ==================== SUPPLIER PAYMENTS ====================

export const SUPPLIER_PAYMENT_COLUMNS: ColumnDef[] = [
  { key: "paymentNumber", labelKey: "payments.paymentNo", required: true, defaultVisible: true },
  { key: "supplier", labelKey: "common.supplier", defaultVisible: true },
  { key: "purchaseInvoice", labelKey: "purchases.purchaseInvoiceNumber", defaultVisible: true },
  { key: "paymentDate", labelKey: "common.date", defaultVisible: true },
  { key: "paymentMethod", labelKey: "payments.paymentMethod", defaultVisible: true },
  { key: "amount", labelKey: "common.amount", defaultVisible: true, align: "right" },
  { key: "discount", labelKey: "common.discount", defaultVisible: true, align: "right" },
  { key: "reference", labelKey: "common.reference", defaultVisible: false },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
];

// ==================== EXPENSES ====================

export const EXPENSE_COLUMNS: ColumnDef[] = [
  { key: "expenseNumber", labelKey: "common.number", required: true, defaultVisible: true },
  { key: "expenseDate", labelKey: "common.date", defaultVisible: true },
  { key: "description", labelKey: "common.description", defaultVisible: true },
  { key: "supplier", labelKey: "common.supplier", defaultVisible: true },
  { key: "status", labelKey: "common.status", defaultVisible: true },
  { key: "total", labelKey: "common.amount", defaultVisible: true, align: "right" },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
];

// ==================== JOURNAL ENTRIES ====================

export const JOURNAL_ENTRY_COLUMNS: ColumnDef[] = [
  { key: "journalNumber", labelKey: "common.number", required: true, defaultVisible: true },
  { key: "date", labelKey: "common.date", defaultVisible: true },
  { key: "description", labelKey: "common.description", defaultVisible: true },
  { key: "source", labelKey: "common.source", defaultVisible: true },
  { key: "status", labelKey: "common.status", defaultVisible: true },
  { key: "debit", labelKey: "accounting.debit", defaultVisible: true, align: "right" },
  { key: "credit", labelKey: "accounting.credit", defaultVisible: true, align: "right" },
  { key: "branch", labelKey: "common.branch", defaultVisible: false },
  { key: "notes", labelKey: "common.notes", defaultVisible: false },
];

// ==================== REGISTRY ====================

export const COLUMN_CONFIGS: Record<string, ColumnDef[]> = {
  invoices: INVOICE_COLUMNS,
  payments: PAYMENT_COLUMNS,
  "purchase-invoices": PURCHASE_INVOICE_COLUMNS,
  quotations: QUOTATION_COLUMNS,
  "credit-notes": CREDIT_NOTE_COLUMNS,
  "debit-notes": DEBIT_NOTE_COLUMNS,
  "supplier-payments": SUPPLIER_PAYMENT_COLUMNS,
  expenses: EXPENSE_COLUMNS,
  "journal-entries": JOURNAL_ENTRY_COLUMNS,
};
