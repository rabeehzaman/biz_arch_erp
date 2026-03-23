"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function SubscriptionBanner() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [bannerData, setBannerData] = useState<{
    daysRemaining: number;
    isWarning: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const role = (session?.user as { role?: string })?.role;

  useEffect(() => {
    // Superadmin never sees the banner
    if (!session?.user || role === "superadmin") return;

    // Check if already dismissed today
    const today = new Date().toISOString().slice(0, 10);
    const dismissKey = `sub-banner-dismissed-${today}`;
    if (sessionStorage.getItem(dismissKey)) {
      setDismissed(true);
      return;
    }

    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.isWarning && data.daysRemaining !== null) {
          setBannerData({
            daysRemaining: data.daysRemaining,
            isWarning: true,
          });
        }
      })
      .catch(() => {});
  }, [session, role]);

  if (!bannerData?.isWarning || dismissed) return null;

  const handleDismiss = () => {
    const today = new Date().toISOString().slice(0, 10);
    sessionStorage.setItem(`sub-banner-dismissed-${today}`, "1");
    setDismissed(true);
  };

  const message =
    bannerData.daysRemaining === 0
      ? t("subscription.bannerExpiresToday")
      : t("subscription.bannerWarning").replace(
          "{days}",
          String(bannerData.daysRemaining)
        );

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 hover:bg-amber-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
