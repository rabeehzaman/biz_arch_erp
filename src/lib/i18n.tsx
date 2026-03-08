"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

type TranslationDict = typeof en;
type Section = keyof TranslationDict;

const translations: Record<string, TranslationDict> = { en, ar };

export type Language = "en" | "ar";

const LOCALIZED_ATTRIBUTES = [
  "placeholder",
  "title",
  "aria-label",
  "aria-placeholder",
  "data-placeholder",
  "alt",
] as const;

const SKIP_TRANSLATION_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "CODE",
  "PRE",
]);

const textNodeOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();

type LiteralTranslationMap = Record<string, string>;
type EntityLabel = {
  bare: string;
  definite: string;
};

function flattenLiteralTranslations(
  englishNode: unknown,
  arabicNode: unknown,
  output: LiteralTranslationMap
): void {
  if (typeof englishNode === "string" && typeof arabicNode === "string") {
    output[englishNode] = arabicNode;
    return;
  }

  if (
    englishNode &&
    arabicNode &&
    typeof englishNode === "object" &&
    typeof arabicNode === "object"
  ) {
    const englishEntries = englishNode as Record<string, unknown>;
    const arabicEntries = arabicNode as Record<string, unknown>;

    for (const key of Object.keys(englishEntries)) {
      flattenLiteralTranslations(
        englishEntries[key],
        arabicEntries[key],
        output
      );
    }
  }
}

const generatedLiteralTranslations = (() => {
  const output: LiteralTranslationMap = {};
  flattenLiteralTranslations(en, ar, output);
  return output;
})();

