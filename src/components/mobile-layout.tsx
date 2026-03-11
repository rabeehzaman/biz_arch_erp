"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import {
  KonstaProvider,
  App,
  Page,
  Tabbar,
  TabbarLink,
} from "konsta/react";
import {
  LayoutDashboard,
  ShoppingCart,
  Monitor,
  Package,
  MoreHorizontal,
} from "lucide-react";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { key: "home", href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { key: "sales", href: "/invoices", icon: ShoppingCart, labelKey: "nav.sales" },
  { key: "pos", href: "/pos", icon: Monitor, labelKey: "nav.posTerminal" },
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
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const activeTab = getActiveTab(pathname);
  const isSuperadmin = session?.user?.role === "superadmin";
  const baseContentClassName = "min-h-[100dvh] bg-white px-4 pt-4";
  const contentClassName = `${baseContentClassName} pb-[calc(5rem+env(safe-area-inset-bottom,0px))]`;

  // Superadmin only sees organizations, skip tabbar
  if (isSuperadmin) {
    return (
      <KonstaProvider theme="material">
        <App theme="material" safeAreas>
          <Page className="!static !h-auto !overflow-visible pb-0">
            <div className={`${baseContentClassName} pb-6`}>
              <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
                {children}
              </div>
            </div>
          </Page>
        </App>
      </KonstaProvider>
    );
  }

  return (
    <KonstaProvider theme="material">
      <App theme="material" safeAreas>
        <Page
          className="!static !h-auto !overflow-visible pb-0"
          colors={{ bgMaterial: "bg-white" }}
        >
          <div className={contentClassName}>
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
              {children}
            </div>
          </div>

          {/* Bottom tabbar */}
          <Tabbar
            labels
            icons
            className="fixed! bottom-0 left-0 right-0 z-50"
          >
            {tabs.map((tab) => (
              <TabbarLink
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => router.push(tab.href)}
                icon={<tab.icon className="h-6 w-6" />}
                label={t(tab.labelKey)}
              />
            ))}
          </Tabbar>
        </Page>
      </App>
    </KonstaProvider>
  );
}
