"use client";

import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import useSWR from "swr";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  Loader2,
  Search,
  ArrowLeft,
  Store,
  Clock,
  DollarSign,
  ShoppingBag,
  User,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Location {
  branchId: string | null;
  branchName: string;
  branchCode: string;
  warehouseId: string | null;
  warehouseName: string | null;
  warehouseCode: string | null;
}

interface OpenSession {
  id: string;
  sessionNumber: string;
  openedAt: string;
  openingCash: number;
  totalSales: number;
  totalTransactions: number;
  branchId: string | null;
  warehouseId: string | null;
  user: { id: string; name: string; email: string };
  branch: { id: string; name: string; code: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
}

interface DashboardData {
  locations: Location[];
  openSessions: OpenSession[];
}

type OpeningState = {
  locationKey: string;
  openingCash: string;
  isOpening: boolean;
};

function getLocationKey(loc: Location): string {
  return `${loc.branchId || "null"}-${loc.warehouseId || "null"}`;
}

function getSessionLocationKey(s: OpenSession): string {
  return `${s.branchId || "null"}-${s.warehouseId || "null"}`;
}

function isStale(openedAt: string): boolean {
  const hours = (Date.now() - new Date(openedAt).getTime()) / (1000 * 60 * 60);
  return hours > 24;
}

export default function POSDashboardPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [openingState, setOpeningState] = useState<OpeningState | null>(null);
  const [sessionsLocationKey, setSessionsLocationKey] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<DashboardData>(
    "/api/pos/dashboard",
    fetcher
  );

  // Parse branchId/warehouseId from the location key for session history
  const sessionsBranchId = sessionsLocationKey?.split("-")[0] ?? null;
  const sessionsWarehouseId = sessionsLocationKey?.split("-")[1] ?? null;

  const { data: closedSessions, isLoading: isLoadingSessions } = useSWR(
    sessionsLocationKey
      ? `/api/pos/sessions?status=CLOSED&branchId=${sessionsBranchId}&warehouseId=${sessionsWarehouseId}&limit=50`
      : null,
    fetcher
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionSummary, isLoading: isLoadingSummary } = useSWR<any>(
    selectedSessionId ? `/api/pos/sessions/${selectedSessionId}/summary` : null,
    fetcher
  );

  const locations = data?.locations ?? [];
  const openSessions = data?.openSessions ?? [];

  // Filter locations by search
  const filtered = searchQuery
    ? locations.filter((loc) => {
      const q = searchQuery.toLowerCase();
      return (
        loc.branchName.toLowerCase().includes(q) ||
        loc.branchCode.toLowerCase().includes(q) ||
        (loc.warehouseName?.toLowerCase().includes(q) ?? false) ||
        (loc.warehouseCode?.toLowerCase().includes(q) ?? false)
      );
    })
    : locations;

  // Map sessions to locations
  const sessionMap = new Map<string, OpenSession>();
  for (const s of openSessions) {
    sessionMap.set(getSessionLocationKey(s), s);
  }