const extraLiteralTranslations: LiteralTranslationMap = {
  "BizArch ERP": "بيزآرتش ERP",
  "Enter your credentials to access your account":
    "أدخل بيانات الدخول للوصول إلى حسابك",
  "Invalid email or password": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  "An error occurred. Please try again.":
    "حدث خطأ. يرجى المحاولة مرة أخرى.",
  "Password": "كلمة المرور",
  "Enter your password": "أدخل كلمة المرور",
  "Sign In": "تسجيل الدخول",
  "Signing in...": "جارٍ تسجيل الدخول...",
  "Email": "البريد الإلكتروني",
  "Organizations": "المنشآت",
  "Organization": "المنشأة",
  "Manage tenant organizations": "إدارة المنشآت",
  "All Organizations": "كل المنشآت",
  "Create Organization": "إنشاء منشأة",
  "Create User": "إنشاء مستخدم",
  "Create a new user and assign them to an organization.":
    "أنشئ مستخدمًا جديدًا وعيّنه إلى منشأة.",
  "Full Name": "الاسم الكامل",
  "Name and slug are required": "الاسم والمعرّف المختصر مطلوبان",
  "Failed to create organization": "فشل في إنشاء المنشأة",
  "All fields are required": "جميع الحقول مطلوبة",
  "Failed to create user": "فشل في إنشاء المستخدم",
  "Manage accessible menu items for this organization":
    "إدارة عناصر القائمة المتاحة لهذه المنشأة",
  "Configure features and tax settings for this organization":
    "تهيئة الميزات والإعدادات الضريبية لهذه المنشأة",
  "Tools to ensure data integrity for this organization":
    "أدوات لضمان سلامة البيانات لهذه المنشأة",
  "Users belonging to this organization": "المستخدمون التابعون لهذه المنشأة",
  "Irreversible actions for this organization":
    "إجراءات غير قابلة للتراجع لهذه المنشأة",
  "Back to Organizations": "العودة إلى المنشآت",
  "Search pages, records, actions...": "ابحث في الصفحات والسجلات والإجراءات...",
  IMEI: "IMEI",
  "Lookup IMEI": "البحث عن IMEI",
  "Open device info page": "فتح صفحة معلومات الجهاز",
  "Keep typing to complete IMEI": "واصل الكتابة لإكمال IMEI",
  "Calculator": "الآلة الحاسبة",
  "Click to copy result": "انقر لنسخ النتيجة",
  "Recent": "الأخيرة",
  "Clear recent history": "مسح السجل الأخير",
  "Quick Actions": "إجراءات سريعة",
  "Navigation": "التنقل",
  "Reports": "التقارير",
  "Admin": "الإدارة",
  "Searching...": "جارٍ البحث...",
  "Searching records...": "جارٍ البحث في السجلات...",
  "Products": "المنتجات",
  "Customers": "العملاء",
  "Suppliers": "الموردون",
  "Sales Invoices": "فواتير المبيعات",
  "Purchase Invoices": "فواتير المشتريات",
  "Devices": "الأجهزة",
  "Navigate": "تنقل",
  "Select": "اختر",
  "Close": "إغلاق",
  "Expenses": "المصروفات",
  "Track and manage business expenses": "تتبع وإدارة مصروفات الأعمال",
  "New Expense": "مصروف جديد",
  "New Sales Invoice": "فاتورة مبيعات جديدة",
  "New Quotation": "عرض سعر جديد",
  "New Purchase Invoice": "فاتورة مشتريات جديدة",
  "New Credit Note": "إشعار دائن جديد",
  "New Debit Note": "إشعار مدين جديد",
  "New Journal Entry": "قيد يومية جديد",
  "Add Device (IMEI)": "إضافة جهاز (IMEI)",
  "Open POS Terminal": "فتح نقطة البيع",
  "Search expenses...": "ابحث في المصروفات...",
  "No expenses found": "لم يتم العثور على مصروفات",
  "Try a different search term": "جرّب عبارة بحث مختلفة",
  "Create your first expense to get started":
    "أنشئ أول مصروف للبدء",
  "Number": "الرقم",
  "Date": "التاريخ",
  "Description": "الوصف",
  "Supplier": "المورد",
  "Status": "الحالة",
  "Amount": "المبلغ",
  "Name is required": "الاسم مطلوب",
  "A valid price is required": "السعر الصحيح مطلوب",
  "Unit is required": "الوحدة مطلوبة",
  "Failed to save product": "فشل في حفظ الصنف",
  "Product updated successfully": "تم تحديث الصنف بنجاح",
  "Product added successfully": "تمت إضافة الصنف بنجاح",
  "Edit Product": "تعديل الصنف",
  "Add New Product": "إضافة صنف جديد",
  "Update the product details below.": "حدّث بيانات الصنف أدناه.",
  "Fill in the details to add a new product.":
    "أدخل البيانات لإضافة صنف جديد.",
  "Name": "الاسم",
  "Description *": "الوصف *",
  "Price": "السعر",
  "Price *": "السعر *",
  "Unit": "الوحدة",
  "Unit *": "الوحدة *",
  "Barcode": "الباركود",
  "SKU": "رمز الصنف",
  "HSN Code": "رمز HSN",
  "VAT Number (TRN)": "الرقم الضريبي",
  "Invalid VAT Number (TRN). Must be 15 digits starting with 3.":
    "الرقم الضريبي غير صالح. يجب أن يتكون من 15 رقمًا ويبدأ بالرقم 3.",
  "Commercial Registration No.": "رقم السجل التجاري",
  "Tax Invoice": "الفاتورة الضريبية",
  "Simplified Tax Invoice": "الفاتورة الضريبية المبسطة",
  "VAT (15%)": "ضريبة القيمة المضافة (15%)",
  "Saudi VAT": "ضريبة القيمة المضافة السعودية",
  "Loading...": "جارٍ التحميل...",
  "Loading journal entries...": "جارٍ تحميل القيود اليومية...",
  "No journal entries": "لا توجد قيود يومية",
  "Journal entries will appear here once the invoice is posted.":
    "ستظهر القيود اليومية هنا بعد ترحيل الفاتورة.",
  Account: "الحساب",
  Debit: "مدين",
  Credit: "دائن",
  Balance: "الرصيد",
  Phone: "الهاتف",
  Paid: "المدفوع",
  Profit: "الربح",
  Revenue: "الإيرادات",
  COGS: "تكلفة البضاعة المباعة",
  Margin: "الهامش",
  Collected: "المحصّل",
  Outstanding: "المستحق",
  Assets: "الأصول",
  Liabilities: "الالتزامات",
  Equity: "حقوق الملكية",
  Code: "الرمز",
  Inflow: "التدفقات الداخلة",
  Outflow: "التدفقات الخارجة",
  Net: "الصافي",
  Count: "العدد",
  Lots: "الدفعات",
  Global: "عام",
  Apply: "تطبيق",
  Generate: "إنشاء",
  From: "من",
  To: "إلى",
  "As of Date": "حتى تاريخ",
  "From Date": "من تاريخ",
  "To Date": "إلى تاريخ",
  "No transactions found": "لا توجد حركات",
  "No data available": "لا توجد بيانات متاحة",
  "No data for this period": "لا توجد بيانات لهذه الفترة",
  "No Transactions Found": "لم يتم العثور على حركات",
  "Toggle menu": "تبديل القائمة",
  "Search suppliers...": "ابحث في الموردين...",
  "Search customers...": "ابحث في العملاء...",
  "Search products...": "ابحث في المنتجات...",
  "Search journal entries...": "ابحث في القيود اليومية...",
  "Search branches...": "ابحث في الفروع...",
  "Search warehouses...": "ابحث في المستودعات...",
  "Search transfers...": "ابحث في التحويلات...",
  "Search account...": "ابحث في الحسابات...",
  "Search supplier...": "ابحث عن مورد...",
  "Search IMEI, brand, model...": "ابحث برقم IMEI أو العلامة التجارية أو الطراز...",
  "No suppliers found": "لم يتم العثور على موردين",
  "No customers found": "لم يتم العثور على عملاء",
  "No products found": "لم يتم العثور على منتجات",
  "No stock found": "لم يتم العثور على مخزون",
  "No branches found": "لم يتم العثور على فروع",
  "No warehouses found": "لم يتم العثور على مستودعات",
  "No stock transfers found": "لم يتم العثور على تحويلات مخزون",
  "No journal entries found": "لم يتم العثور على قيود يومية",
  "No accounts found": "لم يتم العثور على حسابات",
  "No devices found": "لم يتم العثور على أجهزة",
  "No access assignments": "لا توجد صلاحيات وصول",
  "No users found for this organization.":
    "لا يوجد مستخدمون لهذه المنشأة.",
  "No units found": "لم يتم العثور على وحدات",
  "No units found. Click + to add one.":
    "لم يتم العثور على وحدات. اضغط + لإضافة وحدة.",
  "No suppliers found. Click + to add one.":
    "لم يتم العثور على موردين. اضغط + لإضافة مورد.",
  "No customers found. Click + to add one.":
    "لم يتم العثور على عملاء. اضغط + لإضافة عميل.",
  "No products found. Click + to add one.":
    "لم يتم العثور على منتجات. اضغط + لإضافة صنف.",
  "No IMEI-tracked products found.":
    "لم يتم العثور على أصناف متتبعة برقم IMEI.",
  "No IMEI-tracked products found. Create one from the Products page first.":
    "لم يتم العثور على أصناف متتبعة برقم IMEI. أنشئ صنفًا من صفحة المنتجات أولاً.",
  "Create your first branch": "أنشئ أول فرع",
  "Create your first warehouse": "أنشئ أول مستودع",
  "Create your first stock transfer": "أنشئ أول تحويل مخزني",
  "Create your first journal entry to get started":
    "أنشئ أول قيد يومية للبدء",
  "Create a new sales return": "إنشاء إشعار دائن جديد",
  "Create a new purchase return": "إنشاء إشعار مدين جديد",
  "Create a new quotation for a customer":
    "إنشاء عرض سعر جديد لعميل",
  "Create a new invoice for a customer": "إنشاء فاتورة جديدة لعميل",
  "Create a manual journal entry": "إنشاء قيد يومية يدوي",
  "Record a purchase from a supplier": "تسجيل عملية شراء من مورد",
  "Record Payment": "تسجيل دفعة",
  "Invoice Details": "تفاصيل الفاتورة",
  "Purchase Details": "تفاصيل الشراء",
  "Purchase Items": "أصناف الشراء",
  "Line Items": "بنود الفاتورة",
  "Additional Information": "معلومات إضافية",
  Summary: "الملخص",
  "Stock Update": "تحديث المخزون",
  Customer: "العميل",
  Product: "الصنف",
  "Product *": "الصنف *",
  "Customer *": "العميل *",
  "Supplier *": "المورد *",
  Quantity: "الكمية",
  "Quantity *": "الكمية *",
  "Issue Date *": "تاريخ الإصدار *",
  "Due Date": "تاريخ الاستحقاق",
  "Due Date *": "تاريخ الاستحقاق *",
  "Purchase Date": "تاريخ الشراء",
  "Purchase Date *": "تاريخ الشراء *",
  "Payment Due Date": "تاريخ استحقاق السداد",
  "Payment Due Date *": "تاريخ استحقاق السداد *",
  "Payment Type": "نوع الدفع",
  "Payment Type *": "نوع الدفع *",
  "Select type": "اختر النوع",
  "Supplier Invoice Ref": "مرجع فاتورة المورد",
  "Supplier's invoice number": "رقم فاتورة المورد",
  "Unit Cost": "تكلفة الوحدة",
  "Unit Cost *": "تكلفة الوحدة *",
  "Unit Price *": "سعر الوحدة *",
  "Gross Amount": "إجمالي المبلغ",
  "Net Amount": "صافي المبلغ",
  "Line Total": "إجمالي السطر",
  "Discount %": "نسبة الخصم %",
  "Disc %": "نسبة الخصم %",
  "GST %": "ضريبة القيمة المضافة %",
  "VAT %": "ضريبة القيمة المضافة %",
  "Terms & Conditions": "الشروط والأحكام",
  "Notes to the customer...": "ملاحظات للعميل...",
  "Payment terms...": "شروط السداد...",
  "Prices include tax": "الأسعار تشمل الضريبة",
  Subtotal: "الإجمالي الفرعي",
  "Amount Paid": "المبلغ المدفوع",
  "Balance Due": "الرصيد المستحق",
  Invoice: "الفاتورة",
  Journal: "القيود اليومية",
  "All Expenses": "جميع المصروفات",
  "Total Expenses": "إجمالي المصروفات",
  "Number of Expenses": "عدد المصروفات",
  User: "المستخدم",
  Branch: "الفرع",
  Warehouse: "المستودع",
  Default: "افتراضي",
  Actions: "الإجراءات",
  All: "الكل",
  "Grant Warehouse Access": "منح صلاحية الوصول إلى المستودع",
  "Access granted": "تم منح الصلاحية",
  "Access revoked": "تم سحب الصلاحية",
  "Failed to load user access data": "فشل في تحميل بيانات الصلاحيات",
  "User and warehouse are required": "المستخدم والمستودع مطلوبان",
  "Failed to grant access": "فشل في منح الصلاحية",
  "Failed to revoke access": "فشل في سحب الصلاحية",
  "Select user": "اختر المستخدم",
  "Select warehouse": "اختر المستودع",
  "Open Box": "مفتوح العلبة",
  Refurbished: "مجدد",
  Brand: "العلامة التجارية",
  Model: "الطراز",
  Color: "اللون",
  Storage: "السعة التخزينية",
  RAM: "الذاكرة",
  "Track by IMEI (individual device tracking)":
    "تتبع برقم IMEI (تتبع كل جهاز بشكل منفصل)",
  "Service product (no inventory tracking)":
    "صنف خدمي (بدون تتبع للمخزون)",
  "Optional product code": "رمز صنف اختياري",
  "Scan barcode": "امسح الباركود",
  "Any additional notes...": "أي ملاحظات إضافية...",
  "Scan IMEI with camera": "مسح IMEI بالكاميرا",
  "Payment Method": "طريقة الدفع",
  Reference: "المرجع",
  "Transaction ID, check #...": "رقم العملية أو رقم الشيك...",
  "Bank Transfer": "تحويل بنكي",
  Check: "شيك",
  "Credit Card": "بطاقة ائتمان",
  Other: "أخرى",
  "Tax Invoice — ZATCA Phase 1": "الفاتورة الضريبية — المرحلة الأولى من زاتكا",
  "Simplified Tax Invoice — ZATCA Phase 1":
    "الفاتورة الضريبية المبسطة — المرحلة الأولى من زاتكا",
  "No organizations found": "لم يتم العثور على منشآت",
  "No suppliers found.": "لم يتم العثور على موردين.",
  "No customers found.": "لم يتم العثور على عملاء.",
  "No camera found on this device.": "لم يتم العثور على كاميرا في هذا الجهاز.",
  "No journal entries found for this period":
    "لم يتم العثور على قيود يومية لهذه الفترة",
  "Balance Sheet": "الميزانية العمومية",
  "Financial position as of a date": "المركز المالي حتى تاريخ معين",
  "Assets = Liabilities + Equity": "الأصول = الالتزامات + حقوق الملكية",
  "Not Balanced": "غير متوازنة",
  "Retained Earnings (computed)": "الأرباح المبقاة (محسوبة)",
  "Total Equity": "إجمالي حقوق الملكية",
  "Total Assets": "إجمالي الأصول",
  "Total Liabilities + Equity": "إجمالي الالتزامات + حقوق الملكية",
  "Profit & Loss": "الأرباح والخسائر",
  "Income statement for a period": "قائمة الدخل لفترة محددة",
  "Total Revenue": "إجمالي الإيرادات",
  "Net Income": "صافي الدخل",
  "Cash Flow": "التدفقات النقدية",
  "Cash inflows and outflows": "التدفقات النقدية الداخلة والخارجة",
  "Total Inflow": "إجمالي التدفقات الداخلة",
  "Total Outflow": "إجمالي التدفقات الخارجة",
  "Net Cash Flow": "صافي التدفقات النقدية",
  "By Category": "حسب الفئة",
  "By Supplier": "حسب المورد",
  "Account Balances": "أرصدة الحسابات",
  "GL Reconciliation (Cash Accounts 1100/1200)":
    "مطابقة الأستاذ العام (حسابات النقد 1100/1200)",
  "GL Balance (Journal Entries)": "رصيد الأستاذ العام (القيود اليومية)",
  "Sub-ledger Balance (Cash Book)": "رصيد الأستاذ المساعد (دفتر النقدية)",
  "Expense Report": "تقرير المصروفات",
  "Expenses by category and supplier": "المصروفات حسب الفئة والمورد",
  "Unified Ledger": "الأستاذ الموحد",
  "View detailed transactions for any account, customer, or supplier":
    "عرض الحركات التفصيلية لأي حساب أو عميل أو مورد",
  "Select Ledger": "اختر الأستاذ",
  "Ledger Type": "نوع الأستاذ",
  "General Account (Asset/Expense/etc)": "حساب عام (أصل/مصروف/إلخ)",
  "Customer Ledger": "أستاذ العميل",
  "Supplier Ledger": "أستاذ المورد",
  "Entity / Account": "الجهة / الحساب",
  "Ledger Statement": "كشف الأستاذ",
  "Trial Balance": "ميزان المراجعة",
  "Summary of all account balances": "ملخص جميع أرصدة الحسابات",
  Balanced: "متوازن",
  Unbalanced: "غير متوازن",
  "Stock Summary": "ملخص المخزون",
  "Current inventory levels by product and warehouse":
    "مستويات المخزون الحالية حسب الصنف والمستودع",
  "Product-Warehouse Combos": "تركيبات الصنف والمستودع",
  "Total Stock Value": "إجمالي قيمة المخزون",
  "Low Stock Items": "الأصناف منخفضة المخزون",
  "All Branches": "جميع الفروع",
  "All Warehouses": "جميع المستودعات",
  "Qty in Stock": "الكمية في المخزون",
  "Avg Cost": "متوسط التكلفة",
  "Total Value": "إجمالي القيمة",
  "Customer Balances": "أرصدة العملاء",
  "View customer balances - positive amounts are receivables (owed to you), negative amounts in green are advances (paid in advance)":
    "عرض أرصدة العملاء - المبالغ الموجبة تمثل مستحقات لكم، والمبالغ السالبة باللون الأخضر تمثل دفعات مقدمة.",
  "Total Customers": "إجمالي العملاء",
  "Total Receivable": "إجمالي المستحق",
  "Total Advances": "إجمالي الدفعات المقدمة",
  "Net Balance": "صافي الرصيد",
  "AR Reconciliation": "مطابقة الذمم المدينة",
  Reconciled: "مطابق",
  "Balance Details": "تفاصيل الرصيد",
  "total outstanding": "إجمالي المستحق",
  Active: "نشط",
  Inactive: "غير نشط",
  Total: "الإجمالي",
  "Try adjusting your search": "جرّب تعديل البحث",
  "No suppliers have been added yet": "لم تتم إضافة موردين بعد",
  "No customers have been added yet": "لم تتم إضافة عملاء بعد",
  "Supplier Balances": "أرصدة الموردين",
  "View outstanding supplier balances (Accounts Payable)":
    "عرض أرصدة الموردين المستحقة (الذمم الدائنة)",
  "Total Suppliers": "إجمالي الموردين",
  "Active Suppliers": "الموردون النشطون",
  "Total Payable": "إجمالي المستحق الدفع",
  "With Balance": "ذات رصيد",
  "AP Reconciliation": "مطابقة الذمم الدائنة",
  "suppliers owed money": "موردون مستحق لهم مبالغ",
  "Branch P&L Report": "تقرير أرباح وخسائر الفروع",
  "Multi-Branch Not Enabled": "تعدد الفروع غير مفعّل",
  "Revenue, COGS and gross profit breakdown by branch (expand for warehouse detail)":
    "تفصيل الإيرادات وتكلفة البضاعة المباعة وإجمالي الربح حسب الفرع (وسّع لعرض تفاصيل المستودع)",
  "Total COGS": "إجمالي تكلفة البضاعة المباعة",
  "Gross Profit": "إجمالي الربح",
  "Overall Margin": "الهامش الإجمالي",
  "Click a branch row to expand warehouse details":
    "اضغط على صف الفرع لعرض تفاصيل المستودعات",
  "Branch / Warehouse": "الفرع / المستودع",
  Invoices: "الفواتير",
  Unassigned: "غير معيّن",
  unassigned: "غير معيّن",
  "Profit by Invoice": "الربح حسب الفاتورة",
  "Invoice #": "رقم الفاتورة",
  "Total Qty": "إجمالي الكمية",
  "Profit %": "نسبة الربح %",
  "Supplier Statement": "كشف حساب المورد",
  "TOTAL PAYABLE": "إجمالي المستحق الدفع",
  "TOTAL PAID": "إجمالي المدفوع",
  Payable: "المستحق الدفع",
  "✓ Reconciled": "✓ مطابق",
  "⚠ Difference": "⚠ فرق",
  "Create Transfer": "إنشاء تحويل مخزني",
  "Create Account": "إنشاء حساب",
  "Add Unit": "إضافة وحدة",
  "Update Product": "تحديث الصنف",
  "Update Customer": "تحديث العميل",
  "Update Supplier": "تحديث المورد",
  "Update Invoice": "تحديث الفاتورة",
  "Update Purchase Invoice": "تحديث فاتورة المشتريات",
  "Update Quotation": "تحديث عرض السعر",
  "Update Journal Entry": "تحديث القيد اليومي",
  "Create Invoice": "إنشاء فاتورة",
  "Create Purchase Invoice": "إنشاء فاتورة مشتريات",
  "Create Quotation": "إنشاء عرض سعر",
  "Create Credit Note": "إنشاء إشعار دائن",
  "Create Debit Note": "إنشاء إشعار مدين",
  "Create Expense": "إنشاء مصروف",
  "Creating...": "جارٍ الإنشاء...",
  "Updating...": "جارٍ التحديث...",
  "Adding...": "جارٍ الإضافة...",
  "Edit Customer": "تعديل العميل",
  "Edit Supplier": "تعديل المورد",
  "Edit Device": "تعديل الجهاز",
  "Add Device": "إضافة جهاز",
  "Add New Customer": "إضافة عميل جديد",
  "Add New Supplier": "إضافة مورد جديد",
  "Add New Unit": "إضافة وحدة جديدة",
  "Add New Conversion Rule": "إضافة قاعدة تحويل جديدة",
  "Edit Unit": "تعديل الوحدة",
  "Edit Branch": "تعديل الفرع",
  "Add Branch": "إضافة فرع",
  "Edit Warehouse": "تعديل المستودع",
  "Add Warehouse": "إضافة مستودع",
  "Edit Quotation": "تعديل عرض السعر",
  "Edit Invoice": "تعديل الفاتورة",
  "Edit Purchase Invoice": "تعديل فاتورة المشتريات",
  "Edit Journal Entry": "تعديل القيد اليومي",
  "Edit Credit Note": "تعديل الإشعار الدائن",
  "Search purchases...": "ابحث في المشتريات...",
  "No invoices found": "لم يتم العثور على فواتير",
  "Create your first journal entry": "أنشئ أول قيد يومية",
  "Double-entry accounting records": "سجلات المحاسبة بالقيد المزدوج",
  "Entry Details": "تفاصيل القيد",
  "Description of this journal entry": "وصف هذا القيد اليومي",
  Lines: "السطور",
  Source: "المصدر",
  "Current Balance": "الرصيد الحالي",
  "Transaction History": "سجل الحركات",
  "No transactions yet": "لا توجد حركات بعد",
  Type: "النوع",
  "Date *": "التاريخ *",
  "User *": "المستخدم *",
  "Warehouse *": "المستودع *",
  "Invoice No": "رقم الفاتورة",
  "Invoice Date": "تاريخ الفاتورة",
  Payment: "الدفع",
  "Bill To": "الفاتورة إلى",
  Seller: "البائع",
  Buyer: "المشتري",
  "Salesperson": "مندوب المبيعات",
  "Taxable Value": "القيمة الخاضعة للضريبة",
  "VAT Amount": "مبلغ ضريبة القيمة المضافة",
  "Grand Total": "الإجمالي الكلي",
  "ZATCA QR Code": "رمز الاستجابة السريعة لزاتكا",
  Declaration: "إقرار",
  "Authorised Signatory": "المفوّض بالتوقيع",
  "Customer Statement": "كشف حساب العميل",
  "OPENING BALANCE": "الرصيد الافتتاحي",
  "TOTAL RECEIVABLE": "إجمالي المستحق",
  "TOTAL RECEIVED": "إجمالي المحصل",
  "CLOSING BALANCE": "الرصيد الختامي",
  Receivable: "المستحق",
  Received: "المحصّل",
  TOTALS: "الإجماليات",
  "Arabıc Company Name": "اسم الشركة بالعربية",
  "Arabic Company Name": "اسم الشركة بالعربية",
  "Arabic Address": "العنوان بالعربية",
  "Arabic City": "المدينة بالعربية",
  "Enable GST": "تفعيل ضريبة السلع والخدمات",
  "Enable E-Invoicing": "تفعيل الفوترة الإلكترونية",
  "Enable Saudi E-Invoice (ZATCA)": "تفعيل الفاتورة الإلكترونية السعودية (زاتكا)",
  "Tax-Inclusive Pricing": "تسعير شامل للضريبة",
  "Enable Alternate Units": "تفعيل الوحدات البديلة",
  "Enable Multi-Branch": "تفعيل تعدد الفروع",
  "Enable Mobile Shop": "تفعيل متجر الأجهزة",
  "Barcode Prefix": "بادئة الباركود",
  "Product Code Length": "طول رمز الصنف",
  "Weight Digits": "خانات الوزن",
  "Decimal Places": "المنازل العشرية",
  "Barcode preview": "معاينة الباركود",
  "Invoice PDF Format": "تنسيق PDF للفواتير",
  "PDF Header / Footer Images": "صور ترويسة وتذييل ملف PDF",
  "Header Image URL": "رابط صورة الترويسة",
  "Footer Image URL": "رابط صورة التذييل",
  "Company Logo Image URL": "رابط صورة شعار الشركة",
  "Logo Image URL": "رابط صورة الشعار",
  "Brand Color": "لون العلامة التجارية",
  "Recalculate FIFO Inventory": "إعادة احتساب مخزون FIFO",
  "Reset Transactions Only": "إعادة تعيين الحركات فقط",
  "Complete Reset": "إعادة تعيين كاملة",
  "Delete Organization": "حذف المنشأة",
  "Are you absolutely sure?": "هل أنت متأكد تمامًا؟",
  Cancel: "إلغاء",
  "Reset Transactions?": "إعادة تعيين الحركات؟",
  "Complete Reset?": "إعادة تعيين كاملة؟",
  "Recalculate FIFO Inventory?": "إعادة احتساب مخزون FIFO؟",
  "Reset Password": "إعادة تعيين كلمة المرور",
  "New Password": "كلمة المرور الجديدة",
  "Confirm Password": "تأكيد كلمة المرور",
  "Minimum 6 characters": "6 أحرف على الأقل",
  "Re-enter password": "أعد إدخال كلمة المرور",
  "Manage settings and configuration for this organization":
    "إدارة إعدادات وتكوين هذه المنشأة",
  Created: "تاريخ الإنشاء",
  Users: "المستخدمون",
  "Menu Configuration": "تهيئة القائمة",
  "Control which sidebar items are visible":
    "التحكم في عناصر القائمة الجانبية الظاهرة",
  Configure: "تهيئة",
  English: "الإنجليزية",
  "State (auto-derived)": "المنطقة (تُستخرج تلقائيًا)",
  "Direct (Real-time)": "مباشر (لحظي)",
  "Clearing Account": "حساب وسيط",
  "A5 Landscape (Default)": "A5 أفقي (افتراضي)",
  "A4 Portrait (GST)": "A4 عمودي (GST)",
  "A4 Portrait (GST 2)": "A4 عمودي (GST 2)",
  "A4 Modern Portfolio": "A4 حديث",
  "A4 Portrait (VAT - Arabic)": "A4 عمودي (ضريبة القيمة المضافة - عربي)",
  "A4 Bilingual (Arabic-English)": "A4 ثنائي اللغة (عربي-إنجليزي)",
  "https://example.com/header.png": "https://example.com/header.png",
  "https://example.com/footer.png": "https://example.com/footer.png",
  "https://example.com/logo.png": "https://example.com/logo.png",
  "Settings saved successfully.": "تم حفظ الإعدادات بنجاح.",
  "Failed to save organization settings": "فشل في حفظ إعدادات المنشأة",
  "GSTIN is required when GST is enabled":
    "رقم GSTIN مطلوب عند تفعيل ضريبة السلع والخدمات",
  "Invalid GSTIN format": "صيغة رقم GSTIN غير صالحة",
  "GST must be enabled before enabling e-invoicing":
    "يجب تفعيل GST قبل تفعيل الفوترة الإلكترونية",
  "Cannot enable both GST and Saudi E-Invoice simultaneously":
    "لا يمكن تفعيل GST والفاتورة الإلكترونية السعودية في الوقت نفسه",
  "Direct:": "مباشر:",
  "Clearing Account:": "الحساب الوسيط:",
  "POS payments go directly to Cash/Bank in real-time.":
    "تُرحل دفعات نقطة البيع مباشرة إلى الصندوق أو البنك بشكل لحظي.",
  "Payments are held in \"POS Undeposited Funds\" until session close, when they are transferred to a selected account.":
    "تُحتجز المدفوعات في \"أموال نقطة البيع غير المودعة\" حتى إقفال الجلسة، ثم تُرحل إلى الحساب المحدد.",
  "Update invoice details": "تحديث تفاصيل الفاتورة",
  "Update purchase invoice details": "تحديث تفاصيل فاتورة المشتريات",
  "Debit Note Details": "تفاصيل الإشعار المدين",
  Items: "الأصناف",
  "Reason for Return": "سبب المرتجع",
  "Leave blank for standalone debit note":
    "اتركه فارغًا لإشعار مدين مستقل",
  "e.g., Defective items": "مثال: أصناف تالفة",
  Qty: "الكمية",
  "Additional notes...": "ملاحظات إضافية...",
  "Subtotal:": "الإجمالي الفرعي:",
  "GST:": "الضريبة:",
  "Total:": "الإجمالي:",
  "Please select a supplier": "يرجى اختيار المورد",
  "Please add at least one item": "يرجى إضافة صنف واحد على الأقل",
  "Debit note created successfully": "تم إنشاء الإشعار المدين بنجاح",
  "Please add at least one product to the purchase invoice":
    "يرجى إضافة صنف واحد على الأقل إلى فاتورة المشتريات",
  "Please select a branch and warehouse":
    "يرجى اختيار الفرع والمستودع",
  "Purchase invoice created and stock updated":
    "تم إنشاء فاتورة المشتريات وتحديث المخزون",
  "Failed to create purchase invoice": "فشل في إنشاء فاتورة المشتريات",
  "Please add at least one product to the invoice":
    "يرجى إضافة صنف واحد على الأقل إلى الفاتورة",
  "Invoice updated": "تم تحديث الفاتورة",
  "Failed to update invoice": "فشل في تحديث الفاتورة",
  "Purchase invoice updated": "تم تحديث فاتورة المشتريات",
  "Failed to update purchase invoice": "فشل في تحديث فاتورة المشتريات",
  "Purchase invoice not found": "لم يتم العثور على فاتورة المشتريات",
  "Failed to load purchase invoice": "فشل في تحميل فاتورة المشتريات",
  "Payment recorded successfully": "تم تسجيل الدفعة بنجاح",
  "Status updated": "تم تحديث الحالة",
  "Failed to update status": "فشل في تحديث الحالة",
  "Failed to download PDF": "فشل في تنزيل ملف PDF",
  "PDF downloaded successfully": "تم تنزيل ملف PDF بنجاح",
  "Failed to print invoice": "فشل في طباعة الفاتورة",
  "Failed to load journal entries": "فشل في تحميل القيود اليومية",
  "Journal entry deleted": "تم حذف القيد اليومي",
  "Failed to load accounts": "فشل في تحميل الحسابات",
  "Total debits must equal total credits":
    "يجب أن يتساوى إجمالي المدين مع إجمالي الدائن",
  "At least 2 lines with accounts and amounts are required":
    "مطلوب سطران على الأقل يحتويان على حسابات ومبالغ",
  "Journal entry created": "تم إنشاء القيد اليومي",
  "Failed to load account": "فشل في تحميل الحساب",
  "Account not found": "لم يتم العثور على الحساب",
  "Failed to load chart of accounts": "فشل في تحميل دليل الحسابات",
  "Account updated": "تم تحديث الحساب",
  "Account created": "تم إنشاء الحساب",
  "Account deleted": "تم حذف الحساب",
  "e.g. 5210": "مثال: 5210",
  "e.g. Rent": "مثال: الإيجار",
};

