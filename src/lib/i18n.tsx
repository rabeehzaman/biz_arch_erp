"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useSession } from "next-auth/react";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

// Type for nested translation keys
type TranslationDict = typeof en;
type Section = keyof TranslationDict;

const translations: Record<string, TranslationDict> = { en, ar };

// ---------- helpers ----------

export type Language = "en" | "ar";

export function getDirection(lang: Language): "ltr" | "rtl" {
    return lang === "ar" ? "rtl" : "ltr";
}

export function getLocale(lang: Language): string {
    return lang === "ar" ? "ar-SA" : "en";
}

export function formatCurrencyLocalized(amount: number, lang: Language): string {
    if (lang === "ar") {
        return amount.toLocaleString("ar-SA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
    return amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function getCurrencySymbol(lang: Language): string {
    return lang === "ar" ? "ر.س" : "SAR";
}

// ---------- translation function ----------

/**
 * Get a translated string by dotted key path.
 * Example: translate("nav.dashboard", "en") → "Dashboard"
 * Example: translate("nav.dashboard", "ar") → "لوحة المعلومات"
 */
export function translate(key: string, lang: Language = "en"): string {
    const dict = translations[lang] || translations.en;
    const parts = key.split(".");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = dict;
    for (const part of parts) {
        result = result?.[part];
        if (result === undefined) break;
    }

    if (typeof result === "string") return result;

    // Fallback to English
    if (lang !== "en") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fallback: any = translations.en;
        for (const part of parts) {
            fallback = fallback?.[part];
            if (fallback === undefined) break;
        }
        if (typeof fallback === "string") return fallback;
    }

    // Return key if not found
    return key;
}

/**
 * Get an entire section of translations.
 * Example: getSection("nav", "ar") → { dashboard: "لوحة المعلومات", ... }
 */
export function getSection<S extends Section>(section: S, lang: Language = "en"): TranslationDict[S] {
    const dict = translations[lang] || translations.en;
    return dict[section] ?? translations.en[section];
}

// ---------- React context ----------

interface LanguageContextValue {
    lang: Language;
    dir: "ltr" | "rtl";
    t: (key: string) => string;
    isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: "en",
    dir: "ltr",
    t: (key: string) => translate(key, "en"),
    isRTL: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const lang = ((session?.user as { language?: string })?.language || "en") as Language;

    const value = useMemo<LanguageContextValue>(() => ({
        lang,
        dir: getDirection(lang),
        t: (key: string) => translate(key, lang),
        isRTL: lang === "ar",
    }), [lang]);

    return (
        <LanguageContext.Provider value= { value } >
        { children }
        </LanguageContext.Provider>
  );
}

/**
 * React hook to access translations.
 * Usage:
 *   const { t, lang, dir, isRTL } = useLanguage();
 *   <h1>{t("nav.dashboard")}</h1>
 */
export function useLanguage() {
    return useContext(LanguageContext);
}
