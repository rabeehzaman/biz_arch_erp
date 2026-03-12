"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { useMobileFixedUi } from "@/hooks/use-mobile-fixed-ui";
import {
  LayoutDashboard,
  ShoppingCart,
  Monitor,
  Package,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import { GlobalScanner } from "@/components/scanner/global-scanner";
import { MobileLanguageSwitcher } from "@/components/mobile-language-switcher";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { key: "home", href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { key: "sales", href: "/invoices", icon: ShoppingCart, labelKey: "nav.sales" },
  { key: "pos", href: "/pos", icon: Monitor, labelKey: "nav.posTerminal", mobileLabelKey: "nav.posShort" },
  { key: "products", href: "/products", icon: Package, labelKey: "nav.products" },
  { key: "more", href: "/more", icon: MoreHorizontal, labelKey: "nav.more" },
];

function getActiveTab(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/pos") return "pos";
  if (pathname === "/products" || pathname.startsWith("/products/")) return "products";
  if (pathname === "/more") return "more";

  // Sales-related routes
  const salesRoutes = ["/invoices", "/customers", "/quotations", "/credit-notes", "/payments"];
  if (salesRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "sales";

  // Everything else is under "more"
  return "more";
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const activeTab = getActiveTab(pathname);
  const isSuperadmin = session?.user?.role === "superadmin";
  const showLanguageSwitcher = pathname === "/";
  const { bottomOffset, hideFixedUi } = useMobileFixedUi();
  const baseContentClassName = "min-h-[100dvh] bg-slate-50 px-4 pt-4";
  const contentClassName = `${baseContentClassName} pb-[calc(4.75rem+var(--app-safe-area-bottom))]`;
  const bottomNavClassName =
    "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-10px_24px_-22px_rgba(15,23,42,0.18)]";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Superadmin only sees organizations, skip tabbar
  if (isSuperadmin) {
    return (
      <div className={`${baseContentClassName} pb-6`}>
        <div className="mx-auto w-full max-w-[1680px]">
          <div className="mb-3 flex items-center justify-end gap-2">
            {showLanguageSwitcher && <MobileLanguageSwitcher />}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm active:bg-slate-50"
            >
              <LogOut className="h-4 w-4 shrink-0 text-slate-500" />
              <span>{t("nav.signOut")}</span>
            </button>
          </div>
          <div className="flex flex-col gap-6">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-slate-50">
      <div className={contentClassName}>
        <div className="mx-auto w-full max-w-[1680px]">
          {showLanguageSwitcher && (
            <div className="mb-3 flex justify-end">
              <MobileLanguageSwitcher />
            </div>
          )}
          <div className="flex flex-col gap-6">{children}</div>
        </div>
      </div>

      {!hideFixedUi && (
        <>
          <div
            data-testid="mobile-nav-underlay"
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-white"
            style={{ height: "calc(var(--app-safe-area-bottom) + 2.5rem)" }}
          />
          <nav
            className={bottomNavClassName}
            style={{
              transform: bottomOffset > 0 ? `translateY(${bottomOffset}px)` : undefined,
            }}
          >
            <div className="grid grid-cols-5 gap-1 px-2 pb-[calc(0.35rem+var(--app-safe-area-bottom))] pt-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <tab.icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 truncate">{t(tab.mobileLabelKey ?? tab.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}

      <GlobalScanner />
    </div>
  );
}