const literalTranslations: LiteralTranslationMap = {
  ...generatedLiteralTranslations,
  ...extraLiteralTranslations,
};

const exactEntityLabels: Record<string, EntityLabel> = {
  customer: { bare: "عميل", definite: "العميل" },
  supplier: { bare: "مورد", definite: "المورد" },
  product: { bare: "صنف", definite: "الصنف" },
  invoice: { bare: "فاتورة", definite: "الفاتورة" },
  quotation: { bare: "عرض سعر", definite: "عرض السعر" },
  "purchase invoice": { bare: "فاتورة مشتريات", definite: "فاتورة المشتريات" },
  expense: { bare: "مصروف", definite: "المصروف" },
  "journal entry": { bare: "قيد يومية", definite: "القيد اليومي" },
  branch: { bare: "فرع", definite: "الفرع" },
  warehouse: { bare: "مستودع", definite: "المستودع" },
  unit: { bare: "وحدة", definite: "الوحدة" },
  device: { bare: "جهاز", definite: "الجهاز" },
  "credit note": { bare: "إشعار دائن", definite: "الإشعار الدائن" },
  "debit note": { bare: "إشعار مدين", definite: "الإشعار المدين" },
  account: { bare: "حساب", definite: "الحساب" },
  organization: { bare: "منشأة", definite: "المنشأة" },
  user: { bare: "مستخدم", definite: "المستخدم" },
};

