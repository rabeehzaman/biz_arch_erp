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
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
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
      toast.error(t("units.loadFailed"));
      console.error("Failed to fetch units:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
      toast.success(editingUnit ? t("units.updated") : t("units.added"));
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
    if (!confirm(t("units.deactivateConfirm"))) return;

    try {
      const response = await fetch(`/api/units/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to deactivate");
      fetchUnits();
      setUnitRefreshKey(k => k + 1);
      toast.success(t("units.deactivated"));
    } catch (error) {
      toast.error(t("units.deactivateFailed"));
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
      toast.success(t("units.activated"));
    } catch (error) {
      toast.error(t("units.activateFailed"));
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
              {t("units.addUnit")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form className="contents" onSubmit={handleSubmit}>
              <DialogHeader className="pr-12">
                <DialogTitle>
                  {editingUnit ? t("units.editUnit") : t("units.addNewUnit")}
                </DialogTitle>
                <DialogDescription>
                  {editingUnit
                    ? t("units.editDesc")
                    : t("units.addDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2 sm:py-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">{t("units.codeRequired")}</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder={t("units.codePlaceholder")}
                    required
                    disabled={!!editingUnit}
                  />
                  <p className="text-xs text-slate-500">
                    {t("units.codeDescription")}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("common.nameRequired")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t("units.namePlaceholder")}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    {t("units.nameDescription")}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingUnit ? t("units.updateUnit") : t("units.addUnit")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600">
            {t("units.unitsDescription")}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={5} rows={5} />
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Ruler className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">{t("units.noUnitsFoundList")}</h3>
              <p className="text-sm text-slate-500">
                {t("units.noUnitsHint")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.code")}</TableHead>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.products")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
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
                        {unit.isActive ? t("common.active") : t("common.inactive")}
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
                          title={t("units.activateUnit")}
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
