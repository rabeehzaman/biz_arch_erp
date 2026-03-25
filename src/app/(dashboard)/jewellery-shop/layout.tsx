"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Gem } from "lucide-react";
import { JewelleryThemeProvider } from "@/components/jewellery-shop/jewellery-theme-provider";

export default function JewelleryShopLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Theme settings would ideally come from org config, but we use session-available defaults
  // The actual theme preset/color could be fetched via SWR if needed
  const isEnabled = (session?.user as { isJewelleryModuleEnabled?: boolean })?.isJewelleryModuleEnabled ?? false;

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Gem className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Jewellery Module</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          The jewellery module is not enabled for this organization. Contact your administrator to enable gold rate management, jewellery inventory, karigar tracking, and more.
        </p>
        <Link href="/settings" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <JewelleryThemeProvider enabled={true} preset="gold" customColor={null}>
      {children}
    </JewelleryThemeProvider>
  );
}