function normalizeLanguage(value?: string | null): Language | null {
  if (value === "ar" || value === "en") return value;
  return null;
}

function getCookieLanguage(): Language | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    /(?:^|;\s*)preferred-language=(ar|en)(?:;|$)/
  );
  return normalizeLanguage(match?.[1] ?? null);
}

function getStoredLanguage(): Language | null {
  if (typeof window === "undefined") return null;

  const localStorageValue = normalizeLanguage(
    window.localStorage.getItem("preferred-language")
  );
  if (localStorageValue) return localStorageValue;

  return getCookieLanguage();
}

export function persistLanguagePreference(lang: Language): void {
  if (typeof document !== "undefined") {
    document.cookie = `preferred-language=${lang}; path=/; max-age=31536000; samesite=lax`;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("preferred-language", lang);
  }
}

export function getDirection(lang: Language): "ltr" | "rtl" {
  return lang === "ar" ? "rtl" : "ltr";
}

export function getLocale(lang: Language): string {
  return lang === "ar" ? "ar-SA" : "en";
}

export function formatCurrencyLocalized(
  amount: number,
  lang: Language,
  currency = "INR"
): string {
  const locale =
    lang === "ar" ? "ar-SA" : currency === "SAR" ? "en-US" : "en-IN";
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getCurrencySymbol(
  lang: Language,
  currency = "INR"
): string {
  if (currency === "SAR") return lang === "ar" ? "ر.س" : "SAR";
  return "₹";
}

function translateLiteralPattern(text: string): string | null {
  const exact = literalTranslations[text];
  if (exact) return exact;

  if (text.endsWith(" *")) {
    const translated = translateLiteralPattern(text.slice(0, -2));
    if (translated) return `${translated} *`;
  }

  if (text.endsWith(":")) {
    const translated = translateLiteralPattern(text.slice(0, -1));
    if (translated) return `${translated}:`;
  }

  const quotedResultsMatch = text.match(/^No results found for "(.+)"$/);
  if (quotedResultsMatch) {
    return `لم يتم العثور على نتائج لـ "${quotedResultsMatch[1]}"`;
  }

  const lookupImeiMatch = text.match(/^Lookup IMEI:\s*(.+)$/);
  if (lookupImeiMatch) {
    return `البحث عن IMEI: ${lookupImeiMatch[1]}`;
  }

  const completeImeiMatch = text.match(
    /^Keep typing to complete IMEI \((.+)\)$/
  );
  if (completeImeiMatch) {
    return `واصل الكتابة لإكمال IMEI (${completeImeiMatch[1]})`;
  }

  const copiedMatch = text.match(/^Copied (.+) to clipboard$/);
  if (copiedMatch) {
    return `تم نسخ ${copiedMatch[1]} إلى الحافظة`;
  }

  const offByMatch = text.match(/^Off by (.+)$/);
  if (offByMatch) {
    return `بفارق ${offByMatch[1]}`;
  }

  const customersCountMatch = text.match(/^(\d+)\s+customers$/i);
  if (customersCountMatch) {
    return `${customersCountMatch[1]} عميل`;
  }

  const userCreatedMatch = text.match(/^User "(.+)" created successfully!$/);
  if (userCreatedMatch) {
    return `تم إنشاء المستخدم "${userCreatedMatch[1]}" بنجاح!`;
  }

  const skuMatch = text.match(/^SKU:\s*(.+)$/);
  if (skuMatch) {
    return `رمز الصنف: ${skuMatch[1]}`;
  }

  const normalized = text.toLowerCase();
  const entity = exactEntityLabels[normalized];

  if (entity) {
    return entity.definite;
  }

  const failedToSaveMatch = normalized.match(/^failed to save (.+)$/);
  if (failedToSaveMatch) {
    const noun = exactEntityLabels[failedToSaveMatch[1]];
    if (noun) return `فشل في حفظ ${noun.definite}`;
  }

  const updatedSuccessfullyMatch = normalized.match(/^(.+) updated successfully$/);
  if (updatedSuccessfullyMatch) {
    const noun = exactEntityLabels[updatedSuccessfullyMatch[1]];
    if (noun) return `تم تحديث ${noun.definite} بنجاح`;
  }

  const addedSuccessfullyMatch = normalized.match(/^(.+) added successfully$/);
  if (addedSuccessfullyMatch) {
    const noun = exactEntityLabels[addedSuccessfullyMatch[1]];
    if (noun) return `تمت إضافة ${noun.definite} بنجاح`;
  }

  const editMatch = normalized.match(/^edit (.+)$/);
  if (editMatch) {
    const noun = exactEntityLabels[editMatch[1]];
    if (noun) return `تعديل ${noun.definite}`;
  }

  const addNewMatch = normalized.match(/^add new (.+)$/);
  if (addNewMatch) {
    const noun = exactEntityLabels[addNewMatch[1]];
    if (noun) return `إضافة ${noun.bare} جديد`;
  }

  const addMatch = normalized.match(/^add (.+)$/);
  if (addMatch) {
    const noun = exactEntityLabels[addMatch[1]];
    if (noun) return `إضافة ${noun.bare}`;
  }

  const updateMatch = normalized.match(/^update (.+)$/);
  if (updateMatch) {
    const noun = exactEntityLabels[updateMatch[1]];
    if (noun) return `تحديث ${noun.definite}`;
  }

  const createMatch = normalized.match(/^create (.+)$/);
  if (createMatch) {
    const noun = exactEntityLabels[createMatch[1]];
    if (noun) return `إنشاء ${noun.bare}`;
  }

  const searchMatch = normalized.match(/^search (.+)\.\.\.$/);
  if (searchMatch) {
    const translatedTarget = translateLiteral(searchMatch[1], "ar");
    if (translatedTarget !== searchMatch[1]) {
      return `ابحث في ${translatedTarget}...`;
    }
  }

  return null;
}

export function translateLiteral(
  text: string,
  lang: Language = "en"
): string {
  if (lang !== "ar") return text;

  const leadingWhitespace = text.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = text.match(/\s*$/)?.[0] ?? "";
  const core = text.trim();

  if (!core) return text;

  const translated = translateLiteralPattern(core);
  if (!translated) return text;

  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
}

export function translate(key: string, lang: Language = "en"): string {
  const dict = translations[lang] || translations.en;
  const parts = key.split(".");

  let result: unknown = dict;
  for (const part of parts) {
    result = (result as Record<string, unknown> | undefined)?.[part];
    if (result === undefined) break;
  }

  if (typeof result === "string") return result;

  if (lang !== "en") {
    let fallback: unknown = translations.en;
    for (const part of parts) {
      fallback = (fallback as Record<string, unknown> | undefined)?.[part];
      if (fallback === undefined) break;
    }
    if (typeof fallback === "string") return fallback;
  }

  return key;
}

export function getSection<S extends Section>(
  section: S,
  lang: Language = "en"
): TranslationDict[S] {
  const dict = translations[lang] || translations.en;
  return dict[section] ?? translations.en[section];
}

function shouldSkipTextNode(node: Text): boolean {
  const parentElement = node.parentElement;
  if (!parentElement) return true;

  if (SKIP_TRANSLATION_TAGS.has(parentElement.tagName)) return true;

  if (
    parentElement.closest("[data-no-auto-translate='true']") ||
    parentElement.closest("[contenteditable='true']")
  ) {
    return true;
  }

  return false;
}

function localizeTextNode(node: Text, lang: Language): void {
  if (shouldSkipTextNode(node)) return;

  const currentValue = node.nodeValue ?? "";
  const originalValue = textNodeOriginals.get(node) ?? currentValue;

  if (!textNodeOriginals.has(node)) {
    textNodeOriginals.set(node, currentValue);
  }

  const nextValue =
    lang === "ar" ? translateLiteral(originalValue, lang) : originalValue;

  if (nextValue !== currentValue) {
    node.nodeValue = nextValue;
  }
}

function localizeElementAttributes(element: Element, lang: Language): void {
  if (element.closest("[data-no-auto-translate='true']")) return;

  let originals = attributeOriginals.get(element);
  if (!originals) {
    originals = new Map<string, string>();
    attributeOriginals.set(element, originals);
  }

  for (const attribute of LOCALIZED_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;

    const currentValue = element.getAttribute(attribute) ?? "";
    const originalValue = originals.get(attribute) ?? currentValue;

    if (!originals.has(attribute)) {
      originals.set(attribute, currentValue);
    }

    const nextValue =
      lang === "ar" ? translateLiteral(originalValue, lang) : originalValue;

    if (nextValue !== currentValue) {
      element.setAttribute(attribute, nextValue);
    }
  }
}

function localizeNode(node: Node, lang: Language): void {
  if (node.nodeType === Node.TEXT_NODE) {
    localizeTextNode(node as Text, lang);
    return;
  }

  if (!(node instanceof Element)) return;

  localizeElementAttributes(node, lang);

  const textWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let currentTextNode = textWalker.nextNode();
  while (currentTextNode) {
    localizeTextNode(currentTextNode as Text, lang);
    currentTextNode = textWalker.nextNode();
  }

  const elements = node.querySelectorAll("*");
  for (const element of elements) {
    localizeElementAttributes(element, lang);
  }
}

function applyDocumentLanguage(lang: Language): void {
  if (typeof document === "undefined") return;

  const direction = getDirection(lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = direction;
  document.body.dir = direction;
}

interface LanguageContextValue {
  lang: Language;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
  tt: (text: string) => string;
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  dir: "ltr",
  t: (key: string) => translate(key, "en"),
  tt: (text: string) => text,
  isRTL: false,
  setLanguage: () => undefined,
});

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: string;
}) {
  const { data: session } = useSession();
  const sessionLanguage = normalizeLanguage(
    (session?.user as { language?: string } | undefined)?.language
  );
  const [overrideLang, setOverrideLang] = useState<Language | null>(null);

  const lang =
    overrideLang ??
    sessionLanguage ??
    normalizeLanguage(initialLang) ??
    (typeof window !== "undefined" ? getStoredLanguage() : null) ??
    "en";

  useEffect(() => {
    persistLanguagePreference(lang);
    applyDocumentLanguage(lang);
    localizeNode(document.body, lang);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target instanceof Text) {
          localizeTextNode(mutation.target, lang);
          continue;
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          localizeElementAttributes(mutation.target, lang);
        }

        for (const addedNode of mutation.addedNodes) {
          localizeNode(addedNode, lang);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...LOCALIZED_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: getDirection(lang),
      t: (key: string) => translate(key, lang),
      tt: (text: string) => translateLiteral(text, lang),
      isRTL: lang === "ar",
      setLanguage: (nextLang: Language) => {
        persistLanguagePreference(nextLang);
        setOverrideLang(nextLang);
      },
    }),
    [lang]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
