"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { RestaurantThemeProvider } from "./restaurant-theme-provider";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function POSRestaurantThemeWrapper({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const isRestaurantEnabled = (session?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled ?? false;

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
