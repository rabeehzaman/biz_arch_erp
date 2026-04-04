"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import useSWR from "swr";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  Loader2,
  Search,
  ArrowLeft,
  Download,
  Store,
  Clock,
  DollarSign,
  ShoppingBag,
  User,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronRight,
  Printer,
  Settings2,
  X,
  LogOut,
  Languages,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { printPOSSessionReport } from "@/lib/print-session-report";
import { PrinterSettingsDialog } from "@/components/pos/printer-settings-dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SYSTEM_DEFAULT_VALUE = "__system_default__";

interface RegisterConfig {
  id: string;
  defaultCashAccountId: string | null;
  defaultBankAccountId: string | null;
  defaultCashAccount: { id: string; name: string } | null;
  defaultBankAccount: { id: string; name: string } | null;
}

interface Location {
  branchId: string | null;
  branchName: string;
  branchCode: string;
  warehouseId: string | null;
  warehouseName: string | null;
  warehouseCode: string | null;
  registerConfig: RegisterConfig | null;
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
  employee: { id: string; name: string } | null;
  branch: { id: string; name: string; code: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
}

interface DashboardData {
  locations: Location[];
  openSessions: OpenSession[];
  posEmployeePinRequired: boolean;
}

interface CashBankAccountOption {
  id: string;
  name: string;
  accountSubType: string;
}

type OpeningState = {
  locationKey: string;
  openingCash: string;
  pinCode: string;
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
  const { t, lang, setLanguage } = useLanguage();
  const router = useRouter();
  const { data: session } = useSession();
  const isPosRole = session?.user?.role === "pos";
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [openingState, setOpeningState] = useState<OpeningState | null>(null);
  const [sessionsLocationKey, setSessionsLocationKey] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [configLocationKey, setConfigLocationKey] = useState<string | null>(null);
  const [configCashAccountId, setConfigCashAccountId] = useState(SYSTEM_DEFAULT_VALUE);
  const [configBankAccountId, setConfigBankAccountId] = useState(SYSTEM_DEFAULT_VALUE);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);

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
  const { data: cashBankAccounts = [] } = useSWR<CashBankAccountOption[]>(
    configLocationKey ? "/api/cash-bank-accounts?activeOnly=true" : null,
    fetcher
  );

   
  const { data: sessionSummary, isLoading: isLoadingSummary } = useSWR<any>(
    selectedSessionId ? `/api/pos/sessions/${selectedSessionId}/summary` : null,
    fetcher
  );
  const { data: companySettings } = useSWR(
    selectedSessionId ? "/api/settings" : null,
    fetcher
  );
  const { data: sessionReportLanguageSetting } = useSWR<{ value: "en" | "ar" }>(
    selectedSessionId ? "/api/settings/pos-session-report-language" : null,
    fetcher
  );

  const locations = useMemo(() => data?.locations ?? [], [data?.locations]);
  const openSessions = useMemo(() => data?.openSessions ?? [], [data?.openSessions]);
  const pinRequired = data?.posEmployeePinRequired ?? false;
  const selectedConfigLocation = useMemo(
    () => locations.find((loc) => getLocationKey(loc) === configLocationKey) ?? null,
    [locations, configLocationKey]
  );
  const filtered = useMemo(() => {
    if (!deferredSearchQuery) {
      return locations;
    }

    return locations.filter((location) => {
      return (
        location.branchName.toLowerCase().includes(deferredSearchQuery) ||
        location.branchCode.toLowerCase().includes(deferredSearchQuery) ||
        (location.warehouseName?.toLowerCase().includes(deferredSearchQuery) ?? false) ||
        (location.warehouseCode?.toLowerCase().includes(deferredSearchQuery) ?? false)
      );
    });
  }, [locations, deferredSearchQuery]);
  const sessionMap = useMemo(() => {
    return new Map(openSessions.map((session) => [getSessionLocationKey(session), session]));
  }, [openSessions]);

