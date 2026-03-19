"use client";

import { useSession } from "next-auth/react";
import { JewelleryThemeProvider } from "@/components/jewellery-shop/jewellery-theme-provider";

export default function JewelleryShopLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Theme settings would ideally come from org config, but we use session-available defaults
  // The actual theme preset/color could be fetched via SWR if needed
  const isEnabled = (session?.user as { isJewelleryModuleEnabled?: boolean })?.isJewelleryModuleEnabled ?? false;

  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Jewellery module is not enabled for this organization.</p>
      </div>
    );
  }

  return (
    <JewelleryThemeProvider enabled={true} preset="gold" customColor={null}>
      {children}
    </JewelleryThemeProvider>
  );
}
