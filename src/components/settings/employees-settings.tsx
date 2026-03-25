import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

interface Employee {
  id: string;
  name: string;
  pinCode: string | null;
  isActive: boolean;
}

export function EmployeesSettings() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string } | null>(null);
  const [pinRequired, setPinRequired] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    pinCode: "",
    isActive: true,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      setEmployees(data.employees);
      setPinRequired(data.posEmployeePinRequired ?? false);
    } catch (_error) {
      toast.error(t("employees.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const togglePinRequired = async (checked: boolean) => {
    setIsTogglingPin(true);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posEmployeePinRequired: checked }),
      });
      if (!res.ok) throw new Error("Failed to update setting");
      setPinRequired(checked);
      toast.success(checked ? t("employees.pinEnabled") : t("employees.pinDisabled"));
    } catch (_error) {
      toast.error(t("employees.settingUpdateFailed"));
    } finally {
      setIsTogglingPin(false);
    }
  };

  const openDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        pinCode: employee.pinCode || "",
        isActive: employee.isActive,
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: "",
        pinCode: "",
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error(t("employees.nameRequired"));
      return;
    }
    if (pinRequired && !formData.pinCode) {
      toast.error(t("employees.nameAndPinRequired"));
      return;
    }
    if (formData.pinCode && formData.pinCode.length < 4) {
      toast.error(t("employees.pinMinLength"));
      return;
    }

    setIsSaving(true);
    try {
      const method = editingEmployee ? "PUT" : "POST";
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : "/api/employees";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save employee");

      toast.success(editingEmployee ? t("employees.updated") : t("employees.created"));
      setIsDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDialog) return;
    try {
      const res = await fetch(`/api/employees/${confirmDialog.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      toast.success(t("employees.deleted"));
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleToggleActive = async (employee: Employee, checked: boolean) => {
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...employee, isActive: checked }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("employees.statusUpdated"));
      fetchEmployees();
    } catch {
      toast.error(t("employees.statusUpdateFailed"));
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <TableSkeleton columns={4} rows={4} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t("employees.posEmployees")}</h3>
          <p className="text-sm text-slate-500">{t("employees.posEmployeesDesc")}</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t("employees.addEmployee")}
        </Button>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <Label htmlFor="pinRequired" className="text-sm font-medium text-slate-900">
            {t("employees.requirePinForPos")}
          </Label>
          <p className="text-xs text-slate-500">{t("employees.requirePinForPosDesc")}</p>
        </div>
        <Switch
          id="pinRequired"
          checked={pinRequired}
          onCheckedChange={togglePinRequired}
          disabled={isTogglingPin}
        />
      </div>

      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              {pinRequired && <TableHead>{t("employees.pinCode")}</TableHead>}
              <TableHead>{t("employees.activeStatus")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={pinRequired ? 4 : 3} className="h-24 text-center text-slate-500">
                  {t("employees.noEmployeesFound")}
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  {pinRequired && (
                    <TableCell>
                      {emp.pinCode ? (
                        <span className="font-mono bg-slate-100 px-2 py-1 flex items-center justify-center w-16 text-center rounded text-sm text-slate-600">
                          {emp.pinCode.replace(/./g, '•')}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Switch
                      checked={emp.isActive}
                      onCheckedChange={(c) => handleToggleActive(emp, c)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(emp)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setConfirmDialog({ id: emp.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form className="contents" onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? t("employees.editEmployee") : t("employees.addEmployee")}</DialogTitle>
              <DialogDescription>
                {t("employees.dialogDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("common.name")}</Label>
                <Input
                  id="name"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              {pinRequired && (
                <div className="space-y-2">
                  <Label htmlFor="pinCode">{t("employees.pinCode")}</Label>
                  <Input
                    id="pinCode"
                    type="password"
                    inputMode="numeric"
                    placeholder="e.g. 1234"
                    value={formData.pinCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\\D/g, "");
                      setFormData({ ...formData, pinCode: val });
                    }}
                    required={pinRequired}
                  />
                  <p className="text-xs text-slate-500">{t("employees.pinCodeHint")}</p>
                </div>
              )}
              <div className="flex items-center justify-between mt-4">
                <Label htmlFor="isActive">{t("common.active")}</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title={t("employees.deleteEmployee")}
          description={t("employees.deleteConfirm")}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
