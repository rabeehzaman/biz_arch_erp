"use client";

import { Armchair, ArrowLeft, Clock, History, Languages, Loader2, LogOut, MapPin, PauseCircle, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useEdition } from "@/hooks/use-edition";

interface POSHeaderProps {
  session: {
    id: string;
    sessionNumber: string;
  } | null;
  branchName?: string;
  warehouseName?: string;
  employeeName?: string | null;
  heldOrdersCount: number;
  onHeldOrdersClick: () => void;
  onCloseSession: () => void;
  onBackToSessions?: () => void;
  onReprintReceipt?: () => void;
  isReprintLoading?: boolean;
  onReturn?: () => void;
  isReturnMode?: boolean;
  onPreviousOrders?: () => void;
  selectedTable?: { number: number; name: string } | null;
  isRestaurantMode?: boolean;
  onTableClick?: () => void;
}

function POSClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>;
}

export function POSHeader({
  session,
  branchName,
  warehouseName,
  employeeName,
  heldOrdersCount,
  onHeldOrdersClick,
  onCloseSession,
  onBackToSessions,
  onReprintReceipt,
  isReprintLoading,
  onReturn,
  isReturnMode,
  onPreviousOrders,
  selectedTable,
  isRestaurantMode,
  onTableClick,
}: POSHeaderProps) {
  const { data: authSession } = useSession();
  const { t, lang, setLanguage } = useLanguage();
  const { config: editionConfig } = useEdition();
  const router = useRouter();

  const locationLabel = [branchName, warehouseName].filter(Boolean).join(" / ");

  return (
    <header className="flex min-h-14 items-center justify-between border-b bg-slate-900 px-2 pt-[var(--app-safe-area-top)] sm:px-3 text-white gap-1 sm:gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {onBackToSessions && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={onBackToSessions}
            title={t("pos.backToSessions")}
            aria-label={t("pos.backToSessions")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="relative hidden h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white p-0.5 shadow-sm md:flex">
          <Image src="/bizarch-mark.svg" alt="BizArch Logo" fill sizes="32px" className="object-contain" priority />
        </div>
        <span className="hidden md:inline text-sm font-bold truncate sm:text-base sm:whitespace-nowrap">{t("pos.title")}</span>
        {session && (
          <Badge variant="secondary" className="hidden xs:inline-flex shrink-0 text-xs">
            {session.sessionNumber}
          </Badge>
        )}
        {locationLabel && (
          <div className="hidden sm:flex items-center gap-1 text-sm text-slate-300 truncate max-w-[200px]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </div>
        )}
        {isRestaurantMode && (
          <button
            onClick={onTableClick}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              selectedTable
                ? "bg-orange-500 text-white hover:bg-orange-400"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
            )}
          >
            <Armchair className="h-3.5 w-3.5" />
            {selectedTable ? `T${selectedTable.number}` : "Table"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-300">
          <Clock className="h-4 w-4" />
          <POSClock />
        </div>

        {onReturn && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2",
              isReturnMode
                ? "bg-red-600 text-white hover:bg-red-700 hover:text-white"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            )}
            onClick={onReturn}
            title={t("pos.salesReturn")}
            aria-label={t("pos.salesReturn")}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">
              {isReturnMode ? t("pos.salesReturn") : t("pos.salesReturn").split(" ")[0]}
            </span>
          </Button>
        )}

        {onPreviousOrders && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800 px-2"
            onClick={onPreviousOrders}
            title={t("pos.previousOrders")}
            aria-label={t("pos.previousOrders")}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">{t("pos.previousOrders")}</span>
          </Button>
        )}

        {(onReprintReceipt || isReprintLoading) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800 px-2"
            onClick={onReprintReceipt}
            disabled={isReprintLoading}
            title={t("pos.reprintReceipt")}
            aria-label={t("pos.reprintReceipt")}
          >
            {isReprintLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Printer className="h-4 w-4" />}
            <span className="sr-only">{t("pos.reprintReceipt")}</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 relative px-2"
          onClick={onHeldOrdersClick}
          aria-label={t("pos.heldOrders")}
          title={t("pos.heldOrders")}
        >
          <PauseCircle className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">{t("pos.heldOrders").split(" ")[0]}</span>
          <span className="sr-only">{t("pos.heldOrders")}</span>
          {heldOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold">
              {heldOrdersCount}
            </span>
          )}
        </Button>

        <div className="hidden sm:block text-sm text-slate-300 truncate max-w-[100px]">
          {employeeName || authSession?.user?.name}
        </div>

        {editionConfig.isLanguageSwitchable && (
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 px-2"
          onClick={() => setLanguage(lang === "en" ? "ar" : "en")}
          title={lang === "en" ? "العربية" : "English"}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">{lang === "en" ? "ع" : "EN"}</span>
        </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 px-2"
          onClick={onCloseSession}
          aria-label={t("pos.endSession")}
          title={t("pos.endSession")}
        >
          <LogOut className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">{t("pos.endSession")}</span>
          <span className="sr-only sm:hidden">{t("pos.endSession")}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => router.push("/")}
          title={t("pos.exitPos")}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
