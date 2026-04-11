"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { Users, UtensilsCrossed, Clock, Armchair, SparklesIcon } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RestaurantTable {
  id: string;
  number: number;
  name: string;
  capacity: number;
  floor: string | null;
  section: string | null;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  isActive: boolean;
  sortOrder: number;
  guestCount: number | null;
  currentOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG = {
  AVAILABLE: {
    color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
    badge: "bg-green-500 text-white",
    labelKey: "restaurant.available",
    icon: Armchair,
  },
  OCCUPIED: {
    color: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
    badge: "bg-amber-500 text-white",
    labelKey: "restaurant.occupied",
    icon: UtensilsCrossed,
  },
  RESERVED: {
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    badge: "bg-blue-500 text-white",
    labelKey: "restaurant.reserved",
    icon: Clock,
  },
  CLEANING: {
    color: "bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600",
    badge: "bg-gray-500 text-white",
    labelKey: "restaurant.cleaning",
    icon: SparklesIcon,
  },
};

function getTimeElapsed(updatedAt: string): string | null {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return null; // handled by caller
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

export default function RestaurantDashboardPage() {
  const { t } = useLanguage();
  const { data: tables, isLoading, mutate } = useSWR<RestaurantTable[]>(
    "/api/restaurant/tables",
    fetcher,
    { refreshInterval: 5000 }
  );

  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    table: RestaurantTable | null;
  }>({ open: false, table: null });
  const [newStatus, setNewStatus] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const totalTables = tables?.length ?? 0;
  const availableCount = tables?.filter((t) => t.status === "AVAILABLE").length ?? 0;
  const occupiedCount = tables?.filter((t) => t.status === "OCCUPIED").length ?? 0;
  const reservedCount = tables?.filter((t) => t.status === "RESERVED").length ?? 0;

  const handleTableClick = (table: RestaurantTable) => {
    setStatusDialog({ open: true, table });
    setNewStatus(table.status);
  };

  const handleStatusUpdate = async () => {
    if (!statusDialog.table) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/restaurant/tables/${statusDialog.table.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      toast.success(t("restaurant.tableStatusUpdated"));
      mutate();
      setStatusDialog({ open: false, table: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("restaurant.failedToUpdateStatus"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("restaurant.dashboard")}</h1>
        <p className="text-muted-foreground">{t("restaurant.tableOverview")}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Armchair className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("restaurant.totalTables")}</p>
                <p className="text-2xl font-bold">{isLoading ? "-" : totalTables}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Armchair className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("restaurant.available")}</p>
                <p className="text-2xl font-bold text-green-600">{isLoading ? "-" : availableCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <UtensilsCrossed className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("restaurant.occupied")}</p>
                <p className="text-2xl font-bold text-amber-600">{isLoading ? "-" : occupiedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("restaurant.reserved")}</p>
                <p className="text-2xl font-bold text-blue-600">{isLoading ? "-" : reservedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-16 mb-2" />
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-5 w-20" />
            </Card>
          ))}
        </div>
      ) : !tables || tables.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Armchair className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t("restaurant.noTablesConfigured")}</h3>
            <p className="text-muted-foreground">
              {t("restaurant.goToTableManagement")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {tables.map((table) => {
            const config = STATUS_CONFIG[table.status];
            const StatusIcon = config.icon;
            return (
              <Card
                key={table.id}
                className={`cursor-pointer transition-all hover:shadow-md border-2 ${config.color}`}
                onClick={() => handleTableClick(table)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold">#{table.number}</span>
                    <StatusIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium truncate mb-2">{table.name}</p>
                  <div className="flex items-center justify-between">
                    <Badge className={`text-xs ${config.badge}`}>
                      {t(config.labelKey)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>
                      {table.capacity} {t("restaurant.seats")}
                    </span>
                  </div>
                  {table.status === "OCCUPIED" && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      <span>{getTimeElapsed(table.updatedAt) ?? t("restaurant.justNow")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog
        open={statusDialog.open}
        onOpenChange={(open) => {
          if (!open) setStatusDialog({ open: false, table: null });
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Update Table #{statusDialog.table?.number} - {statusDialog.table?.name}
            </DialogTitle>
            <DialogDescription>
              {t("restaurant.changeTableStatus")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={t("restaurant.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">{t("restaurant.available")}</SelectItem>
                  <SelectItem value="OCCUPIED">{t("restaurant.occupied")}</SelectItem>
                  <SelectItem value="RESERVED">{t("restaurant.reserved")}</SelectItem>
                  <SelectItem value="CLEANING">{t("restaurant.cleaning")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialog({ open: false, table: null })}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleStatusUpdate} disabled={isUpdating}>
              {isUpdating ? t("restaurant.updating") : t("restaurant.updateStatus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
