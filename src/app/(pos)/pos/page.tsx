"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
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
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [openingState, setOpeningState] = useState<OpeningState | null>(null);

  const { data, isLoading, mutate } = useSWR<DashboardData>(
    "/api/pos/dashboard",
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
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Point of Sale</h1>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search registers..."
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
            <p className="text-sm">No registers found</p>
            {searchQuery && (
              <p className="text-xs mt-1">Try a different search term</p>
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
                          Opening Control
                        </Badge>
                      )}
                      {session && stale && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          To Close
                        </Badge>
                      )}
                      {session && !stale && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
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
                              {formatDistanceToNow(new Date(session.openedAt), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>
                              {Number(session.openingCash).toLocaleString("en-IN", {
                                style: "currency",
                                currency: "INR",
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">
                              {Number(session.totalSales).toLocaleString("en-IN", {
                                style: "currency",
                                currency: "INR",
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span>{session.totalTransactions} orders</span>
                          </div>
                        </div>

                        {/* Continue button */}
                        <Button
                          className="w-full"
                          onClick={() => router.push(`/pos/terminal?sessionId=${session.id}`)}
                        >
                          Continue Selling
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
                                Opening Cash
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
                                Cancel
                              </Button>
                              <Button
                                className="flex-1"
                                onClick={() => openRegister(loc)}
                                disabled={openingState?.isOpening}
                              >
                                {openingState?.isOpening && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Open
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
                            Open Register
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
