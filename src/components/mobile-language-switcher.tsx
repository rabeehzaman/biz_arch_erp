"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  persistLanguagePreference,
  useLanguage,
  type Language,
} from "@/lib/i18n";
import { useEdition } from "@/hooks/use-edition";

export function MobileLanguageSwitcher() {
  const { config: editionConfig } = useEdition();

  if (!editionConfig.isLanguageSwitchable) {
    return null;
  }
  const { update } = useSession();
  const { t, lang, setLanguage } = useLanguage();
  const [switchingLang, setSwitchingLang] = useState(false);

  const handleLanguageSwitch = async (newLang: Language) => {
    if (newLang === lang || switchingLang) return;

    setSwitchingLang(true);
    setLanguage(newLang);
    persistLanguagePreference(newLang);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });

      if (!response.ok) {
        throw new Error("Failed to save language");
      }

      await update({ language: newLang });
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch language:", error);
      setLanguage(lang);
      persistLanguagePreference(lang);
    } finally {
      setSwitchingLang(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="mobile-language-switcher"
          className="h-9 rounded-full border-slate-200 bg-white/95 px-3 text-slate-700 shadow-sm backdrop-blur-sm"
          aria-label={t("header.language")}
        >
          {switchingLang ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
            {lang === "ar" ? "AR" : "EN"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 rounded-2xl">
        <DropdownMenuItem
          data-testid="mobile-language-option-en"
          onClick={() => handleLanguageSwitch("en")}
          disabled={switchingLang}
        >
          <Check className={`mr-2 h-4 w-4 ${lang === "en" ? "opacity-100" : "opacity-0"}`} />
          {t("header.english")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="mobile-language-option-ar"
          onClick={() => handleLanguageSwitch("ar")}
          disabled={switchingLang}
        >
          <Check className={`mr-2 h-4 w-4 ${lang === "ar" ? "opacity-100" : "opacity-0"}`} />
          {t("header.arabic")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
