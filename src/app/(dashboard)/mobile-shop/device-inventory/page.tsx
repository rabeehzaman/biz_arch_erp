"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageAnimation } from "@/components/ui/page-animation";
import { Plus, Smartphone, Loader2, Trash2, Pencil } from "lucide-react";
import { DeviceFormDialog } from "@/components/mobile-devices/device-form-dialog";
import { toast } from "sonner";

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

const conditionLabels: Record<string, string> = {
  NEW: "New",
  OPEN_BOX: "Open Box",
  GRADE_A: "Grade A",
  GRADE_B: "Grade B",
  GRADE_C: "Grade C",
  REFURBISHED: "Refurbished",
};

export default function DeviceInventoryPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/mobile-devices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch {
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchDevices(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this device?")) return;
    try {
      const res = await fetch(`/api/mobile-devices/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Device deleted");
        fetchDevices();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete device");
      }
    } catch {
      toast.error("Failed to delete device");
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="h-6 w-6" />
              Device Inventory
            </h2>
            <p className="text-slate-500">Manage individual mobile devices</p>
          </div>
          <Button onClick={() => { setEditDevice(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search IMEI, brand, model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="RESERVED">Reserved</option>
                  <option value="SOLD">Sold</option>
                  <option value="IN_REPAIR">In Repair</option>
                  <option value="RMA">RMA</option>
                </select>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0 border-t">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No devices found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Brand / Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Selling</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono text-xs">
                        {device.imei1}
                        {device.imei2 && (
                          <div className="text-muted-foreground">{device.imei2}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{device.brand} {device.model}</div>
                        {device.color && (
                          <div className="text-xs text-muted-foreground">
                            {device.color}
                            {device.storageCapacity && ` · ${device.storageCapacity}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[device.currentStatus] || ""}>
                          {device.currentStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {conditionLabels[device.conditionGrade] || device.conditionGrade}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        &#8377;{Number(device.costPrice).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(device.sellingPrice) > 0
                          ? `₹${Number(device.sellingPrice).toLocaleString("en-IN")}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
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
