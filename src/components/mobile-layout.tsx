"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
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
import { NetworkStatusBanner } from "@/components/mobile/network-status-banner";
import { useHaptics } from "@/hooks/use-haptics";
import { NavigationDirectionProvider } from "@/components/mobile/navigation-direction-provider";

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
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const isSuperadmin = session?.user?.role === "superadmin";
  const showLanguageSwitcher = pathname === "/";
  const { bottomOffset, hideFixedUi, scrolledDown } = useMobileFixedUi();
  const { selectionChanged } = useHaptics();
  const [tappedTab, setTappedTab] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const baseContentClassName = "min-h-[100dvh] bg-slate-50 px-4 pt-4";
  const contentClassName = `${baseContentClassName} pb-[calc(4.75rem+var(--app-safe-area-bottom))]`;
  const bottomNavClassName =
    "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-10px_24px_-22px_rgba(15,23,42,0.18)]";
  const navHidden = hideFixedUi || scrolledDown;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Update pill position when active tab changes
  useEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (el) setPillStyle({ left: el.offsetLeft + el.offsetWidth / 2 - 16, width: 32 });
  }, [activeIndex]);

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
    <NavigationDirectionProvider>
    <div className="relative min-h-[100dvh] bg-slate-50">
      <NetworkStatusBanner />
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

      <div
        data-testid="mobile-nav-underlay"
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-white transition-transform duration-300 ease-out"
        style={{
          height: "calc(var(--app-safe-area-bottom) + 2.5rem)",
          transform: navHidden ? "translateY(100%)" : `translateY(${bottomOffset}px)`,
        }}
      />
      <nav
        className={`${bottomNavClassName} transition-transform duration-300 ease-out`}
        style={{
          transform: navHidden ? "translateY(100%)" : `translateY(${bottomOffset}px)`,
          pointerEvents: navHidden ? "none" : undefined,
        }}
        aria-hidden={navHidden}
      >
        <div className="relative grid grid-cols-5 gap-1 px-2 pb-[calc(0.35rem+var(--app-safe-area-bottom))] pt-1">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;

            return (
              <Link
                key={tab.key}
                ref={(el) => { tabRefs.current[index] = el; }}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                onPointerDown={() => {
                  selectionChanged();
                  setTappedTab(tab.key);
                  setTimeout(() => setTappedTab(null), 250);
                }}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <tab.icon
                  className={`h-5 w-5 shrink-0${tappedTab === tab.key ? " tab-icon-active" : ""}`}
                />
                <span className="min-w-0 truncate">{t(tab.mobileLabelKey ?? tab.labelKey)}</span>
              </Link>
            );
          })}
          <div
            className="absolute h-[3px] rounded-full bg-slate-900 transition-all duration-300 ease-in-out"
            style={{
              left: pillStyle.left,
              width: pillStyle.width,
              bottom: "calc(var(--app-safe-area-bottom) + 0.15rem)",
            }}
          />
        </div>
      </nav>

      <GlobalScanner />
    </div>
    </NavigationDirectionProvider>
  );
}
