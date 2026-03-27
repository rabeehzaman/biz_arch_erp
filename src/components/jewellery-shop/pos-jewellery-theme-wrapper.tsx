"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { JewelleryThemeProvider } from "./jewellery-theme-provider";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function POSJewelleryThemeWrapper({ children }: { children: React.ReactNode }) {
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
