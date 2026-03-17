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
import { translate as _translate, type Language as _Language } from "@/lib/i18n-translate";
// Re-export server-safe translate + Language so existing client imports keep working
export { translate, type Language } from "@/lib/i18n-translate";

type TranslationDict = typeof en;
type Section = keyof TranslationDict;
// Local aliases for use within this file
type Language = _Language;
const translate = _translate;

const translations: Record<string, TranslationDict> = { en, ar };

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

const SHORT_MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const LONG_MONTH_INDEX: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

function formatArabicDate(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("ar-SA", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function translateEnglishDateLiteral(text: string): string | null {
  const shortDateMatch = text.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/);
  if (shortDateMatch) {
    const [, day, month, year] = shortDateMatch;
    const date = new Date(
      Date.UTC(Number(year), SHORT_MONTH_INDEX[month], Number(day))
    );
    return formatArabicDate(date, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const shortDateTimeMatch = text.match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/
  );
  if (shortDateTimeMatch) {
    const [, day, month, year, hoursText, minutes, meridiem] = shortDateTimeMatch;
    let hours = Number(hoursText);
    if (meridiem.toUpperCase() === "PM" && hours < 12) hours += 12;
    if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;

    const date = new Date(
      Date.UTC(
        Number(year),
        SHORT_MONTH_INDEX[month],
        Number(day),
        hours,
        Number(minutes)
      )
    );

    return formatArabicDate(date, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const weekdayMonthMatch = text.match(
    /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})$/
  );
  if (weekdayMonthMatch) {
    const [, , month, day] = weekdayMonthMatch;
    const date = new Date(
      Date.UTC(new Date().getUTCFullYear(), LONG_MONTH_INDEX[month], Number(day))
    );
    return formatArabicDate(date, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  return null;
}

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
  "Simple invoicing and customer management":
    "نظام مبسط للفوترة وإدارة العملاء",
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
  "BizArch Logo": "شعار BizArch",
  "About BizArch ERP": "حول BizArch ERP",
  "Check for Updates": "التحقق من التحديثات",
  "BizArch. All rights reserved.": "BizArch. جميع الحقوق محفوظة.",
  "Toggle menu": "تبديل القائمة",
  "Navigation menu": "قائمة التنقل",
  "Browse the BizArch ERP sections and open a page.":
    "استعرض أقسام BizArch ERP وافتح الصفحة المطلوبة.",
  "Loading journal entries...": "جارٍ تحميل القيود اليومية...",
  "No journal entries": "لا توجد قيود يومية",
  "Journal entries will appear here once the invoice is posted.":
    "ستظهر القيود اليومية هنا بعد ترحيل الفاتورة.",
  "Account": "الحساب",
  "Debit": "مدين",
  "Credit": "دائن",
  "Grand Total — Debit:": "الإجمالي العام - مدين:",
  Dr: "مدين",
  Cr: "دائن",
  "Walk-in Customer": "عميل نقدي",
  "P.Invoice #": "رقم فاتورة الشراء",
  "Quotation To": "عرض سعر إلى",
  "View statement": "عرض كشف الحساب",
  "Failed to save customer": "فشل في حفظ العميل",
  "Customer updated successfully": "تم تحديث بيانات العميل بنجاح",
  "Customer added successfully": "تمت إضافة العميل بنجاح",
  "Edit Customer": "تحرير العميل",
  "Add New Customer": "إضافة عميل جديد",
  "Update the customer details below.": "حدّث بيانات العميل أدناه.",
  "Fill in the details to add a new customer.":
    "أدخل البيانات لإضافة عميل جديد.",
  "15-digit GSTIN": "رقم ضريبي مكوّن من 15 رقمًا",
  "GST State Code": "رمز المنطقة الضريبية",
  "e.g. 27": "مثال: 27",
  "District / الحي": "الحي",
  "Building No / رقم المبنى": "رقم المبنى",
  "Add. No / الرقم الفرعي": "الرقم الفرعي",
  "C.R No / معرف آخر": "رقم السجل التجاري / معرّف آخر",
  "Any additional notes...": "أي ملاحظات إضافية...",
  "Failed to save supplier": "فشل في حفظ المورد",
  "Supplier updated successfully": "تم تحديث بيانات المورد بنجاح",
  "Supplier added successfully": "تمت إضافة المورد بنجاح",
  "Edit Supplier": "تحرير المورد",
  "Add New Supplier": "إضافة مورد جديد",
  "Update the supplier details below.": "حدّث بيانات المورد أدناه.",
  "Fill in the details to add a new supplier.":
    "أدخل البيانات لإضافة مورد جديد.",
  "No customers found. Click + to add one.":
    "لم يتم العثور على عملاء. اضغط + لإضافة عميل.",
  "Add new customer": "إضافة عميل جديد",
  "Out of stock": "نفد المخزون",
  "Low stock": "مخزون منخفض",
  Service: "خدمة",
  "No products found. Click + to add one.":
    "لم يتم العثور على أصناف. اضغط + لإضافة صنف.",
  "Add new product": "إضافة صنف جديد",
  "No suppliers found. Click + to add one.":
    "لم يتم العثور على موردين. اضغط + لإضافة مورد.",
  "Add new supplier": "إضافة مورد جديد",
  "Failed to load branches and warehouses": "فشل في تحميل الفروع والمستودعات",
  "Photo too large. Maximum size is 10 MB.":
    "الصورة كبيرة جدًا. الحد الأقصى 10 ميجابايت.",
  "Photo uploaded": "تم رفع الصورة",
  "Photo upload failed": "فشل رفع الصورة",
  "IMEI 1, Supplier, and Cost Price are required":
    "IMEI 1 والمورد وتكلفة الشراء حقول مطلوبة",
  "Product is required": "الصنف مطلوب",
  "Warehouse is required": "المستودع مطلوب",
  "Device updated successfully": "تم تحديث الجهاز بنجاح",
  "Device added successfully": "تمت إضافة الجهاز بنجاح",
  "Failed to add device": "فشل في إضافة الجهاز",
  "Edit Device": "تحرير الجهاز",
  "Add Device": "إضافة جهاز",
  "Update details for this mobile device": "حدّث بيانات هذا الجهاز",
  "Manually add a mobile device to inventory":
    "أضف جهازًا يدويًا إلى المخزون",
  Location: "الموقع",
  Identifiers: "المعرّفات",
  "IMEI 1 *": "IMEI 1 *",
  "15-digit IMEI": "رقم IMEI من 15 رقمًا",
  "e.g. Black": "مثال: أسود",
  "Open Box": "مفتوح العلبة",
  "Grade A": "درجة A",
  "Grade B": "درجة B",
  "Grade C": "درجة C",
  "Battery %": "نسبة البطارية",
  "e.g. 95": "مثال: 95",
  "Product & Supplier": "الصنف والمورد",
  "No IMEI-tracked products found. Create one from the Products page first.":
    "لم يتم العثور على أصناف بتتبع IMEI. أنشئ صنفًا من صفحة المنتجات أولاً.",
  "Supplier *": "المورد *",
  "Cost *": "التكلفة *",
  "Supplier Expiry": "انتهاء ضمان المورد",
  "Customer Expiry": "انتهاء ضمان العميل",
  "Device Photos": "صور الجهاز",
  "Remove photo": "إزالة الصورة",
  "Add Photo": "إضافة صورة",
  "JPG, PNG or WEBP. Gallery or camera.":
    "JPG أو PNG أو WEBP. من المعرض أو الكاميرا.",
  "Camera scanning is unavailable on this device.":
    "المسح بالكاميرا غير متاح على هذا الجهاز.",
  "Camera permission denied. Please allow camera access and try again.":
    "تم رفض إذن الكاميرا. يرجى السماح بالوصول ثم المحاولة مرة أخرى.",
  "No camera found on this device.": "لم يتم العثور على كاميرا على هذا الجهاز.",
  Scanner: "الماسح",
  "Scanner setup": "إعداد الماسح",
  "Scan Barcode / QR Code": "مسح الباركود / رمز QR",
  "Point at a barcode or QR code": "وجّه الكاميرا نحو باركود أو رمز QR",
  "Looking up details...": "جارٍ البحث عن التفاصيل...",
  "Failed to fetch data.": "فشل في جلب البيانات.",
  "An error occurred.": "حدث خطأ.",
  "View Device": "عرض الجهاز",
  "Item Not Found": "العنصر غير موجود",
  "Create New": "إنشاء جديد",
  "Cost Price": "تكلفة الشراء",
  "Scan IMEI with camera": "مسح IMEI بالكاميرا",
  "IMEI scanner setup": "إعداد ماسح IMEI",
  "Scan IMEI Barcode": "مسح باركود IMEI",
  "Point at the IMEI barcode on the device or box":
    "وجّه الكاميرا نحو باركود IMEI على الجهاز أو العلبة",
  "IMEI Detected": "تم اكتشاف IMEI",
  "Portrait Only": "الوضع الرأسي فقط",
  "Rotate your phone": "قم بتدوير هاتفك",
  "The installed BizArch app is locked to portrait mode for safer data entry and more predictable layouts.":
    "تطبيق BizArch المثبّت مقفل على الوضع الرأسي لضمان إدخال بيانات أكثر أمانًا وتخطيطات أكثر ثباتًا.",
  "Cost cannot be negative": "لا يمكن أن تكون التكلفة سالبة",
  "At least one component is required for a bundle":
    "يلزم إضافة مكوّن واحد على الأقل للحزمة",
  "All components must have a product selected":
    "يجب اختيار صنف لكل مكوّن",
  "All components must have a valid quantity":
    "يجب أن تحتوي جميع المكوّنات على كمية صحيحة",
  "Used as the default purchase/fallback cost when no stock lot cost is available.":
    "تُستخدم كتكلفة شراء افتراضية/بديلة عند عدم توفر تكلفة دفعة مخزون.",
  "Optional product code": "رمز صنف اختياري",
  "Scan barcode": "مسح الباركود",
  "e.g. 8471": "مثال: 8471",
  "Service product (no inventory tracking)":
    "صنف خدمي (بدون تتبع مخزون)",
  "Bundle / Kit (stock deducted from components)":
    "حزمة / طقم (يُخصم المخزون من المكوّنات)",
  "Bundle Components": "مكوّنات الحزمة",
  "Add Component": "إضافة مكوّن",
  "Define what raw products make up 1 unit of this bundle. When sold, stock is deducted from these components.":
    "حدّد الأصناف المكوّنة لوحدة واحدة من هذه الحزمة. عند البيع يتم خصم المخزون من هذه المكوّنات.",
  'No components added yet. Click "Add Component" to start.':
    "لم تتم إضافة مكوّنات بعد. اضغط \"إضافة مكوّن\" للبدء.",
  "Select product...": "اختر صنفًا...",
  Qty: "الكمية",
  "Track by IMEI (individual device tracking)":
    "التتبع عبر IMEI (تتبع كل جهاز على حدة)",
  "Weigh Machine Code": "رمز ميزان الباركود",
  "e.g. 12345": "مثال: 12345",
  "Numeric code embedded in the weigh machine barcode label":
    "رمز رقمي مضمّن داخل ملصق باركود الميزان",
  "Manage cash and bank accounts": "إدارة حسابات الصندوق والبنك",
  "Double-entry accounting records": "قيود محاسبية مزدوجة القيد",
  "Search journal entries...": "بحث في القيود اليومية...",
  "Open entry": "فتح القيد",
  "Format: 22AAAAA0000A1Z5 (15 characters)":
    "التنسيق: 22AAAAA0000A1Z5 (15 خانة)",
  "Format: SBIN0001234 (11 characters)":
    "التنسيق: SBIN0001234 (11 خانة)",
  "Document Round Off": "تقريب إجمالي المستند",
  Disabled: "معطّل",
  "Applies to invoice, POS, and purchase document totals.":
    "يُطبّق على إجماليات الفواتير ونقطة البيع ومستندات الشراء.",
  "Branches & Warehouses": "الفروع والمستودعات",
  "Manage your organization locations and storage facilities":
    "إدارة مواقع منشأتك ومرافق التخزين",
  "Set initial inventory quantities and values for your products":
    "تعيين كميات وقيم المخزون الافتتاحي لأصنافك",
  "Add Opening Stock": "إضافة مخزون افتتاحي",
  "Move stock between warehouses and complete the transfer in one step.":
    "انقل المخزون بين المستودعات وأكمل التحويل في خطوة واحدة.",
  "Profit by Invoice": "الربح حسب الفاتورة",
  "View profit analysis by invoice with expandable item details":
    "عرض تحليل الربح حسب الفاتورة مع تفاصيل البنود القابلة للتوسعة",
  "View customer balances - positive amounts are receivables (owed to you), negative amounts in green are advances (paid in advance)":
    "عرض أرصدة العملاء: المبالغ الموجبة تمثل الذمم المدينة المستحقة لكم، والمبالغ السالبة باللون الأخضر تمثل دفعات مقدمة.",
  "View outstanding supplier balances (Accounts Payable)":
    "عرض أرصدة الموردين المستحقة (الذمم الدائنة)",
  "Total Suppliers": "إجمالي الموردين",
  "Active Suppliers": "الموردون النشطون",
  "Total Payable": "إجمالي الذمم الدائنة",
  "With Balance": "لديهم رصيد",
  "Total Receivable": "إجمالي الذمم المدينة",
  "Total Advances": "إجمالي الدفعات المقدمة",
  "Net Balance": "صافي الرصيد",
  "total outstanding": "إجمالي الرصيد المستحق",
  "AP Reconciliation": "مطابقة الذمم الدائنة",
  "AR Reconciliation": "مطابقة الذمم المدينة",
  Reconciled: "متطابق",
  "Balance Details": "تفاصيل الأرصدة",
  "suppliers owed money": "موردون مستحقة لهم مبالغ",
  "No phone number": "لا يوجد رقم هاتف",
  "View detailed transactions for any account, customer, or supplier":
    "عرض الحركات التفصيلية لأي حساب أو عميل أو مورد",
  "Entity / Account": "الجهة / الحساب",
  "Select entity": "اختر الجهة",
  "Summary of all account balances": "ملخص جميع أرصدة الحسابات",
  "As of Date": "كما في تاريخ",
  Generate: "إنشاء",
  "Income statement for a period": "قائمة دخل لفترة محددة",
  "Financial position as of a date": "المركز المالي كما في تاريخ",
  "Assets = Liabilities + Equity": "الأصول = الالتزامات + حقوق الملكية",
  "Cash inflows and outflows": "التدفقات النقدية الداخلة والخارجة",
  Inflow: "تدفق داخل",
  Outflow: "تدفق خارج",
  Net: "الصافي",
  "Expenses by category and supplier": "المصروفات حسب التصنيف والمورد",
  "Number of Expenses": "عدد المصروفات",
  "Current inventory levels by product and warehouse":
    "مستويات المخزون الحالية حسب الصنف والمستودع",
  "Export CSV": "تصدير CSV",
  "Low stock only": "المخزون المنخفض فقط",
  Default: "افتراضي",
  Payable: "مستحق السداد",
  None: "لا يوجد",
  "Not yet paid": "لم يتم السداد بعد",
  "No supplier expense": "مصروف بدون مورد",
  "Created on": "تم الإنشاء في",
  Dated: "بتاريخ",
  "Valid until": "صالح حتى",
  Convert: "تحويل",
  Pay: "سداد",
  Quotation: "عرض سعر",
  "Purchase Invoice": "فاتورة مشتريات",
  Invoice: "فاتورة",
  Invoices: "الفواتير",
  Journal: "قيد يومية",
  Piece: "قطعة",
  "Owner's Capital": "رأس مال المالك",
  Rent: "الإيجار",
  Utilities: "المرافق",
  Marketing: "التسويق",
  Deposits: "الإيداعات",
  Withdrawals: "السحوبات",
  Transfers: "التحويلات",
  "Bank Accounts": "الحسابات البنكية",
  "Search for a device by scanning or entering its IMEI number":
    "ابحث عن جهاز عبر مسح رقم IMEI أو إدخاله",
  "Scan or enter IMEI number...": "امسح أو أدخل رقم IMEI...",
  "Search Device": "بحث عن الجهاز",
  "Press Enter, tap the camera icon, or scan a barcode to search":
    "اضغط Enter أو أيقونة الكاميرا أو امسح باركودًا للبحث",
  "Manage individual mobile devices": "إدارة الأجهزة الفردية",
  "Search IMEI, brand, model...": "ابحث برقم IMEI أو العلامة التجارية أو الموديل...",
  "All Statuses": "كل الحالات",
  "Unable to load devices": "تعذر تحميل الأجهزة",
  "Mobile Shop module is not enabled": "وحدة متجر الأجهزة غير مفعّلة",
  "Customer Statement": "كشف حساب العميل",
  "Supplier Statement": "كشف حساب المورد",
  "Loading statement...": "جارٍ تحميل كشف الحساب...",
  "No transactions found": "لا توجد حركات",
  "This customer has no transactions yet": "هذا العميل ليس لديه حركات حتى الآن",
  "Transfer Note": "مذكرة التحويل",
  "Line Total": "إجمالي السطر",
  "Search transfers...": "بحث في التحويلات...",
  "All Status": "كل الحالات",
  Open: "مفتوح",
  Items: "العناصر",
};

const literalTranslations: LiteralTranslationMap = {
  ...generatedLiteralTranslations,
  ...extraLiteralTranslations,
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

  const translatedDate = translateEnglishDateLiteral(text);
  if (translatedDate) return translatedDate;

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

  const userCreatedMatch = text.match(/^User "(.+)" created successfully!$/);
  if (userCreatedMatch) {
    return `تم إنشاء المستخدم "${userCreatedMatch[1]}" بنجاح!`;
  }

  const skuMatch = text.match(/^SKU:\s*(.+)$/);
  if (skuMatch) {
    return `رمز الصنف: ${skuMatch[1]}`;
  }

  const stockUnitsMatch = text.match(/^Stock:\s*(.+)\s+units$/);
  if (stockUnitsMatch) {
    return `المخزون: ${stockUnitsMatch[1]} وحدة`;
  }

  const couldNotStartCameraMatch = text.match(/^Could not start camera:\s*(.+)$/);
  if (couldNotStartCameraMatch) {
    return `تعذر تشغيل الكاميرا: ${couldNotStartCameraMatch[1]}`;
  }

  const createdOnWithValidUntilMatch = text.match(/^Created on (.+)\s+•\s+Valid until (.+)$/);
  if (createdOnWithValidUntilMatch) {
    return `تم الإنشاء في ${translateEnglishDateLiteral(createdOnWithValidUntilMatch[1]) ?? createdOnWithValidUntilMatch[1]} • صالح حتى ${translateEnglishDateLiteral(createdOnWithValidUntilMatch[2]) ?? createdOnWithValidUntilMatch[2]}`;
  }

  const createdOnMatch = text.match(/^Created on (.+)$/);
  if (createdOnMatch) {
    return `تم الإنشاء في ${translateEnglishDateLiteral(createdOnMatch[1]) ?? createdOnMatch[1]}`;
  }

  const datedMatch = text.match(/^Dated (.+)$/);
  if (datedMatch) {
    return `بتاريخ ${translateEnglishDateLiteral(datedMatch[1]) ?? datedMatch[1]}`;
  }

  const sentMatch = text.match(/^Sent (.+)$/);
  if (sentMatch) {
    return `تم الإرسال في ${translateEnglishDateLiteral(sentMatch[1]) ?? sentMatch[1]}`;
  }

  const validUntilMatch = text.match(/^Valid until (.+)$/);
  if (validUntilMatch) {
    return `صالح حتى ${translateEnglishDateLiteral(validUntilMatch[1]) ?? validUntilMatch[1]}`;
  }

  const recordedOnMatch = text.match(/^Recorded on (.+)$/);
  if (recordedOnMatch) {
    return `تم التسجيل في ${translateEnglishDateLiteral(recordedOnMatch[1]) ?? recordedOnMatch[1]}`;
  }

  const generatedOnMatch = text.match(/^Generated on (.+)$/);
  if (generatedOnMatch) {
    return `تم الإنشاء في ${translateEnglishDateLiteral(generatedOnMatch[1]) ?? generatedOnMatch[1]}`;
  }

  const joinedMatch = text.match(/^Joined (.+)$/);
  if (joinedMatch) {
    return `انضم في ${translateEnglishDateLiteral(joinedMatch[1]) ?? joinedMatch[1]}`;
  }

  const issueDateMatch = text.match(/^Issue Date:\s*(.+)$/);
  if (issueDateMatch) {
    return `تاريخ الإصدار: ${translateEnglishDateLiteral(issueDateMatch[1]) ?? issueDateMatch[1]}`;
  }

  const dueDateMatch = text.match(/^Due Date:\s*(.+)$/);
  if (dueDateMatch) {
    return `تاريخ الاستحقاق: ${translateEnglishDateLiteral(dueDateMatch[1]) ?? dueDateMatch[1]}`;
  }

  const qtyMatch = text.match(/^Qty:\s*(.+)$/);
  if (qtyMatch) {
    return `الكمية: ${qtyMatch[1]}`;
  }

  const priceMatch = text.match(/^Price:\s*(.+)$/);
  if (priceMatch) {
    return `السعر: ${priceMatch[1]}`;
  }

  const costMatch = text.match(/^Cost:\s*(.+)$/);
  if (costMatch) {
    return `التكلفة: ${costMatch[1]}`;
  }

  const subtotalMatch = text.match(/^Subtotal:\s*(.+)$/);
  if (subtotalMatch) {
    return `المجموع الفرعي: ${subtotalMatch[1]}`;
  }

  const totalMatch = text.match(/^Total:\s*(.+)$/);
  if (totalMatch) {
    return `الإجمالي: ${totalMatch[1]}`;
  }

  const generalLedgerMatch = text.match(/^GL:\s*(.+)$/);
  if (generalLedgerMatch) {
    return `الأستاذ العام: ${generalLedgerMatch[1]}`;
  }

  const offByMatch = text.match(/^Off by\s+(.+)$/);
  if (offByMatch) {
    return `الفرق ${offByMatch[1]}`;
  }

  const customersCountMatch = text.match(/^(\d+)\s+customers?$/);
  if (customersCountMatch) {
    return `${customersCountMatch[1]} عميل`;
  }

  const suppliersCountMatch = text.match(/^(\d+)\s+suppliers?$/);
  if (suppliersCountMatch) {
    return `${suppliersCountMatch[1]} مورد`;
  }

  const activeCountMatch = text.match(/^(\d+)\s+active$/);
  if (activeCountMatch) {
    return `${activeCountMatch[1]} نشط`;
  }

  const transactionsCountMatch = text.match(/^(\d+)\s+transactions$/);
  if (transactionsCountMatch) {
    return `${transactionsCountMatch[1]} حركة`;
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

function resolveLocalizedLiteral(
  currentValue: string,
  storedOriginal: string | undefined,
  lang: Language
): { originalValue: string; nextValue: string } {
  if (lang === "en") {
    return { originalValue: currentValue, nextValue: currentValue };
  }

  if (!storedOriginal) {
    return {
      originalValue: currentValue,
      nextValue: translateLiteral(currentValue, lang),
    };
  }

  const localizedStoredValue = translateLiteral(storedOriginal, lang);
  const hasFreshSourceValue =
    currentValue !== storedOriginal && currentValue !== localizedStoredValue;
  const originalValue = hasFreshSourceValue ? currentValue : storedOriginal;

  return {
    originalValue,
    nextValue: translateLiteral(originalValue, lang),
  };
}

function localizeTextNode(node: Text, lang: Language): void {
  if (shouldSkipTextNode(node)) return;

  const currentValue = node.nodeValue ?? "";
  const storedOriginal = textNodeOriginals.get(node);
  const { originalValue, nextValue } = resolveLocalizedLiteral(
    currentValue,
    storedOriginal,
    lang
  );

  if (storedOriginal !== originalValue) {
    textNodeOriginals.set(node, originalValue);
  }

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
    const storedOriginal = originals.get(attribute);
    const { originalValue, nextValue } = resolveLocalizedLiteral(
      currentValue,
      storedOriginal,
      lang
    );

    if (storedOriginal !== originalValue) {
      originals.set(attribute, originalValue);
    }

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
    (typeof window !== "undefined" ? getStoredLanguage() : null) ??
    normalizeLanguage(initialLang) ??
    sessionLanguage ??
    "en";

  useEffect(() => {
    persistLanguagePreference(lang);
    applyDocumentLanguage(lang);

    // Skip DOM localization and MutationObserver for English — no-ops wastefully
    if (lang === "en") return;

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
