import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

type TranslationDict = typeof en;

const translations: Record<string, TranslationDict> = { en, ar };

export type Language = "en" | "ar";

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
