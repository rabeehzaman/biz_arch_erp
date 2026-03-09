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
