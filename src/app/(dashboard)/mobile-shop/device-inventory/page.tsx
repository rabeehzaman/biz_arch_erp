"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";
import { Plus, Smartphone, Loader2, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { DeviceFormDialog } from "@/components/mobile-devices/device-form-dialog";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface Device {
  id: string;
  imei1: string;
  imei2: string | null;
  brand: string;
  model: string;
  color: string | null;
  storageCapacity: string | null;
  currentStatus: string;
  conditionGrade: string;
  costPrice: number;
  sellingPrice: number;
  supplier: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  product: { id: string; name: string; sku: string | null } | null;
}

const statusColors: Record<string, string> = {
  IN_STOCK: "bg-green-100 text-green-800",
  RESERVED: "bg-yellow-100 text-yellow-800",
  SOLD: "bg-blue-100 text-blue-800",
  IN_REPAIR: "bg-orange-100 text-orange-800",
  RMA: "bg-red-100 text-red-800",
};

export default function DeviceInventoryPage() {
  const { symbol, locale } = useCurrency();
  const { t } = useLanguage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);

  const conditionLabels: Record<string, string> = {
    NEW: t("mobileShop.conditionNew"),
    OPEN_BOX: t("mobileShop.conditionOpenBox"),
    GRADE_A: t("mobileShop.conditionGradeA"),
    GRADE_B: t("mobileShop.conditionGradeB"),
    GRADE_C: t("mobileShop.conditionGradeC"),
    REFURBISHED: t("mobileShop.conditionRefurbished"),
  };

  const statusLabels: Record<string, string> = {
    IN_STOCK: t("mobileShop.inStock"),
    RESERVED: t("mobileShop.reserved"),
    SOLD: t("mobileShop.sold"),
    IN_REPAIR: t("mobileShop.inRepair"),
    RMA: t("mobileShop.rma"),
  };

  const fetchDevices = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/mobile-devices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      } else {
        const payload = await res.json().catch(() => ({}));
        setDevices([]);
        setErrorMessage(payload.error || t("mobileShop.noPermission"));
      }
    } catch {
      setDevices([]);
      setErrorMessage(t("mobileShop.failedToLoadDevices"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    // Refresh immediately when the status filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchDevices(), 300);
    return () => clearTimeout(timer);
    // Debounced refresh for search input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("mobileShop.confirmDeleteDevice"))) return;
    try {
      const res = await fetch(`/api/mobile-devices/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("mobileShop.deviceDeleted"));
        fetchDevices();
      } else {
        const data = await res.json();
        toast.error(data.error || t("mobileShop.failedToDeleteDevice"));
      }
    } catch {
      toast.error(t("mobileShop.failedToDeleteDevice"));
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="h-6 w-6" />
              {t("mobileShop.deviceInventory")}
            </h2>
            <p className="text-slate-500">{t("mobileShop.manageDevicesDesc")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("mobileShop.devices")}</CardTitle>
            <CardAction>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  placeholder={t("mobileShop.searchDevicesPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={t("mobileShop.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t("mobileShop.allStatuses")}</SelectItem>
                    <SelectItem value="IN_STOCK">{t("mobileShop.inStock")}</SelectItem>
                    <SelectItem value="RESERVED">{t("mobileShop.reserved")}</SelectItem>
                    <SelectItem value="SOLD">{t("mobileShop.sold")}</SelectItem>
                    <SelectItem value="IN_REPAIR">{t("mobileShop.inRepair")}</SelectItem>
                    <SelectItem value="RMA">{t("mobileShop.rma")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditDevice(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("mobileShop.addDevice")}
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0 border-t">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : errorMessage ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-muted-foreground">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{t("mobileShop.unableToLoadDevices")}</p>
                  <p className="text-sm">{errorMessage}</p>
                </div>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("mobileShop.noDevicesFound")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 sm:hidden">
                  {devices.map((device) => (
                    <div key={device.id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium text-slate-900">{device.imei1}</p>
                          {device.imei2 && (
                            <p className="truncate font-mono text-[11px] text-muted-foreground">{device.imei2}</p>
                          )}
                        </div>
                        <Badge className={statusColors[device.currentStatus] || ""}>
                          {statusLabels[device.currentStatus] || device.currentStatus.replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="font-medium text-slate-900">{device.brand} {device.model}</p>
                        <p className="text-sm text-muted-foreground">
                          {[device.color, device.storageCapacity].filter(Boolean).join(" \u00B7 ") || conditionLabels[device.conditionGrade] || device.conditionGrade}
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("mobileShop.condition")}</p>
                          <p>{conditionLabels[device.conditionGrade] || device.conditionGrade}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("mobileShop.supplier")}</p>
                          <p className="truncate">{device.supplier?.name || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("mobileShop.cost")}</p>
                          <p>{symbol}{Number(device.costPrice).toLocaleString(locale)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("mobileShop.selling")}</p>
                          <p>
                            {Number(device.sellingPrice) > 0
                              ? `${symbol}${Number(device.sellingPrice).toLocaleString(locale)}`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-500"
                          onClick={() => {
                            setEditDevice(device);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {device.currentStatus === "IN_STOCK" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => handleDelete(device.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="max-w-[120px]">{t("mobileShop.imei")}</TableHead>
                        <TableHead>{t("mobileShop.brandModel")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("mobileShop.condition")}</TableHead>
                        <TableHead className="hidden md:table-cell text-right">{t("mobileShop.cost")}</TableHead>
                        <TableHead className="hidden md:table-cell text-right">{t("mobileShop.selling")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("mobileShop.supplier")}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell className="max-w-[120px] truncate font-mono text-xs">
                            {device.imei1}
                            {device.imei2 && (
                              <div className="text-muted-foreground truncate">{device.imei2}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{device.brand} {device.model}</div>
                            {device.color && (
                              <div className="text-xs text-muted-foreground">
                                {device.color}
                                {device.storageCapacity && ` \u00B7 ${device.storageCapacity}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[device.currentStatus] || ""}>
                              {statusLabels[device.currentStatus] || device.currentStatus.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {conditionLabels[device.conditionGrade] || device.conditionGrade}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right text-sm">
                            {symbol}{Number(device.costPrice).toLocaleString(locale)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right text-sm">
                            {Number(device.sellingPrice) > 0
                              ? `${symbol}${Number(device.sellingPrice).toLocaleString(locale)}`
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {device.supplier?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-500"
                                onClick={() => {
                                  setEditDevice(device);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {device.currentStatus === "IN_STOCK" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                                  onClick={() => handleDelete(device.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <DeviceFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditDevice(null);
          }}
          onSuccess={fetchDevices}
          editDevice={editDevice}
        />
      </div>
    </PageAnimation>
  );
}
