"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { TableSkeleton } from "@/components/table-skeleton";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Armchair } from "lucide-react";

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

interface TableFormData {
  number: string;
  name: string;
  capacity: string;
  floor: string;
  section: string;
}

const EMPTY_FORM: TableFormData = {
  number: "",
  name: "",
  capacity: "4",
  floor: "",
  section: "",
};

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  OCCUPIED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  RESERVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CLEANING: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
};

export default function RestaurantTablesPage() {
  const { t } = useLanguage();
  const { data: tables, isLoading, mutate } = useSWR<RestaurantTable[]>(
    "/api/restaurant/tables",
    fetcher
  );

  const [formDialog, setFormDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [formData, setFormData] = useState<TableFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    table: RestaurantTable | null;
  }>({ open: false, table: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const openAddDialog = () => {
    setEditingTable(null);
    setFormData(EMPTY_FORM);
    setFormDialog(true);
  };

  const openEditDialog = (table: RestaurantTable) => {
    setEditingTable(table);
    setFormData({
      number: table.number.toString(),
      name: table.name,
      capacity: table.capacity.toString(),
      floor: table.floor ?? "",
      section: table.section ?? "",
    });
    setFormDialog(true);
  };

  const handleSave = async () => {
    const number = parseInt(formData.number);
    const capacity = parseInt(formData.capacity);

    if (!formData.number || !formData.name) {
      toast.error("Table number and name are required");
      return;
    }
    if (isNaN(number) || number < 1) {
      toast.error("Table number must be a positive integer");
      return;
    }
    if (isNaN(capacity) || capacity < 1) {
      toast.error("Capacity must be a positive integer");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTable) {
        // Update existing
        const res = await fetch(`/api/restaurant/tables/${editingTable.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            capacity,
            floor: formData.floor || undefined,
            section: formData.section || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update table");
        }
        toast.success("Table updated successfully");
      } else {
        // Create new
        const res = await fetch("/api/restaurant/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number,
            name: formData.name,
            capacity,
            floor: formData.floor || undefined,
            section: formData.section || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create table");
        }
        toast.success("Table created successfully");
      }
      mutate();
      setFormDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.table) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/restaurant/tables/${deleteDialog.table.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete table");
      }
      toast.success("Table deleted successfully");
      mutate();
      setDeleteDialog({ open: false, table: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Table Management</h1>
          <p className="text-muted-foreground">Manage your restaurant tables and seating layout</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Table
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton columns={7} rows={5} />
          ) : !tables || tables.length === 0 ? (
            <div className="p-12 text-center">
              <Armchair className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tables yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first restaurant table.
              </p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">Capacity</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">#{table.number}</TableCell>
                    <TableCell>{table.name}</TableCell>
                    <TableCell>{table.capacity}</TableCell>
                    <TableCell>{table.floor || "-"}</TableCell>
                    <TableCell>{table.section || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_BADGE[table.status] || ""}
                      >
                        {table.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(table)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({ open: true, table })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formDialog} onOpenChange={setFormDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingTable ? "Edit Table" : "Add New Table"}
            </DialogTitle>
            <DialogDescription>
              {editingTable
                ? "Update the table details below."
                : "Fill in the details to add a new table."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="table-number">
                  Table Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="table-number"
                  type="number"
                  min={1}
                  value={formData.number}
                  onChange={(e) =>
                    setFormData({ ...formData, number: e.target.value })
                  }
                  placeholder="e.g. 1"
                  disabled={!!editingTable}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-capacity">
                  Capacity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="table-capacity"
                  type="number"
                  min={1}
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  placeholder="e.g. 4"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="table-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. Window Table, VIP Booth"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="table-floor">Floor</Label>
                <Input
                  id="table-floor"
                  value={formData.floor}
                  onChange={(e) =>
                    setFormData({ ...formData, floor: e.target.value })
                  }
                  placeholder="e.g. Ground Floor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-section">Section</Label>
                <Input
                  id="table-section"
                  value={formData.section}
                  onChange={(e) =>
                    setFormData({ ...formData, section: e.target.value })
                  }
                  placeholder="e.g. Outdoor, Main Hall"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingTable
                ? "Update Table"
                : "Add Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, table: null });
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete table #{deleteDialog.table?.number}{" "}
              - {deleteDialog.table?.name}? This action will deactivate the
              table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, table: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
