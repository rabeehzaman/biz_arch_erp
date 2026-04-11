import type { AdvancedSearchField } from "@/types/advanced-search";

export const INVOICE_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "invoiceNumber", labelKey: "sales.invoiceNumber" },
  { type: "combobox", key: "customerId", labelKey: "sales.customer", entityUrl: "/api/customers" },
  { type: "dateRange", key: "issueDate", labelKey: "sales.issueDate", fromKey: "issueDateFrom", toKey: "issueDateTo" },
  { type: "dateRange", key: "dueDate", labelKey: "sales.dueDate", fromKey: "dueDateFrom", toKey: "dueDateTo" },
  { type: "select", key: "status", labelKey: "common.status", options: [
    { value: "paid", labelKey: "common.paid" },
    { value: "unpaid", labelKey: "common.unpaid" },
    { value: "overdue", labelKey: "common.overdue" },
  ]},
  { type: "numberRange", key: "total", labelKey: "common.total", fromKey: "totalMin", toKey: "totalMax" },
  { type: "select", key: "paymentType", labelKey: "sales.paymentType", options: [
    { value: "CASH", labelKey: "common.cash" },
    { value: "CREDIT", labelKey: "payments.credit" },
  ]},
  { type: "combobox", key: "createdById", labelKey: "common.createdBy", entityUrl: "/api/users" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
  { type: "combobox", key: "warehouseId", labelKey: "common.warehouse", entityUrl: "/api/warehouses" },
  { type: "text", key: "notes", labelKey: "common.notes" },
];

export const PURCHASE_INVOICE_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "purchaseInvoiceNumber", labelKey: "purchases.invoiceNumber" },
  { type: "combobox", key: "supplierId", labelKey: "purchases.supplier", entityUrl: "/api/suppliers" },
  { type: "text", key: "supplierInvoiceRef", labelKey: "purchases.supplierInvoiceRef" },
  { type: "dateRange", key: "invoiceDate", labelKey: "purchases.invoiceDate", fromKey: "invoiceDateFrom", toKey: "invoiceDateTo" },
  { type: "dateRange", key: "dueDate", labelKey: "sales.dueDate", fromKey: "dueDateFrom", toKey: "dueDateTo" },
  { type: "select", key: "status", labelKey: "common.status", options: [
    { value: "DRAFT", labelKey: "common.draft" },
    { value: "RECEIVED", labelKey: "common.received" },
    { value: "PAID", labelKey: "common.paid" },
    { value: "PARTIALLY_PAID", labelKey: "common.partiallyPaid" },
    { value: "CANCELLED", labelKey: "common.cancelled" },
  ]},
  { type: "numberRange", key: "total", labelKey: "common.total", fromKey: "totalMin", toKey: "totalMax" },
  { type: "combobox", key: "createdById", labelKey: "common.createdBy", entityUrl: "/api/users" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
  { type: "combobox", key: "warehouseId", labelKey: "common.warehouse", entityUrl: "/api/warehouses" },
];

export const QUOTATION_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "quotationNumber", labelKey: "quotations.quotationNumber" },
  { type: "combobox", key: "customerId", labelKey: "sales.customer", entityUrl: "/api/customers" },
  { type: "dateRange", key: "issueDate", labelKey: "sales.issueDate", fromKey: "issueDateFrom", toKey: "issueDateTo" },
  { type: "dateRange", key: "validUntil", labelKey: "quotations.validUntil", fromKey: "validUntilFrom", toKey: "validUntilTo" },
  { type: "select", key: "status", labelKey: "common.status", options: [
    { value: "SENT", labelKey: "common.sent" },
    { value: "CONVERTED", labelKey: "common.converted" },
    { value: "CANCELLED", labelKey: "common.cancelled" },
    { value: "EXPIRED", labelKey: "common.expired" },
  ]},
  { type: "numberRange", key: "total", labelKey: "common.total", fromKey: "totalMin", toKey: "totalMax" },
  { type: "combobox", key: "createdById", labelKey: "common.createdBy", entityUrl: "/api/users" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
  { type: "combobox", key: "warehouseId", labelKey: "common.warehouse", entityUrl: "/api/warehouses" },
];

