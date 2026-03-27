"use client";

import { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileLayout } from "@/components/mobile-layout";
import { SWRProvider } from "@/lib/swr-config";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { RestaurantThemeProvider } from "@/components/restaurant/restaurant-theme-provider";
import { JewelleryThemeProvider } from "@/components/jewellery-shop/jewellery-theme-provider";
import { FormConfigProvider } from "@/lib/form-config/context";
import { useSidebarMode } from "@/hooks/use-form-config";

function DesktopLayout({ children }: { children: React.ReactNode }) {
    const { dir } = useLanguage();
    const pathname = usePathname();
    const sidebarMode = useSidebarMode();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    if (sidebarMode === "hidden") {
        return (
            <div className="min-h-screen bg-slate-50" dir={dir}>
                <main className="px-4 pt-4 pb-8 md:px-6 md:pt-5 md:pb-10">
                    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100" dir={dir}>
            <div className="flex min-h-screen items-start">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                    <Header />
                    <main className="flex-1 bg-slate-50 px-4 pt-4 pb-8 md:px-6 md:pt-5 md:pb-10">
                        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function RestaurantThemeWrapper({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const isRestaurantEnabled = (session?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled ?? false;

    // Fetch restaurant theme settings from org config
    const { data: themeConfig } = useSWR(
        isRestaurantEnabled ? "/api/settings/restaurant-theme" : null,
        fetcher,
    );

    if (!isRestaurantEnabled) return <>{children}</>;

    const themeEnabled = themeConfig?.restaurantThemeEnabled ?? true;
    const preset = themeConfig?.restaurantThemePreset ?? "bistro";
    const customColor = themeConfig?.restaurantThemeColor ?? null;

    return (
        <RestaurantThemeProvider enabled={themeEnabled} preset={preset} customColor={customColor}>
            {children}
        </RestaurantThemeProvider>
    );
}

function JewelleryThemeWrapper({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const isJewelleryEnabled = (session?.user as { isJewelleryModuleEnabled?: boolean })?.isJewelleryModuleEnabled ?? false;

    const { data: themeConfig } = useSWR(
        isJewelleryEnabled ? "/api/settings/jewellery-theme" : null,
        fetcher,
    );

    if (!isJewelleryEnabled) return <>{children}</>;

    const themeEnabled = themeConfig?.jewelleryThemeEnabled ?? true;
    const preset = themeConfig?.jewelleryThemePreset ?? "gold";
    const customColor = themeConfig?.jewelleryThemeColor ?? null;

    return (
        <JewelleryThemeProvider enabled={themeEnabled} preset={preset} customColor={customColor}>
            {children}
        </JewelleryThemeProvider>
    );
}

function DashboardInner({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile();
    const { dir } = useLanguage();

    if (isMobile) {
        return (
            <div dir={dir}>
                <MobileLayout>{children}</MobileLayout>
            </div>
        );
    }

    return <DesktopLayout>{children}</DesktopLayout>;
}

export default function ClientDashboardLayout({
    children,
    session,
    swrFallback = {},
    initialLang,
}: {
    children: React.ReactNode;
    session: any;
    swrFallback?: Record<string, any>;
    initialLang?: string;
}) {
    return (
        <SessionProvider session={session}>
            <SWRProvider fallback={swrFallback}>
                <FormConfigProvider>
                    <LanguageProvider initialLang={initialLang}>
                        <CommandPaletteProvider>
                            <SubscriptionBanner />
                            <RestaurantThemeWrapper>
                                <JewelleryThemeWrapper>
                                    <DashboardInner>{children}</DashboardInner>
                                </JewelleryThemeWrapper>
                            </RestaurantThemeWrapper>
                            <CommandPalette />
                            <KeyboardShortcutsDialog />
                        </CommandPaletteProvider>
                    </LanguageProvider>
                </FormConfigProvider>
            </SWRProvider>
        </SessionProvider>
    );
}