  const openRegister = async (loc: Location) => {
    const key = getLocationKey(loc);
    const cash = openingState?.locationKey === key ? parseFloat(openingState.openingCash) || 0 : 0;

    setOpeningState((prev) =>
      prev?.locationKey === key ? { ...prev, isOpening: true } : prev
    );

    try {
      const res = await fetch("/api/pos/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingCash: cash,
          branchId: loc.branchId || undefined,
          warehouseId: loc.warehouseId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to open session");
      }

      const session = await res.json();
      toast.success("POS session opened");
      router.push(`/pos/terminal?sessionId=${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open session");
      setOpeningState((prev) =>
        prev?.locationKey === key ? { ...prev, isOpening: false } : prev
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => router.push("/")}
            title={t("common.back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{t("pos.title")}</h1>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("pos.searchRegisters")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </header>

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Store className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">{t("pos.noRegistersFound")}</p>
            {searchQuery && (
              <p className="text-xs mt-1">{t("pos.tryDifferentSearch")}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((loc) => {
              const key = getLocationKey(loc);
              const session = sessionMap.get(key);
              const stale = session ? isStale(session.openedAt) : false;
              const isOpeningThis = openingState?.locationKey === key;

              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
                    session && stale && "border-red-200",
                    isOpeningThis && !session && "ring-2 ring-primary"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between p-4 pb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base truncate">
                        {loc.branchName}
                      </h3>
                      {loc.warehouseName && (
                        <p className="text-sm text-muted-foreground truncate">
                          {loc.warehouseName}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 ml-2">
                      {!session && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {t("pos.openingControl")}
                        </Badge>
                      )}
                      {session && stale && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t("pos.toClose")}
                        </Badge>
                      )}
                      {session && !stale && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {t("common.active")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-4 pb-3">
                    {session ? (
                      <>
                        {/* Session stats */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-1 mb-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {formatDistanceToNow(new Date(session.openedAt), {
                                addSuffix: true,
                                locale: lang === "ar" ? ar : enUS
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>
                              {fmt(Number(session.openingCash))}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">
                              {fmt(Number(session.totalSales))}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span>{session.totalTransactions} {t("pos.orderCount")}</span>
                          </div>
                        </div>

                        {/* Continue button */}
                        <Button
                          className="w-full"
                          onClick={() => router.push(`/pos/terminal?sessionId=${session.id}`)}
                        >
                          {t("pos.continueSelling")}
                        </Button>

                        {/* User indicator */}
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold">
                            {session.user.name?.charAt(0)?.toUpperCase() || <User className="h-3 w-3" />}
                          </div>
                          <span>{session.user.name || session.user.email}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Opening cash input */}
                        {isOpeningThis ? (
                          <div className="space-y-3 mt-1">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                {t("pos.openingCash")}
                              </label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={openingState?.openingCash ?? ""}
                                onChange={(e) =>
                                  setOpeningState((prev) =>
                                    prev ? { ...prev, openingCash: e.target.value } : prev
                                  )
                                }
                                min={0}
                                step="0.01"
                                className="mt-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    openRegister(loc);
                                  }
                                  if (e.key === "Escape") {
                                    setOpeningState(null);
                                  }
                                }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setOpeningState(null)}
                              >
                                {t("common.cancel")}
                              </Button>
                              <Button
                                className="flex-1"
                                onClick={() => openRegister(loc)}
                                disabled={openingState?.isOpening}
                              >
                                {openingState?.isOpening && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {t("pos.openRegister").split(" ")[0]}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full mt-1"
                            onClick={() =>
                              setOpeningState({
                                locationKey: key,
                                openingCash: "",
                                isOpening: false,
                              })
                            }
                          >
                            {t("pos.openRegister")}
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Session History footer */}
                  <div className="border-t px-4 py-2">
                    <button
                      className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      onClick={() => {
                        setSessionsLocationKey(key);
                        setSelectedSessionId(null);
                      }}
                    >
                      <History className="h-3.5 w-3.5" />
                      {t("pos.sessionHistory")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session History Dialog */}
      <Dialog
        open={sessionsLocationKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSessionsLocationKey(null);
            setSelectedSessionId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSessionId ? t("pos.sessionDetail") : t("pos.sessionHistory")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("pos.sessionHistory")}
            </DialogDescription>
          </DialogHeader>

          {selectedSessionId ? (
            /* Detail View */
            isLoadingSummary ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessionSummary ? (
              <div className="space-y-4">
                <button
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSelectedSessionId(null)}
                >
                  {lang === "ar" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  {t("pos.backToList")}
                </button>

                {/* Session info */}
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.session")}</span>
                    <span className="font-medium">{sessionSummary.session.sessionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.cashier")}</span>
                    <span>{sessionSummary.session.user?.name || sessionSummary.session.user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.opened")}</span>
                    <span>{format(new Date(sessionSummary.session.openedAt), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                  {sessionSummary.session.closedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("pos.closedDate")}</span>
                      <span>{format(new Date(sessionSummary.session.closedAt), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                  )}
                </div>

                {/* Financial summary */}
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.openingCash")}</span>
                    <span>{fmt(Number(sessionSummary.session.openingCash))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.expectedCash")}</span>
                    <span>{fmt(Number(sessionSummary.session.expectedCash ?? 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.closingCash")}</span>
                    <span>{fmt(Number(sessionSummary.session.closingCash ?? 0))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">{t("pos.cashDifference")}</span>
                    {(() => {
                      const diff = Number(sessionSummary.session.closingCash ?? 0) - Number(sessionSummary.session.expectedCash ?? 0);
                      return (
                        <span className={cn(
                          "font-medium",
                          diff > 0 && "text-green-600",
                          diff < 0 && "text-red-600"
                        )}>
                          {diff > 0 ? "+" : ""}{fmt(diff)}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("pos.invoiceCount")}</span>
                    <span>{sessionSummary.invoices?.length ?? 0}</span>
                  </div>
                </div>

                {/* Payment Breakdown */}
                {sessionSummary.paymentBreakdown?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t("pos.paymentBreakdown")}</h4>
                    <div className="rounded-lg border divide-y text-sm">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {sessionSummary.paymentBreakdown.map((pb: any) => (
                        <div key={pb.method} className="flex justify-between px-3 py-2">
                          <span>{pb.method} ({pb.count})</span>
                          <span className="font-medium">{fmt(pb.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Products */}
                {sessionSummary.topProducts?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t("pos.topProducts")}</h4>
                    <div className="rounded-lg border divide-y text-sm">
                      <div className="flex px-3 py-1.5 text-xs text-muted-foreground font-medium bg-muted/50">
                        <span className="flex-1">{t("common.product")}</span>
                        <span className="w-20 text-center">{t("pos.qtySold")}</span>
                        <span className="w-24 text-end">{t("pos.revenue")}</span>
                      </div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {sessionSummary.topProducts.map((p: any, i: number) => (
                        <div key={i} className="flex px-3 py-2 items-center">
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="w-20 text-center">{p.quantity}</span>
                          <span className="w-24 text-end font-medium">{fmt(p.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null
          ) : (
            /* List View */
            isLoadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !closedSessions?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">{t("pos.noClosedSessions")}</p>
                <p className="text-xs mt-1">{t("pos.noClosedSessionsDesc")}</p>
              </div>
            ) : (
              <div className="divide-y rounded-lg border max-h-[60vh] overflow-y-auto">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {closedSessions.map((s: any) => {
                  const diff = Number(s.closingCash ?? 0) - Number(s.expectedCash ?? 0);
                  return (
                    <button
                      key={s.id}
                      className="flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{s.sessionNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {s._count?.invoices ?? 0} {t("pos.invoiceCount")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{s.user?.name || s.user?.email}</span>
                          <span>·</span>
                          <span>
                            {s.closedAt
                              ? format(new Date(s.closedAt), "dd/MM/yyyy HH:mm")
                              : format(new Date(s.openedAt), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-sm font-medium">{fmt(Number(s.totalSales))}</div>
                        {s.closingCash != null && (
                          <div className={cn(
                            "text-xs",
                            diff === 0 && "text-muted-foreground",
                            diff > 0 && "text-green-600",
                            diff < 0 && "text-red-600"
                          )}>
                            {diff > 0 ? "+" : ""}{fmt(diff)}
                          </div>
                        )}
                      </div>
                      {lang === "ar" ? <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