export const CREDIT_NOTE_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "creditNoteNumber", labelKey: "creditNotes.creditNoteNumber" },
  { type: "combobox", key: "customerId", labelKey: "sales.customer", entityUrl: "/api/customers" },
  { type: "dateRange", key: "issueDate", labelKey: "sales.issueDate", fromKey: "issueDateFrom", toKey: "issueDateTo" },
  { type: "numberRange", key: "total", labelKey: "common.total", fromKey: "totalMin", toKey: "totalMax" },
  { type: "text", key: "reason", labelKey: "creditNotes.reason" },
  { type: "combobox", key: "createdById", labelKey: "common.createdBy", entityUrl: "/api/users" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
  { type: "combobox", key: "warehouseId", labelKey: "common.warehouse", entityUrl: "/api/warehouses" },
];

export const DEBIT_NOTE_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "debitNoteNumber", labelKey: "debitNotes.debitNoteNumber" },
  { type: "combobox", key: "supplierId", labelKey: "purchases.supplier", entityUrl: "/api/suppliers" },
  { type: "dateRange", key: "issueDate", labelKey: "sales.issueDate", fromKey: "issueDateFrom", toKey: "issueDateTo" },
  { type: "numberRange", key: "total", labelKey: "common.total", fromKey: "totalMin", toKey: "totalMax" },
  { type: "text", key: "reason", labelKey: "debitNotes.reason" },
  { type: "combobox", key: "createdById", labelKey: "common.createdBy", entityUrl: "/api/users" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
  { type: "combobox", key: "warehouseId", labelKey: "common.warehouse", entityUrl: "/api/warehouses" },
];

export const PAYMENT_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "paymentNumber", labelKey: "payments.paymentNo" },
  { type: "combobox", key: "customerId", labelKey: "sales.customer", entityUrl: "/api/customers" },
  { type: "dateRange", key: "paymentDate", labelKey: "payments.paymentDate", fromKey: "paymentDateFrom", toKey: "paymentDateTo" },
  { type: "numberRange", key: "amount", labelKey: "common.amount", fromKey: "amountMin", toKey: "amountMax" },
  { type: "select", key: "paymentMethod", labelKey: "payments.paymentMethod", options: [
    { value: "CASH", labelKey: "common.cash" },
    { value: "BANK_TRANSFER", labelKey: "common.bankTransfer" },
    { value: "CHEQUE", labelKey: "common.check" },
    { value: "UPI", labelKey: "common.upi" },
    { value: "CARD", labelKey: "common.creditCard" },
    { value: "OTHER", labelKey: "common.other" },
  ]},
  { type: "text", key: "reference", labelKey: "common.reference" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
];

export const SUPPLIER_PAYMENT_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "paymentNumber", labelKey: "payments.paymentNo" },
  { type: "combobox", key: "supplierId", labelKey: "purchases.supplier", entityUrl: "/api/suppliers" },
  { type: "dateRange", key: "paymentDate", labelKey: "payments.paymentDate", fromKey: "paymentDateFrom", toKey: "paymentDateTo" },
  { type: "numberRange", key: "amount", labelKey: "common.amount", fromKey: "amountMin", toKey: "amountMax" },
  { type: "select", key: "paymentMethod", labelKey: "payments.paymentMethod", options: [
    { value: "CASH", labelKey: "common.cash" },
    { value: "BANK_TRANSFER", labelKey: "common.bankTransfer" },
    { value: "CHEQUE", labelKey: "common.check" },
    { value: "UPI", labelKey: "common.upi" },
    { value: "CARD", labelKey: "common.creditCard" },
    { value: "OTHER", labelKey: "common.other" },
  ]},
  { type: "text", key: "reference", labelKey: "common.reference" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
];

export const EXPENSE_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "expenseNumber", labelKey: "accounting.entryNumber" },
  { type: "combobox", key: "supplierId", labelKey: "purchases.supplier", entityUrl: "/api/suppliers" },
  { type: "dateRange", key: "expenseDate", labelKey: "accounting.expenseDate", fromKey: "expenseDateFrom", toKey: "expenseDateTo" },
  { type: "numberRange", key: "total", labelKey: "common.total", fromKey: "totalMin", toKey: "totalMax" },
  { type: "text", key: "description", labelKey: "common.description" },
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
];

export const JOURNAL_ENTRY_SEARCH_FIELDS: AdvancedSearchField[] = [
  { type: "text", key: "journalNumber", labelKey: "accounting.entryNumber" },
  { type: "dateRange", key: "date", labelKey: "common.date", fromKey: "dateFrom", toKey: "dateTo" },
  { type: "text", key: "description", labelKey: "common.description" },
  { type: "select", key: "sourceType", labelKey: "common.type", options: [
    { value: "MANUAL", labelKey: "common.all" },
  ]},
  { type: "combobox", key: "branchId", labelKey: "common.branch", entityUrl: "/api/branches" },
];
