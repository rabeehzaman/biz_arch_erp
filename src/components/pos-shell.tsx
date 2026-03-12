"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { useMobileFixedUi } from "@/hooks/use-mobile-fixed-ui";
import {
  LayoutDashboard,
  ShoppingCart,
  Monitor,
  Package,
  MoreHorizontal,
} from "lucide-react";

const tabs = [
  { key: "home", href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { key: "sales", href: "/invoices", icon: ShoppingCart, labelKey: "nav.sales" },
  { key: "pos", href: "/pos", icon: Monitor, labelKey: "nav.posTerminal", mobileLabelKey: "nav.posShort" },
  { key: "products", href: "/products", icon: Package, labelKey: "nav.products" },
  { key: "more", href: "/more", icon: MoreHorizontal, labelKey: "nav.more" },
];

export function POSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { bottomOffset, hideFixedUi } = useMobileFixedUi();
  const showBottomNav = pathname === "/pos";
  const bottomNavClassName =
    "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-10px_24px_-22px_rgba(15,23,42,0.18)] md:hidden";
  const shellClassName = pathname.startsWith("/pos/terminal")
    ? "h-screen overflow-hidden bg-slate-100"
    : "min-h-screen bg-slate-100";

  useEffect(() => {
    if (!pathname.startsWith("/pos/terminal")) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <div className={shellClassName}>
      <div className={showBottomNav ? "pb-[calc(4.75rem+var(--app-safe-area-bottom))] md:pb-0" : ""}>
        {children}
      </div>

      {showBottomNav && !hideFixedUi && (
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
                const isActive = tab.href === "/pos";

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
    </div>
  );
}
