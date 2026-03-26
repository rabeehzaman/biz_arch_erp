// ────────────────────────────────────────────────────────────────
// Form Configuration Types & Registry
// Super-admin-configurable defaults / field visibility per org
// ────────────────────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "number" | "date" | "boolean" | "select" | "entity";

export interface FieldDef {
  label: string;
  type: FieldType;
  required: boolean;
  /** If false, super admin cannot hide this field */
  canHide: boolean;
  /** If true, this field supports per-user default overrides */
  perUser?: boolean;
  /** Fixed options for select fields */
  options?: readonly string[];
  /** If set, field only applies to this edition (omit for universal fields) */
  edition?: "INDIA" | "SAUDI";
}

export interface ColumnDef {
  label: string;
  /** If false, super admin cannot hide this column */
  canHide: boolean;
  /** Default value when column is hidden (e.g., 0 for discount) */
  hiddenDefault: string | number;
}

export interface FormDef {
  label: string;
  fields: Record<string, FieldDef>;
  /** Line item table columns that can be hidden (only for forms with line items) */
  columns?: Record<string, ColumnDef>;
}

// ── Per-form field config stored in Setting table ──────────────
export interface FieldConfig {
  hidden: string[];
  defaults: Record<string, string | number | boolean>;
  /** Line item column keys to hide (e.g., ["discount", "hsnCode"]) */
  hiddenColumns?: string[];
}

export type FormFieldConfig = Partial<Record<FormName, FieldConfig>>;

// ── Mobile nav tab shape (stored in Setting table) ─────────────
export interface MobileNavTab {
  key: string;
  href: string;
  icon: string;
  labelKey: string;
  mobileLabelKey?: string;
}

// ── Full org config returned by /api/form-config ───────────────
export interface OrgFormConfig {
  fields: FormFieldConfig;
  disabledReports: string[];
  disabledSidebarItems: string[];
  sidebarMode: "full" | "hidden";
  sidebarSectionOrder: string[] | null;
  mobileNavTabs: MobileNavTab[] | null;
  defaultLandingPage: string | null;
}

// ────────────────────────────────────────────────────────────────
// FORM REGISTRY — canonical list of all configurable forms/fields
// ────────────────────────────────────────────────────────────────

