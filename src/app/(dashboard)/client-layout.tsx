"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { SWRProvider } from "@/lib/swr-config";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { LanguageProvider, useLanguage } from "@/lib/i18n";

function DashboardInner({ children }: { children: React.ReactNode }) {
    const { dir } = useLanguage();

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100" dir={dir}>
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
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