  const openRegister = async (loc: Location) => {
    const key = getLocationKey(loc);
    const cash = openingState?.locationKey === key ? parseFloat(openingState.openingCash) || 0 : 0;
    const pin = openingState?.locationKey === key ? openingState.pinCode : "";

    if (pinRequired && !pin) {
      toast.error(t("pos.pinCodeRequired"));
      return;
    }

    setOpeningState((prev) =>
      prev?.locationKey === key ? { ...prev, isOpening: true } : prev
    );

    try {
      const res = await fetch("/api/pos/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingCash: cash,
          pinCode: pin || undefined,
          branchId: loc.branchId || undefined,
          warehouseId: loc.warehouseId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("pos.failedToOpenSession"));
      }

      const session = await res.json();
      toast.success(t("pos.sessionOpened"));
      router.push(`/pos/terminal?sessionId=${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pos.failedToOpenSession"));
      setOpeningState((prev) =>
        prev?.locationKey === key ? { ...prev, isOpening: false } : prev
      );
    }
  };

  const openRegisterConfig = (loc: Location) => {
    setConfigLocationKey(getLocationKey(loc));
    setConfigCashAccountId(
      loc.registerConfig?.defaultCashAccountId || SYSTEM_DEFAULT_VALUE
    );
    setConfigBankAccountId(
      loc.registerConfig?.defaultBankAccountId || SYSTEM_DEFAULT_VALUE
    );
  };

  const handleDownloadSessionReport = async () => {
    if (!selectedSessionId) return;

    setIsDownloadingReport(true);
    try {
      const response = await fetch(`/api/pos/sessions/${selectedSessionId}/pdf`);
      if (!response.ok) {
        throw new Error(t("pos.failedToDownloadSessionReport"));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pos-session-${sessionSummary?.session?.sessionNumber || selectedSessionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      toast.success(t("pos.sessionReportDownloaded"));
    } catch (error) {
      console.error("Failed to download POS session report:", error);
      toast.error(t("pos.failedToDownloadSessionReport"));
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handlePrintSessionReport = async () => {
    if (!selectedSessionId || !sessionSummary) return;

    setIsPrintingReport(true);
    try {
      const result = await printPOSSessionReport({
        report: sessionSummary,
        company: {
          companyName: companySettings?.companyName,
          companyAddress: companySettings?.companyAddress,
          companyCity: companySettings?.companyCity,
          companyState: companySettings?.companyState,
          companyPhone: companySettings?.companyPhone,
          companyGstNumber: companySettings?.companyGstNumber,
        },
        language: sessionReportLanguageSetting?.value === "ar" ? "ar" : "en",
      });

      if (!result.success) {
        throw new Error(result.error || t("pos.failedToPrintSessionReport"));
      }
    } catch (error) {
      console.error("Failed to print POS session report:", error);
      toast.error(t("pos.failedToPrintSessionReport"));
    } finally {
      setIsPrintingReport(false);
    }
  };

  const closeSessionHistoryDialog = () => {
    setSessionsLocationKey(null);
    setSelectedSessionId(null);
  };

  const saveRegisterConfig = async () => {
    if (!selectedConfigLocation) return;

    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/pos/register-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedConfigLocation.branchId,
          warehouseId: selectedConfigLocation.warehouseId,
          defaultCashAccountId:
            configCashAccountId === SYSTEM_DEFAULT_VALUE ? null : configCashAccountId,
          defaultBankAccountId:
            configBankAccountId === SYSTEM_DEFAULT_VALUE ? null : configBankAccountId,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || t("pos.failedToSaveRegisterAccounts"));
      }

      await mutate();
      setConfigLocationKey(null);
      toast.success(t("pos.registerAccountsSaved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("pos.failedToSaveRegisterAccounts")
      );
    } finally {
      setIsSavingConfig(false);
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
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden bg-slate-100">
      {/* Top Bar */}
      <header className="flex flex-col gap-3 border-b bg-white px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex items-center gap-3">
          {!isPosRole && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => router.push("/")}
              title={t("common.back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-bold">{t("pos.title")}</h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="relative w-full min-w-[160px] sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("pos.searchRegisters")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setPrinterSettingsOpen(true)}
            title={t("pos.thermalPrinterConfig")}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            {t("pos.thermalPrinterConfig")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setLanguage(lang === "en" ? "ar" : "en")}
            title={lang === "en" ? "العربية" : "English"}
          >
            <Languages className="h-4 w-4 mr-1.5" />
            {lang === "en" ? "العربية" : "English"}
          </Button>
          {isPosRole && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              {t("nav.signOut")}
            </Button>
          )}
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
                    "rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300",
                    session && stale && "border-red-200 hover:border-red-300",
                    isOpeningThis && !session && "ring-2 ring-primary"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex flex-col gap-3 p-4 pb-2 sm:flex-row sm:items-start sm:justify-between">
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
                    <div className="flex flex-wrap items-center gap-1 sm:ml-2 sm:shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900"
                        onClick={() => openRegisterConfig(loc)}
                        title={t("pos.registerAccounts")}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
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
                            {(session.employee?.name || session.user.name)?.charAt(0)?.toUpperCase() || <User className="h-3 w-3" />}
                          </div>
                          <span>{session.employee?.name || session.user.name || session.user.email}</span>
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
                                step="0.001"
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
                            {pinRequired && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground mt-2 block">
                                  {t("pos.employeePin")}
                                </label>
                                <Input
                                  type="password"
                                  inputMode="numeric"
                                  placeholder={t("pos.enterFourDigitPin")}
                                  value={openingState?.pinCode ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "");
                                    setOpeningState((prev) =>
                                      prev ? { ...prev, pinCode: val } : prev
                                    );
                                  }}
                                  className="mt-1 font-mono"
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
                            )}
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
                                pinCode: "",
                                isOpening: false,
                              })
                            }
                          >
                            {t("pos.openRegister")}
                          </Button>
                        )}
                      </>
                    )}

                    <div className="mt-3 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <span>{t("payments.cash")}</span>
                        <span className="truncate text-right font-medium text-slate-800">
                          {loc.registerConfig?.defaultCashAccount?.name || t("pos.systemDefault")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span>{t("common.bank")}</span>
                        <span className="truncate text-right font-medium text-slate-800">
                          {loc.registerConfig?.defaultBankAccount?.name || t("pos.systemDefault")}
                        </span>
                      </div>
                    </div>
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

      <Dialog
        open={configLocationKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfigLocationKey(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pos.registerAccounts")}</DialogTitle>
            <DialogDescription>
              {t("pos.registerAccountsDesc")}
            </DialogDescription>
          </DialogHeader>

          {selectedConfigLocation && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                <div className="font-medium">{selectedConfigLocation.branchName}</div>
                {selectedConfigLocation.warehouseName && (
                  <div className="text-muted-foreground">{selectedConfigLocation.warehouseName}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("pos.storeSafeAccount")}</Label>
                <Select value={configCashAccountId} onValueChange={setConfigCashAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("pos.selectCashAccountPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SYSTEM_DEFAULT_VALUE}>{t("pos.systemDefault")}</SelectItem>
                    {cashBankAccounts
                      .filter((account) => account.accountSubType === "CASH")
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("pos.defaultBankAccount")}</Label>
                <Select value={configBankAccountId} onValueChange={setConfigBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("pos.selectBankAccountPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SYSTEM_DEFAULT_VALUE}>{t("pos.systemDefault")}</SelectItem>
                    {cashBankAccounts
                      .filter((account) => account.accountSubType === "BANK")
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setConfigLocationKey(null)}
              disabled={isSavingConfig}
              className="w-full sm:w-auto"
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={saveRegisterConfig} disabled={isSavingConfig} className="w-full sm:w-auto">
              {isSavingConfig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("pos.saveAccounts")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrinterSettingsDialog open={printerSettingsOpen} onOpenChange={setPrinterSettingsOpen} />

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
        <DialogContent showCloseButton={false} className="sm:max-w-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-2xl font-semibold text-slate-900">
                {selectedSessionId ? t("pos.sessionDetail") : t("pos.sessionHistory")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500 not-sr-only">
                {selectedSessionId ? t("pos.backToList") : t("pos.sessionHistory")}
              </DialogDescription>
            </DialogHeader>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={closeSessionHistoryDialog}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t("common.close")}</span>
            </Button>
          </div>

          <div className="mt-2">
            {selectedSessionId ? (
              isLoadingSummary ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessionSummary ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-slate-300 hover:bg-white hover:text-foreground"
                      onClick={() => setSelectedSessionId(null)}
                    >
                      {lang === "ar" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      {t("pos.backToList")}
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrintSessionReport}
                        disabled={isPrintingReport || isDownloadingReport}
                      >
                        {isPrintingReport ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="mr-2 h-4 w-4" />
                        )}
                        {t("common.print")}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleDownloadSessionReport}
                        disabled={isDownloadingReport || isPrintingReport}
                      >
                        {isDownloadingReport ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {t("common.download")} PDF
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t("pos.session")}
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.session")}</span>
                          <span className="font-medium text-slate-900">{sessionSummary.session.sessionNumber}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.cashier")}</span>
                          <span className="text-right">{sessionSummary.session.user?.name || sessionSummary.session.user?.email}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("settings.branch")}</span>
                          <span className="text-right">
                            {sessionSummary.session.branch?.name || "-"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("common.warehouse")}</span>
                          <span className="text-right">
                            {sessionSummary.session.warehouse?.name || "-"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.opened")}</span>
                          <span>{format(new Date(sessionSummary.session.openedAt), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                        {sessionSummary.session.closedAt && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{t("pos.closedDate")}</span>
                            <span>{format(new Date(sessionSummary.session.closedAt), "dd/MM/yyyy HH:mm")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t("pos.paymentBreakdown")}
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.openingCash")}</span>
                          <span>{fmt(Number(sessionSummary.session.openingCash))}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.expectedCash")}</span>
                          <span>{fmt(Number(sessionSummary.session.expectedCash ?? 0))}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.closingCash")}</span>
                          <span>{fmt(Number(sessionSummary.session.closingCash ?? 0))}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-slate-200/80 pt-3">
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
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t("pos.invoiceCount")}</span>
                          <span>{sessionSummary.invoices?.length ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {sessionSummary.paymentBreakdown?.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">{t("pos.paymentBreakdown")}</h4>
                      <div className="divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {sessionSummary.paymentBreakdown.map((pb: any) => (
                          <div key={pb.method} className="flex justify-between px-4 py-3 text-sm">
                            <span>{pb.method} ({pb.count})</span>
                            <span className="font-medium">{fmt(pb.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sessionSummary.topProducts?.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">{t("pos.topProducts")}</h4>
                      <div className="divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
                        <div className="flex bg-muted/45 px-4 py-2 text-xs font-medium text-muted-foreground">
                          <span className="flex-1">{t("common.product")}</span>
                          <span className="w-20 text-center">{t("pos.qtySold")}</span>
                          <span className="w-24 text-end">{t("pos.revenue")}</span>
                        </div>
                        {sessionSummary.topProducts.map((p: any, i: number) => (
                          <div key={i} className="flex items-center px-4 py-3">
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
            ) : isLoadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !closedSessions?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="mb-3 h-10 w-10 opacity-30" />
                <p className="font-medium">{t("pos.noClosedSessions")}</p>
                <p className="mt-1 text-xs">{t("pos.noClosedSessionsDesc")}</p>
              </div>
            ) : (
              <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                {closedSessions.map((s: any) => {
                  const diff = Number(s.closingCash ?? 0) - Number(s.expectedCash ?? 0);
                  return (
                    <button
                      key={s.id}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-start transition-colors hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <History className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xl font-semibold text-slate-900">{s.sessionNumber}</span>
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                            {s._count?.invoices ?? 0} {t("pos.invoiceCount")}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{s.user?.name || s.user?.email}</span>
                          <span>·</span>
                          <span>
                            {s.closedAt
                              ? format(new Date(s.closedAt), "dd/MM/yyyy HH:mm")
                              : format(new Date(s.openedAt), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-end">
                        <div className="text-2xl font-semibold text-slate-900">{fmt(Number(s.totalSales))}</div>
                        {s.closingCash != null && (
                          <div className={cn(
                            "mt-1 text-sm",
                            diff === 0 && "text-muted-foreground",
                            diff > 0 && "text-green-600",
                            diff < 0 && "text-red-600"
                          )}>
                            {diff > 0 ? "+" : ""}{fmt(diff)}
                          </div>
                        )}
                      </div>

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-muted-foreground transition-colors group-hover:border-sky-200 group-hover:text-sky-700">
                        {lang === "ar" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
