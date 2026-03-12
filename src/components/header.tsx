"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { LogOut, User, Building2, Search, Globe, Check } from "lucide-react";
import { MobileSidebar } from "./sidebar";
import { useEffect, useState } from "react";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import {
  getLocale,
  persistLanguagePreference,
  useLanguage,
  type Language,
} from "@/lib/i18n";

const VOUCHER_ROUTE_PREFIXES = [
  "/invoices",
  "/purchase-invoices",
  "/quotations",
  "/credit-notes",
  "/debit-notes",
  "/payments",
  "/supplier-payments",
  "/accounting/expenses",
  "/accounting/cash-bank",
  "/accounting/journal-entries",
];

function matchesRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const { setOpen } = useCommandPalette();
  const { t, lang, setLanguage } = useLanguage();
  const [orgName, setOrgName] = useState<string>("");
  const [switchingLang, setSwitchingLang] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isDashboardHome = pathname === "/";
  const isVoucherRoute = VOUCHER_ROUTE_PREFIXES.some((href) => matchesRoute(pathname, href));

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";
  const firstName = session?.user?.name?.split(" ")[0] || "User";
  const today = new Intl.DateTimeFormat(getLocale(lang), {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user?.organizationId) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((settings) => {
          const companyName = settings.find?.((s: { key: string }) => s.key === "company_name");
          if (companyName) {
            setOrgName(companyName.value);
          }
        })
        .catch(() => { });
    }
  }, [session?.user?.organizationId]);

  const handleLanguageSwitch = async (newLang: Language) => {
    if (newLang === lang || switchingLang) return;
    setSwitchingLang(true);
    setLanguage(newLang);
    persistLanguagePreference(newLang);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });
      if (res.ok) {
        // Update the JWT session with the new language, then reload
        await update({ language: newLang });
        window.location.reload();
      } else {
        setLanguage(lang);
        persistLanguagePreference(lang);
      }
    } catch (err) {
      console.error("Failed to switch language:", err);
      setLanguage(lang);
      persistLanguagePreference(lang);
    } finally {
      setSwitchingLang(false);
    }
  };

  const accountMenu = mounted ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-slate-900 text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="max-w-32 truncate text-sm font-semibold text-slate-900">
              {session?.user?.name}
            </p>
            <p className="text-xs text-slate-500">{session?.user?.email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session?.user?.name}</p>
            <p className="text-xs text-slate-500">{session?.user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          {t("header.profile")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="mr-2 h-4 w-4" />
            {t("header.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleLanguageSwitch("en")} disabled={switchingLang}>
                <Check className={`mr-2 h-4 w-4 ${lang === "en" ? "opacity-100" : "opacity-0"}`} />
                {t("header.english")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageSwitch("ar")} disabled={switchingLang}>
                <Check className={`mr-2 h-4 w-4 ${lang === "ar" ? "opacity-100" : "opacity-0"}`} />
                {t("header.arabic")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("header.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="h-10 w-10 rounded-full bg-slate-200" aria-hidden="true" />
  );

  if (isVoucherRoute) {
    return (
      <header className="px-4 pt-3 md:hidden">
        <div className="glass-panel relative overflow-hidden px-3 py-3">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0))]"
          />
          <div className="relative flex items-center justify-between gap-3">
            {mounted ? (
              <MobileSidebar />
            ) : (
              <div className="h-10 w-10" aria-hidden="true" />
            )}
            <div className="flex items-center gap-2">
              {mounted && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setOpen(true)}
                >
                  <Search className="h-4 w-4" />
                  <span className="sr-only">{t("header.searchPlaceholder")}</span>
                </Button>
              )}
              {accountMenu}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={isDashboardHome ? "sticky top-0 z-20 px-4 pt-3 md:px-6 md:pt-4" : "px-4 pt-3 md:px-6 md:pt-4"}>
      <div
        className={
          isDashboardHome
            ? "relative rounded-3xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:px-5 md:py-3"
            : "relative rounded-3xl border border-slate-200 bg-white px-3 py-3 shadow-sm md:px-4 md:py-3.5"
        }
      >
        <div
          className={
            isDashboardHome
              ? "flex items-center justify-between gap-3"
              : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          }
        >
          <div className={`flex min-w-0 gap-3 ${isDashboardHome ? "items-center" : "items-center"}`}>
            {mounted ? (
              <MobileSidebar />
            ) : (
              <div className="h-10 w-10 md:hidden" aria-hidden="true" />
            )}
            <div className="min-w-0">
              {isDashboardHome ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="whitespace-nowrap text-base font-semibold text-slate-900 md:text-lg">
                    {t("header.welcome")}, {firstName}
                  </h1>
                  <span className="section-chip text-[10px] px-2 py-0.5">{today}</span>
                  {orgName && (
                    <span className="hidden sm:inline-flex surface-pill text-[10px] px-2 py-0.5">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[140px]">{orgName}</span>
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="surface-pill max-w-full">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{orgName || t("header.manageOps")}</span>
                    </span>
                    <span className="section-chip hidden sm:inline-flex">{today}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 sm:hidden">{today}</p>
                </>
              )}
            </div>
          </div>

          <div
            className={
              isDashboardHome
                ? "flex items-center gap-2 md:gap-3 shrink-0"
                : "flex items-center gap-2 md:gap-3 sm:justify-end lg:min-w-[22rem]"
            }
          >
            <button
              onClick={() => setOpen(true)}
              className={
                isDashboardHome
                  ? "hidden min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 lg:flex"
                  : "hidden min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 lg:flex"
              }
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Search className="h-3.5 w-3.5 shrink-0" />
              </div>
              <span className="min-w-0 truncate text-left font-medium text-slate-600 text-xs">
                {t("header.searchPlaceholder")}
              </span>
              <kbd className="pointer-events-none hidden items-center gap-0.5 rounded-full border border-slate-200/80 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-400 lg:inline-flex">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            </button>

            {mounted && (
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setOpen(true)}
              >
                <Search className="h-4 w-4" />
                <span className="sr-only">{t("header.searchPlaceholder")}</span>
              </Button>
            )}

            {accountMenu}
          </div>
        </div>
      </div>
    </header>
  );
}
