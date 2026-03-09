"use client";

import { useEffect, useRef } from "react";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { SWRProvider } from "@/lib/swr-config";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { LanguageProvider, useLanguage } from "@/lib/i18n";

function DashboardBackdrop() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_88%_8%,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_76%_82%,rgba(251,191,36,0.12),transparent_20%)]" />
            <div className="absolute inset-x-[12%] top-[-9rem] h-72 rounded-full bg-cyan-200/35 blur-3xl" />
            <div className="absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-emerald-200/25 blur-3xl" />
            <div className="absolute bottom-[-8rem] right-[-2rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/60 to-transparent" />
        </div>
    );
}

function DashboardInner({ children }: { children: React.ReactNode }) {
    const { dir } = useLanguage();
    const pathname = usePathname();
    const mainRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    return (
        <div className="relative h-screen overflow-hidden" dir={dir}>
            <DashboardBackdrop />
            <div className="relative flex h-full min-h-0">
                <Sidebar />
                <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Header />
                    <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-6 md:px-6 md:pb-8">
                        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
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
