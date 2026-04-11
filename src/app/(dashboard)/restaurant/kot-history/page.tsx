"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/table-skeleton";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Printer,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  RefreshCw,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface KOTItem {
  id: string;
  productId: string | null;
  name: string;
  nameAr: string | null;
  quantity: string;
  modifiers: string[] | null;
  notes: string | null;
  isNew: boolean;
  createdAt: string;
}

interface RestaurantTable {
  id: string;
  number: number;
  name: string;
}

interface KOTOrder {
  id: string;
  kotNumber: string;
  tableId: string | null;
  table: RestaurantTable | null;
  posSessionId: string | null;
  kotType: "STANDARD" | "FOLLOWUP" | "VOID";
  orderType: "DINE_IN" | "TAKEAWAY";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  serverName: string | null;
  specialInstructions: string | null;
  printedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: KOTItem[];
}

const STATUS_BADGE: Record<
  string,
  { className: string; label: string }
> = {
  PENDING: {
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Pending",
  },
  IN_PROGRESS: {
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    label: "In Progress",
  },
  COMPLETED: {
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    label: "Completed",
  },
  CANCELLED: {
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    label: "Cancelled",
  },
};

const KOT_TYPE_LABEL: Record<string, string> = {
  STANDARD: "Standard",
  FOLLOWUP: "Follow-up",
  VOID: "Void",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  DINE_IN: "Dine In",
  TAKEAWAY: "Takeaway",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function KOTHistoryPage() {
  const { t } = useLanguage();

  const [dateFilter, setDateFilter] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [expandedKOT, setExpandedKOT] = useState<string | null>(null);
  const [reprintDialog, setReprintDialog] = useState<KOTOrder | null>(null);
  const [isReprinting, setIsReprinting] = useState(false);

  // Build API URL with filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (tableFilter && tableFilter !== "all") params.set("tableId", tableFilter);
    return `/api/restaurant/kot?${params.toString()}`;
  }, [dateFilter, statusFilter, tableFilter]);

  const {
    data: kots,
    isLoading,
    mutate,
  } = useSWR<KOTOrder[]>(apiUrl, fetcher);

  const { data: tables } = useSWR<RestaurantTable[]>(
    "/api/restaurant/tables",
    fetcher
  );

  const toggleExpand = (id: string) => {
    setExpandedKOT(expandedKOT === id ? null : id);
  };

  const handleReprint = async (kot: KOTOrder) => {
    setIsReprinting(true);
    try {
      const res = await fetch(`/api/restaurant/kot/${kot.id}/reprint`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reprint KOT");
      }
      toast.success(`KOT ${kot.kotNumber} marked for reprint`);
      mutate();
      setReprintDialog(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsReprinting(false);
    }
  };

  const handleStatusChange = async (
    kotId: string,
    newStatus: string
  ) => {
    try {
      const res = await fetch(`/api/restaurant/kot/${kotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      toast.success(t("restaurant.kotStatusUpdated"));
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An error occurred"
      );
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("KOT History")}</h1>
          <p className="text-muted-foreground">
            {t("View and manage kitchen order tokens")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("Refresh")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("Date")}</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full sm:w-[180px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("Status")}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("restaurant.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All Statuses")}</SelectItem>
                  <SelectItem value="PENDING">{t("Pending")}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{t("In Progress")}</SelectItem>
                  <SelectItem value="COMPLETED">{t("Completed")}</SelectItem>
                  <SelectItem value="CANCELLED">{t("Cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("Table")}</label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("restaurant.allTables")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All Tables")}</SelectItem>
                  {tables?.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      #{table.number} - {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KOT List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton columns={7} rows={5} />
          ) : !kots || kots.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {t("No KOTs found")}
              </h3>
              <p className="text-muted-foreground">
                {t("No kitchen order tokens match the selected filters.")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>{t("KOT Number")}</TableHead>
                  <TableHead>{t("Table")}</TableHead>
                  <TableHead>{t("Type")}</TableHead>
                  <TableHead className="text-center">
                    {t("Items")}
                  </TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Server")}</TableHead>
                  <TableHead>{t("Time")}</TableHead>
                  <TableHead className="text-right">
                    {t("Actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kots.map((kot) => (
                  <>
                    <TableRow
                      key={kot.id}
                      className="cursor-pointer"
                      onClick={() => toggleExpand(kot.id)}
                    >
                      <TableCell>
                        {expandedKOT === kot.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium font-mono">
                        {kot.kotNumber}
                      </TableCell>
                      <TableCell>
                        {kot.table
                          ? `#${kot.table.number} - ${kot.table.name}`
                          : ORDER_TYPE_LABEL[kot.orderType] || kot.orderType}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {KOT_TYPE_LABEL[kot.kotType] || kot.kotType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {kot.items.length}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            STATUS_BADGE[kot.status]?.className || ""
                          }
                        >
                          {STATUS_BADGE[kot.status]?.label || kot.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{kot.serverName || "-"}</TableCell>
                      <TableCell>{formatTime(kot.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {kot.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleStatusChange(kot.id, "IN_PROGRESS")
                              }
                            >
                              {t("Start")}
                            </Button>
                          )}
                          {kot.status === "IN_PROGRESS" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleStatusChange(kot.id, "COMPLETED")
                              }
                            >
                              {t("Complete")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setReprintDialog(kot)}
                            title={t("Reprint")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded items row */}
                    {expandedKOT === kot.id && (
                      <TableRow key={`${kot.id}-items`}>
                        <TableCell colSpan={9} className="bg-muted/50 p-4">
                          <div className="space-y-3">
                            {kot.specialInstructions && (
                              <p className="text-sm text-muted-foreground italic">
                                {t("Special Instructions")}:{" "}
                                {kot.specialInstructions}
                              </p>
                            )}
                            <div className="rounded-md border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t("Item")}</TableHead>
                                    <TableHead className="w-[80px] text-center">
                                      {t("Qty")}
                                    </TableHead>
                                    <TableHead>{t("Modifiers")}</TableHead>
                                    <TableHead>{t("Notes")}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {kot.items.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>
                                        <div>
                                          <span className="font-medium">
                                            {item.name}
                                          </span>
                                          {item.nameAr && (
                                            <span className="text-muted-foreground ml-2 text-sm">
                                              ({item.nameAr})
                                            </span>
                                          )}
                                          {item.isNew && (
                                            <Badge
                                              variant="secondary"
                                              className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                            >
                                              {t("New")}
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-medium">
                                        {parseFloat(item.quantity)}
                                      </TableCell>
                                      <TableCell>
                                        {item.modifiers &&
                                        item.modifiers.length > 0
                                          ? item.modifiers.join(", ")
                                          : "-"}
                                      </TableCell>
                                      <TableCell>
                                        {item.notes || "-"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reprint Confirmation Dialog */}
      <Dialog
        open={!!reprintDialog}
        onOpenChange={(open) => {
          if (!open) setReprintDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("Reprint KOT")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("Are you sure you want to reprint KOT")}{" "}
            <strong>{reprintDialog?.kotNumber}</strong>?
          </p>
          {reprintDialog && (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                {t("Table")}:{" "}
                {reprintDialog.table
                  ? `#${reprintDialog.table.number} - ${reprintDialog.table.name}`
                  : ORDER_TYPE_LABEL[reprintDialog.orderType]}
              </p>
              <p>
                {t("Items")}: {reprintDialog.items.length}
              </p>
              <p>
                {t("Status")}:{" "}
                {STATUS_BADGE[reprintDialog.status]?.label ||
                  reprintDialog.status}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setReprintDialog(null)}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => reprintDialog && handleReprint(reprintDialog)}
              disabled={isReprinting}
            >
              <Printer className="h-4 w-4 mr-2" />
              {isReprinting ? t("Reprinting...") : t("Reprint")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
