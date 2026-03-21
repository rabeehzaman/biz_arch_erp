"use client";

import { useState, useEffect, useRef } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useLanguage } from "@/lib/i18n";

export function NetworkStatusBanner() {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) wasOfflineRef.current = true;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setShowBackOnline(true);
        setTimeout(() => setShowBackOnline(false), 2000);
      }
      wasOfflineRef.current = false;
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setShowBackOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isMobile) return null;

  const showBanner = !isOnline || showBackOnline;

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[60] transition-transform duration-300 ease-in-out ${
        showBanner ? "translate-y-0" : "-translate-y-full"
      }`}
      style={{ paddingTop: "var(--app-safe-area-top)" }}
    >
      <div
        className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white ${
          !isOnline ? "bg-red-500" : "bg-green-500"
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>{t("common.offline")}</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>{t("common.backOnline")}</span>
          </>
        )}
      </div>
    </div>
  );
}
