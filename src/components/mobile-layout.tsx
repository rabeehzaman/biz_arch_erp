"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useLanguage } from "@/lib/i18n";
import { useMobileFixedUi } from "@/hooks/use-mobile-fixed-ui";
import {
  LayoutDashboard,
  ShoppingCart,
  Monitor,
  Package,
  MoreHorizontal,
  LogOut,
  Truck,
  Users,
  Receipt,
  BarChart3,
  Settings,
  Plus,
  FileText,
  FileCheck,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import { useMobileNavConfig, useSidebarMode } from "@/hooks/use-form-config";
import { GlobalScanner } from "@/components/scanner/global-scanner";
import { MobileLanguageSwitcher } from "@/components/mobile-language-switcher";
import { NetworkStatusBanner } from "@/components/mobile/network-status-banner";
import { useHaptics } from "@/hooks/use-haptics";
import { NavigationDirectionProvider } from "@/components/mobile/navigation-direction-provider";
import { ActionSheet, type ActionSheetAction } from "@/components/mobile/action-sheet";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  Monitor,
  Package,
  MoreHorizontal,
  Truck,
  Users,
  Receipt,
  BarChart3,
  Settings,
};

interface TabDef {
  key: string;
  href: string;
  icon: LucideIcon;
  labelKey: string;
  mobileLabelKey?: string;
}

const DEFAULT_TABS: TabDef[] = [
  { key: "home", href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { key: "sales", href: "/invoices", icon: ShoppingCart, labelKey: "nav.sales" },
  { key: "products", href: "/products", icon: Package, labelKey: "nav.products" },
  { key: "more", href: "/more", icon: MoreHorizontal, labelKey: "nav.more" },
];

// Route groups for tab matching
const ROUTE_GROUPS: Record<string, string[]> = {
  sales: ["/invoices", "/customers", "/quotations", "/credit-notes", "/payments"],
  purchases: ["/purchase-invoices", "/suppliers", "/debit-notes", "/supplier-payments"],
};

function getActiveTab(pathname: string, configuredTabs: TabDef[]): string {
  const configuredKeys = new Set(configuredTabs.map((t) => t.key));

  // Direct path match
  for (const tab of configuredTabs) {
    if (pathname === tab.href) return tab.key;
    if (tab.href !== "/" && pathname.startsWith(tab.href + "/")) return tab.key;
  }

  // Route group matching
  for (const [groupKey, routes] of Object.entries(ROUTE_GROUPS)) {
    if (configuredKeys.has(groupKey) && routes.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return groupKey;
    }
  }

  // Fallback
  return configuredKeys.has("more") ? "more" : configuredTabs[configuredTabs.length - 1]?.key ?? "home";
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const mobileNavConfig = useMobileNavConfig();
  const sidebarMode = useSidebarMode();

  const router = useRouter();

  // Resolve configured tabs (with icon components) or use defaults
  // Center slot is always the plus button — we need exactly 4 nav tabs
  const tabs: TabDef[] = useMemo(() => {
    if (!mobileNavConfig) return DEFAULT_TABS;
    const resolved = mobileNavConfig.map((tab) => ({
      ...tab,
      icon: ICON_MAP[tab.icon] || MoreHorizontal,
    }));
    // Legacy 5-tab config: take first 2 + last 2, drop center (it becomes a plus action)
    if (resolved.length === 5) {
      return [...resolved.slice(0, 2), ...resolved.slice(3)];
    }
    // 4-tab config: use as-is
    if (resolved.length === 4) return resolved;
    // Fallback for unexpected lengths
    return DEFAULT_TABS;
  }, [mobileNavConfig]);

  const activeTab = getActiveTab(pathname, tabs);
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const isSuperadmin = session?.user?.role === "superadmin";
  const showLanguageSwitcher = pathname === "/";
  const { bottomOffset, hideFixedUi, scrolledDown } = useMobileFixedUi();
  const { selectionChanged, impactLight } = useHaptics();
  const [tappedTab, setTappedTab] = useState<string | null>(null);
  const [plusSheetOpen, setPlusSheetOpen] = useState(false);
  const [plusTapped, setPlusTapped] = useState(false);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const baseContentClassName = "min-h-[100dvh] bg-slate-50 px-4 pt-4";
  const contentClassName = `${baseContentClassName} pb-[calc(5.25rem+var(--app-safe-area-bottom))]`;
  const bottomNavClassName =
    "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-10px_24px_-22px_rgba(15,23,42,0.18)]";
  const navHidden = hideFixedUi || scrolledDown;

  // Quick actions for the center plus button
  const plusActions: ActionSheetAction[] = useMemo(
    () => [
      { label: t("nav.newInvoice"), icon: FileText, onSelect: () => router.push("/invoices/new") },
      { label: t("nav.newQuotation"), icon: FileCheck, onSelect: () => router.push("/quotations/new") },
      { label: t("nav.newCustomer"), icon: Users, onSelect: () => router.push("/customers/new") },
      { label: t("nav.newProduct"), icon: Package, onSelect: () => router.push("/products/new") },
      { label: t("nav.openPOS"), icon: Monitor, onSelect: () => router.push("/pos") },
      { label: t("nav.newExpense"), icon: CircleDollarSign, onSelect: () => router.push("/accounting/expenses/new") },
    ],
    [t, router],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Update pill position when active tab changes
  useEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (el) setPillStyle({ left: el.offsetLeft + el.offsetWidth / 2 - 16, width: 32 });
  }, [activeIndex]);

  // Hidden sidebar mode (POS-only) — no bottom nav, full-width content
  if (sidebarMode === "hidden" && !isSuperadmin) {
    return (
      <div className={`${baseContentClassName} pb-6`}>
        <div className="mx-auto w-full max-w-[1680px]">
          <div className="flex flex-col gap-6">{children}</div>
        </div>
      </div>
    );
  }

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
          {/* Left tabs (first 2) */}
          {tabs.slice(0, 2).map((tab, index) => {
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

          {/* Center plus button */}
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              aria-label={t("nav.quickActions")}
              onClick={() => setPlusSheetOpen(true)}
              onPointerDown={() => {
                impactLight();
                setPlusTapped(true);
                setTimeout(() => setPlusTapped(false), 200);
              }}
              className={`absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-300 active:scale-95 ${plusTapped ? "plus-btn-tap" : ""}`}
            >
              <Plus
                className={`h-6 w-6 transition-transform duration-300 ${plusSheetOpen ? "rotate-45" : ""}`}
                strokeWidth={2.5}
              />
            </button>
          </div>

          {/* Right tabs (last 2) */}
          {tabs.slice(2, 4).map((tab, index) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                ref={(el) => { tabRefs.current[index + 2] = el; }}
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

          {/* Active pill indicator */}
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

      {/* Plus button action sheet */}
      <ActionSheet
        open={plusSheetOpen}
        onOpenChange={setPlusSheetOpen}
        title={t("nav.quickActions")}
        actions={plusActions}
        cancelLabel={t("common.cancel")}
      />

      <GlobalScanner />
    </div>
    </NavigationDirectionProvider>
  );
}
