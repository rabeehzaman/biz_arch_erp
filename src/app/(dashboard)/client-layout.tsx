"use client";

import { useEffect, useRef } from "react";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileLayout } from "@/components/mobile-layout";
import { SWRProvider } from "@/lib/swr-config";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-is-mobile";

function DashboardBackdrop() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.1),transparent_18%),linear-gradient(180deg,rgba(2,6,23,0.97),rgba(8,15,28,1))]" />
            <div className="absolute inset-x-[18%] top-[-8rem] h-64 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute bottom-[-10rem] right-[-2rem] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/6 to-transparent" />
        </div>
    );
}

function DesktopLayout({ children }: { children: React.ReactNode }) {
    const { dir } = useLanguage();
    const pathname = usePathname();
    const mainRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (window.matchMedia("(min-width: 1024px)").matches) {
            mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
            return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    return (
        <div className="relative min-h-screen overflow-visible lg:h-screen lg:overflow-hidden" dir={dir}>
            <DashboardBackdrop />
            <div className="relative flex min-h-screen lg:h-full lg:min-h-0">
                <Sidebar />
                <div className="relative flex min-w-0 flex-1 flex-col overflow-visible lg:overflow-hidden">
                    <Header />
                    <main ref={mainRef} className="flex-1 overflow-visible bg-white/96 px-4 pt-5 pb-6 shadow-[0_0_0_1px_rgba(226,232,240,0.6),0_26px_70px_-46px_rgba(2,6,23,0.7)] overscroll-y-contain md:px-6 md:pt-6 md:pb-8 lg:min-h-0 lg:overflow-y-auto">
                        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
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
                <LanguageProvider initialLang={initialLang}>
                    <CommandPaletteProvider>
                        <DashboardInner>{children}</DashboardInner>
                        <CommandPalette />
                    </CommandPaletteProvider>
                </LanguageProvider>
            </SWRProvider>
        </SessionProvider>
    );
}