export const FORM_REGISTRY = {
  salesInvoice: {
    label: "Sales Invoice",
    fields: {
      customerId:   { label: "Customer",       type: "entity"   as const, required: true,  canHide: false },
      date:         { label: "Issue Date",     type: "date"     as const, required: true,  canHide: false },
      dueDate:      { label: "Due Date",       type: "date"     as const, required: false, canHide: true },
      branchId:     { label: "Branch",         type: "entity"   as const, required: false, canHide: true,  perUser: true },
      warehouseId:  { label: "Warehouse",      type: "entity"   as const, required: false, canHide: true,  perUser: true },
      paymentType:  { label: "Payment Type",   type: "select"   as const, required: true,  canHide: true, options: ["CASH", "CREDIT"] as const },
      taxInclusive: { label: "Tax Inclusive",   type: "boolean"  as const, required: false, canHide: true },
      notes:        { label: "Notes",          type: "textarea" as const, required: false, canHide: true },
      terms:        { label: "Terms",          type: "textarea" as const, required: false, canHide: true },
    },
    columns: {
      discount: { label: "Discount %", canHide: true, hiddenDefault: 0 },
      unit:     { label: "Unit",       canHide: true, hiddenDefault: "" },
      hsnCode:  { label: "HSN Code",   canHide: true, hiddenDefault: "" },
    },
  },
  purchaseInvoice: {
    label: "Purchase Invoice",
    fields: {
      supplierId:         { label: "Supplier",      type: "entity"   as const, required: true,  canHide: false },
      invoiceDate:        { label: "Invoice Date",  type: "date"     as const, required: true,  canHide: false },
      dueDate:            { label: "Due Date",      type: "date"     as const, required: false, canHide: true },
      supplierInvoiceRef: { label: "Supplier Ref",  type: "text"     as const, required: false, canHide: true },
      branchId:           { label: "Branch",        type: "entity"   as const, required: false, canHide: true,  perUser: true },
      warehouseId:        { label: "Warehouse",     type: "entity"   as const, required: false, canHide: true,  perUser: true },
      notes:              { label: "Notes",         type: "textarea" as const, required: false, canHide: true },
    },
    columns: {
      discount: { label: "Discount %", canHide: true, hiddenDefault: 0 },
      unit:     { label: "Unit",       canHide: true, hiddenDefault: "" },
      hsnCode:  { label: "HSN Code",   canHide: true, hiddenDefault: "" },
    },
  },
  creditNote: {
    label: "Credit Note",
    fields: {
      customerId:  { label: "Customer",    type: "entity"   as const, required: true,  canHide: false },
      invoiceId:   { label: "Invoice Ref", type: "entity"   as const, required: false, canHide: true },
      issueDate:   { label: "Issue Date",  type: "date"     as const, required: true,  canHide: false },
      reason:      { label: "Reason",      type: "text"     as const, required: false, canHide: true },
      notes:       { label: "Notes",       type: "textarea" as const, required: false, canHide: true },
      branchId:    { label: "Branch",      type: "entity"   as const, required: false, canHide: true,  perUser: true },
      warehouseId: { label: "Warehouse",   type: "entity"   as const, required: false, canHide: true,  perUser: true },
    },
    columns: {
      discount: { label: "Discount %", canHide: true, hiddenDefault: 0 },
      unit:     { label: "Unit",       canHide: true, hiddenDefault: "" },
    },
  },
  debitNote: {
    label: "Debit Note",
    fields: {
      supplierId:        { label: "Supplier",     type: "entity"   as const, required: true,  canHide: false },
      purchaseInvoiceId: { label: "Purchase Ref", type: "entity"   as const, required: false, canHide: true },
      issueDate:         { label: "Issue Date",   type: "date"     as const, required: true,  canHide: false },
      reason:            { label: "Reason",       type: "text"     as const, required: false, canHide: true },
      notes:             { label: "Notes",        type: "textarea" as const, required: false, canHide: true },
    },
    columns: {
      discount: { label: "Discount %", canHide: true, hiddenDefault: 0 },
      unit:     { label: "Unit",       canHide: true, hiddenDefault: "" },
    },
  },
  quotation: {
    label: "Quotation",
    fields: {
      customerId:  { label: "Customer",    type: "entity"   as const, required: true,  canHide: false },
      date:        { label: "Date",        type: "date"     as const, required: true,  canHide: false },
      expiryDate:  { label: "Expiry Date", type: "date"     as const, required: false, canHide: true },
      branchId:    { label: "Branch",      type: "entity"   as const, required: false, canHide: true,  perUser: true },
      warehouseId: { label: "Warehouse",   type: "entity"   as const, required: false, canHide: true,  perUser: true },
      notes:       { label: "Notes",       type: "textarea" as const, required: false, canHide: true },
      terms:       { label: "Terms",       type: "textarea" as const, required: false, canHide: true },
    },
    columns: {
      discount: { label: "Discount %", canHide: true, hiddenDefault: 0 },
      unit:     { label: "Unit",       canHide: true, hiddenDefault: "" },
      hsnCode:  { label: "HSN Code",   canHide: true, hiddenDefault: "" },
    },
  },
  customer: {
    label: "Customer",
    fields: {
      name:       { label: "Name",              type: "text"     as const, required: true,  canHide: false },
      email:      { label: "Email",             type: "text"     as const, required: false, canHide: true },
      phone:      { label: "Phone",             type: "text"     as const, required: false, canHide: true },
      address:    { label: "Address",           type: "textarea" as const, required: false, canHide: true },
      city:       { label: "City",              type: "text"     as const, required: false, canHide: true },
      state:      { label: "State",             type: "text"     as const, required: false, canHide: true },
      zipCode:    { label: "Zip Code",          type: "text"     as const, required: false, canHide: true },
      country:    { label: "Country",           type: "text"     as const, required: false, canHide: true },
      gstin:      { label: "GSTIN",             type: "text"     as const, required: false, canHide: true, edition: "INDIA" },
      vatNumber:  { label: "VAT Number (TRN)",  type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      arabicName: { label: "Arabic Name",       type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      ccNo:       { label: "C.R No",            type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      buildingNo: { label: "Building No",       type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      addNo:      { label: "Additional No",     type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      district:   { label: "District",          type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      notes:      { label: "Notes",             type: "textarea" as const, required: false, canHide: true },
    },
  },
  supplier: {
    label: "Supplier",
    fields: {
      name:       { label: "Name",              type: "text"     as const, required: true,  canHide: false },
      email:      { label: "Email",             type: "text"     as const, required: false, canHide: true },
      phone:      { label: "Phone",             type: "text"     as const, required: false, canHide: true },
      address:    { label: "Address",           type: "textarea" as const, required: false, canHide: true },
      city:       { label: "City",              type: "text"     as const, required: false, canHide: true },
      state:      { label: "State",             type: "text"     as const, required: false, canHide: true },
      zipCode:    { label: "Zip Code",          type: "text"     as const, required: false, canHide: true },
      country:    { label: "Country",           type: "text"     as const, required: false, canHide: true },
      gstin:      { label: "GSTIN",             type: "text"     as const, required: false, canHide: true, edition: "INDIA" },
      vatNumber:  { label: "VAT Number (TRN)",  type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      arabicName: { label: "Arabic Name",       type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      ccNo:       { label: "C.R No",            type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      buildingNo: { label: "Building No",       type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      addNo:      { label: "Additional No",     type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      district:   { label: "District",          type: "text"     as const, required: false, canHide: true, edition: "SAUDI" },
      notes:      { label: "Notes",             type: "textarea" as const, required: false, canHide: true },
    },
  },
  product: {
    label: "Product",
    fields: {
      name:        { label: "Name",        type: "text"     as const, required: true,  canHide: false },
      description: { label: "Description", type: "textarea" as const, required: false, canHide: true },
      price:       { label: "Price",       type: "number"   as const, required: true,  canHide: false },
      cost:        { label: "Cost",        type: "number"   as const, required: false, canHide: true },
      sku:         { label: "SKU",         type: "text"     as const, required: false, canHide: true },
      barcode:     { label: "Barcode",     type: "text"     as const, required: false, canHide: true },
      categoryId:  { label: "Category",    type: "entity"   as const, required: false, canHide: true },
      unitId:      { label: "Unit",        type: "entity"   as const, required: false, canHide: true },
      hsnCode:     { label: "HSN Code",    type: "text"     as const, required: false, canHide: true, edition: "INDIA" },
      gstRate:     { label: "GST Rate",    type: "number"   as const, required: false, canHide: true, edition: "INDIA" },
    },
  },
  expense: {
    label: "Expense",
    fields: {
      expenseDate: { label: "Expense Date", type: "date"     as const, required: true,  canHide: false },
      description: { label: "Description",  type: "text"     as const, required: false, canHide: true },
      supplierId:  { label: "Supplier",     type: "entity"   as const, required: false, canHide: true },
      notes:       { label: "Notes",        type: "textarea" as const, required: false, canHide: true },
    },
  },
  payment: {
    label: "Customer Payment",
    fields: {
      customerId: { label: "Customer",  type: "entity"   as const, required: true,  canHide: false },
      date:       { label: "Date",      type: "date"     as const, required: true,  canHide: false },
      method:     { label: "Method",    type: "select"   as const, required: true,  canHide: true, options: ["CASH", "BANK_TRANSFER", "CHEQUE", "UPI"] as const },
      reference:  { label: "Reference", type: "text"     as const, required: false, canHide: true },
      notes:      { label: "Notes",     type: "textarea" as const, required: false, canHide: true },
    },
  },
  supplierPayment: {
    label: "Supplier Payment",
    fields: {
      supplierId: { label: "Supplier",  type: "entity"   as const, required: true,  canHide: false },
      date:       { label: "Date",      type: "date"     as const, required: true,  canHide: false },
      method:     { label: "Method",    type: "select"   as const, required: true,  canHide: true, options: ["CASH", "BANK_TRANSFER", "CHEQUE", "UPI"] as const },
      reference:  { label: "Reference", type: "text"     as const, required: false, canHide: true },
      notes:      { label: "Notes",     type: "textarea" as const, required: false, canHide: true },
    },
  },
  mobileDevice: {
    label: "Mobile Device",
    fields: {
      imei1:           { label: "IMEI 1",        type: "text"     as const, required: true,  canHide: false },
      imei2:           { label: "IMEI 2",        type: "text"     as const, required: false, canHide: true },
      serialNumber:    { label: "Serial Number", type: "text"     as const, required: false, canHide: true },
      brand:           { label: "Brand",         type: "text"     as const, required: true,  canHide: false },
      model:           { label: "Model",         type: "text"     as const, required: true,  canHide: false },
      color:           { label: "Color",         type: "text"     as const, required: false, canHide: true },
      storageCapacity: { label: "Storage",       type: "text"     as const, required: false, canHide: true },
      ram:             { label: "RAM",           type: "text"     as const, required: false, canHide: true },
      notes:           { label: "Notes",         type: "textarea" as const, required: false, canHide: true },
    },
  },
} as const satisfies Record<string, FormDef>;

export type FormName = keyof typeof FORM_REGISTRY;

// ── Sidebar section keys ───────────────────────────────────────
export const SIDEBAR_SECTIONS = [
  "general",
  "sales",
  "purchases",
  "accounting",
  "inventory",
  "mobileShop",
  "jewellery",
  "restaurant",
] as const;

export type SidebarSection = (typeof SIDEBAR_SECTIONS)[number];

// ── Available mobile nav tabs pool ─────────────────────────────
export const MOBILE_NAV_TAB_POOL: MobileNavTab[] = [
  { key: "home",      href: "/",                     icon: "LayoutDashboard", labelKey: "nav.dashboard" },
  { key: "sales",     href: "/invoices",             icon: "ShoppingCart",    labelKey: "nav.sales" },
  { key: "purchases", href: "/purchase-invoices",    icon: "Truck",           labelKey: "nav.purchases" },
  { key: "pos",       href: "/pos",                  icon: "Monitor",         labelKey: "nav.posTerminal", mobileLabelKey: "nav.posShort" },
  { key: "products",  href: "/products",             icon: "Package",         labelKey: "nav.products" },
  { key: "customers", href: "/customers",            icon: "Users",           labelKey: "nav.customers" },
  { key: "suppliers", href: "/suppliers",            icon: "Truck",           labelKey: "nav.suppliers" },
  { key: "expenses",  href: "/accounting/expenses",  icon: "Receipt",         labelKey: "nav.expenses" },
  { key: "reports",   href: "/reports",              icon: "BarChart3",       labelKey: "nav.reports" },
  { key: "settings",  href: "/settings",             icon: "Settings",        labelKey: "nav.settings" },
  { key: "more",      href: "/more",                 icon: "MoreHorizontal",  labelKey: "nav.more" },
];

// ── Available landing pages ────────────────────────────────────
export const LANDING_PAGE_OPTIONS = [
  { value: "/",                     label: "Dashboard" },
  { value: "/pos",                  label: "POS Terminal" },
  { value: "/invoices",             label: "Sales Invoices" },
  { value: "/purchase-invoices",    label: "Purchase Invoices" },
  { value: "/products",             label: "Products" },
  { value: "/customers",            label: "Customers" },
  { value: "/suppliers",            label: "Suppliers" },
  { value: "/accounting/expenses",  label: "Expenses" },
  { value: "/reports",              label: "Reports" },
  { value: "/settings",             label: "Settings" },
] as const;

// ── All report slugs ──────────────────────────────────────────
export const ALL_REPORT_SLUGS = [
  "profit-by-items",
  "sales-by-customer",
  "sales-by-item",
  "sales-by-salesperson",
  "sales-register",
  "purchase-register",
  "purchases-by-supplier",
  "purchases-by-item",
  "customer-balances",
  "supplier-balances",
  "ar-aging",
  "ap-aging",
  "profit-loss",
  "balance-sheet",
  "trial-balance",
  "cash-flow",
  "cash-book",
  "bank-book",
  "cash-bank-summary",
  "ledger",
  "vat-summary",
  "vat-detail",
  "gst-summary",
  "gst-detail",
  "expense-report",
  "stock-summary",
  "branch-pl",
] as const;

// ── Sidebar menu items (for visibility config) ──────────────────
export const SIDEBAR_ITEMS = [
  { group: "General", items: ["Dashboard", "POS Terminal", "Products", "Inventory"] },
  { group: "Sales", items: ["Customers", "Quotations", "Sales Invoices", "Credit Notes", "Customer Payments"] },
  { group: "Purchases", items: ["Suppliers", "Purchase Invoices", "Debit Notes", "Supplier Payments"] },
  { group: "Accounting", items: ["Expenses", "Cash & Bank", "Journal Entries", "Chart of Accounts"] },
  { group: "Reports", items: ["Profit by Items", "Customer Balances", "Supplier Balances", "Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Flow", "Expense Report"] },
] as const;

export const ALL_SIDEBAR_ITEM_NAMES = SIDEBAR_ITEMS.flatMap((g) => g.items);

// ── Setting keys used in the Setting table ─────────────────────
export const SETTING_KEYS = {
  FORM_FIELD_CONFIG: "form_field_config",
  DISABLED_REPORTS: "disabled_reports",
  DISABLED_SIDEBAR_ITEMS: "disabledSidebarItems",
  SIDEBAR_MODE: "sidebar_mode",
  SIDEBAR_SECTION_ORDER: "sidebar_section_order",
  MOBILE_NAV_CONFIG: "mobile_nav_config",
  DEFAULT_LANDING_PAGE: "default_landing_page",
} as const;
