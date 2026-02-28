"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Pencil, XCircle, Ruler } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

import { useSession } from "next-auth/react";
import { UnitConversionsSettings } from "./unit-conversions-settings";

interface Unit {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    products: number;
  };
}

export function UnitsSettings() {
  const { data: session } = useSession();
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [unitRefreshKey, setUnitRefreshKey] = useState(0);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await fetch("/api/units?includeInactive=true");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setUnits(data);
    } catch (error) {
      toast.error("Failed to load units");
      console.error("Failed to fetch units:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      code: formData.code.toLowerCase(),
      name: formData.name,
    };

    try {
      const response = editingUnit
        ? await fetch(`/api/units/${editingUnit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        : await fetch("/api/units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUnits();
      setUnitRefreshKey(k => k + 1);
      toast.success(editingUnit ? "Unit updated" : "Unit added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save unit");
      console.error("Failed to save unit:", error);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code,
      name: unit.name,
    });
    setIsDialogOpen(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this unit?")) return;

    try {
      const response = await fetch(`/api/units/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to deactivate");
      fetchUnits();
      setUnitRefreshKey(k => k + 1);
      toast.success("Unit deactivated");
    } catch (error) {
      toast.error("Failed to deactivate unit");
      console.error("Failed to deactivate unit:", error);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const response = await fetch(`/api/units/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) throw new Error("Failed to activate");
      fetchUnits();
      setUnitRefreshKey(k => k + 1);
      toast.success("Unit activated");
    } catch (error) {
      toast.error("Failed to activate unit");
      console.error("Failed to activate unit:", error);
    }
  };

  const resetForm = () => {
    setEditingUnit(null);
    setFormData({
      code: "",
      name: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingUnit ? "Edit Unit" : "Add New Unit"}
                </DialogTitle>
                <DialogDescription>
                  {editingUnit
                    ? "Update the unit details below."
                    : "Add a new unit of measurement."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="e.g., mtr, kg, pcs"
                    required
                    disabled={!!editingUnit}
                  />
                  <p className="text-xs text-slate-500">
                    Short code for the unit (will be converted to lowercase)
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Meter, Kilogram, Piece"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Full name of the unit
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingUnit ? "Update Unit" : "Add Unit"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600">
            Units are used when creating products. Active units appear in the dropdown selector.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={5} rows={5} />
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Ruler className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No units found</h3>
              <p className="text-sm text-slate-500">
                Add your first unit to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <span className="font-mono font-semibold uppercase">
                        {unit.code}
                      </span>
                    </TableCell>
                    <TableCell>{unit.name}</TableCell>
                    <TableCell>
                      {unit._count?.products || 0} product(s)
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={unit.isActive ? "default" : "secondary"}
                      >
                        {unit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(unit)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {unit.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(unit.id)}
                        >
                          <XCircle className="h-4 w-4 text-orange-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleActivate(unit.id)}
                          title="Activate unit"
                        >
                          <Plus className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {session?.user?.multiUnitEnabled && <UnitConversionsSettings unitRefreshKey={unitRefreshKey} />}
    </div>
  );
}
