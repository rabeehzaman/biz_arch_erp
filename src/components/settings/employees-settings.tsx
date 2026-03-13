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

interface Employee {
  id: string;
  name: string;
  pinCode: string;
  isActive: boolean;
}

export function EmployeesSettings() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string } | null>(null);

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
      setEmployees(data);
    } catch (error) {
      toast.error("Failed to load POS employees");
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        pinCode: employee.pinCode,
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
    if (!formData.name || !formData.pinCode) {
      toast.error("Name and PIN code are required");
      return;
    }
    if (formData.pinCode.length < 4) {
      toast.error("PIN code must be at least 4 digits");
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

      toast.success(editingEmployee ? "Employee updated" : "Employee created");
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
      toast.success("Employee deleted");
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
      toast.success("Status updated");
      fetchEmployees();
    } catch {
      toast.error("Failed to update status");
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
          <h3 className="text-lg font-semibold text-slate-900">POS Employees</h3>
          <p className="text-sm text-slate-500">Manage names and PIN codes for POS cashiers</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>PIN Code</TableHead>
              <TableHead>Active Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                  No employees found. Add your first POS staff.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>
                    <span className="font-mono bg-slate-100 px-2 py-1 flex items-center justify-center w-16 text-center rounded text-sm text-slate-600">
                      {emp.pinCode.replace(/./g, '•')}
                    </span>
                  </TableCell>
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
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
              <DialogDescription>
                Assign a unique PIN code that this employee will use to open and close POS sessions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinCode">PIN Code</Label>
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
                  required
                />
                <p className="text-xs text-slate-500">Only numbers allowed. Must be at least 4 digits.</p>
              </div>
              <div className="flex items-center justify-between mt-4">
                <Label htmlFor="isActive">Active</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title="Delete Employee"
          description="Are you sure you want to delete this employee? This cannot be undone."
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
