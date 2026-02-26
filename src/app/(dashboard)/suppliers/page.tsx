"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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

import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Search, Truck, MoreHorizontal, Wallet } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  gstin: string | null;
  gstStateCode: string | null;
  balance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    purchaseInvoices: number;
  };
}

export default function SuppliersPage() {
  const { data: session } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isOpeningBalanceDialogOpen, setIsOpeningBalanceDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [selectedSupplierForBalance, setSelectedSupplierForBalance] = useState<Supplier | null>(null);
  const [openingBalanceData, setOpeningBalanceData] = useState({
    amount: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    gstin: "",
    gstStateCode: "",
    notes: "",
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      toast.error("Failed to load suppliers");
      console.error("Failed to fetch suppliers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zipCode: formData.zipCode || null,
      country: formData.country || "India",
      gstin: formData.gstin || null,
      gstStateCode: formData.gstStateCode || null,
      notes: formData.notes || null,
    };

    try {
      const response = editingSupplier
        ? await fetch(`/api/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        : await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      if (!response.ok) throw new Error("Failed to save");

      setIsDialogOpen(false);
      resetForm();
      fetchSuppliers();
      toast.success(editingSupplier ? "Supplier updated" : "Supplier added");
    } catch (error) {
      toast.error("Failed to save supplier");
      console.error("Failed to save supplier:", error);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      zipCode: supplier.zipCode || "",
      country: supplier.country || "India",
      gstin: supplier.gstin || "",
      gstStateCode: supplier.gstStateCode || "",
      notes: supplier.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: "Delete Supplier",
      description: "Are you sure you want to delete this supplier?",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to delete");
          }
          fetchSuppliers();
          toast.success("Supplier deleted");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to delete supplier");
          console.error("Failed to delete supplier:", error);
        }
      },
    });
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India",
      gstin: "",
      gstStateCode: "",
      notes: "",
    });
  };

  const handleOpeningBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForBalance) return;

    try {
      const response = await fetch(`/api/suppliers/${selectedSupplierForBalance.id}/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(openingBalanceData.amount),
          transactionDate: openingBalanceData.transactionDate,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setIsOpeningBalanceDialogOpen(false);
      setSelectedSupplierForBalance(null);
      setOpeningBalanceData({
        amount: "",
        transactionDate: new Date().toISOString().split("T")[0],
      });
      fetchSuppliers();
      toast.success("Opening balance set successfully");
    } catch (error) {
      toast.error("Failed to set opening balance");
      console.error("Failed to set opening balance:", error);
    }
  };

  const handleOpenOpeningBalanceDialog = async (supplier: Supplier) => {
    setSelectedSupplierForBalance(supplier);

    // Fetch existing opening balance if any
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/opening-balance`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setOpeningBalanceData({
            amount: String(data.amount),
            transactionDate: data.transactionDate.split("T")[0],
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch opening balance:", error);
    }

    setIsOpeningBalanceDialogOpen(true);
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.phone?.includes(searchQuery)
  );

  return (
    <PageAnimation>
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Suppliers</h2>
            <p className="text-slate-500">Manage your supplier/vendor database</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl overflow-y-auto max-h-[90vh]">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>
                    {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSupplier
                      ? "Update the supplier details below."
                      : "Fill in the details to add a new supplier."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) =>
                          setFormData({ ...formData, state: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) =>
                          setFormData({ ...formData, zipCode: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="gstin">GSTIN</Label>
                      <Input
                        id="gstin"
                        value={formData.gstin}
                        onChange={(e) =>
                          setFormData({ ...formData, gstin: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gstStateCode">GST State Code</Label>
                      <Input
                        id="gstStateCode"
                        value={formData.gstStateCode}
                        onChange={(e) =>
                          setFormData({ ...formData, gstStateCode: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter className="mt-auto pt-4 border-t">
                  <Button type="submit" className="w-full sm:w-auto">
                    {editingSupplier ? "Update Supplier" : "Add Supplier"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </StaggerItem>

        <StaggerItem>
          <Dialog open={isOpeningBalanceDialogOpen} onOpenChange={(open) => {
            setIsOpeningBalanceDialogOpen(open);
            if (!open) {
              setSelectedSupplierForBalance(null);
              setOpeningBalanceData({
                amount: "",
                transactionDate: new Date().toISOString().split("T")[0],
              });
            }
          }}>
            <DialogContent>
              <form onSubmit={handleOpeningBalanceSubmit}>
                <DialogHeader>
                  <DialogTitle>Set Opening Balance</DialogTitle>
                  <DialogDescription>
                    Set the opening balance for {selectedSupplierForBalance?.name}. This represents the initial payable amount.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="openingAmount">Opening Balance Amount *</Label>
                    <Input
                      id="openingAmount"
                      type="number"
                      step="0.01"
                      value={openingBalanceData.amount}
                      onChange={(e) =>
                        setOpeningBalanceData({ ...openingBalanceData, amount: e.target.value })
                      }
                      placeholder="Enter amount (positive for payable)"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      Enter a positive amount for payables (you owe supplier), or negative for advances (supplier owes you).
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="balanceDate">As of Date *</Label>
                    <Input
                      id="balanceDate"
                      type="date"
                      value={openingBalanceData.transactionDate}
                      onChange={(e) =>
                        setOpeningBalanceData({ ...openingBalanceData, transactionDate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Set Opening Balance</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : filteredSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Truck className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">No suppliers found</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? "Try a different search term"
                      : "Add your first supplier to get started"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact</TableHead>
                        <TableHead className="hidden sm:table-cell">Location</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead className="hidden sm:table-cell">Invoices</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell>
                            <div className="font-medium">{supplier.name}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="text-sm">
                              {supplier.email && <div>{supplier.email}</div>}
                              {supplier.phone && (
                                <div className="text-slate-500">{supplier.phone}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="text-sm">
                              {supplier.city && supplier.state
                                ? `${supplier.city}, ${supplier.state}`
                                : supplier.city || supplier.state || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                Number(supplier.balance) > 0
                                  ? "text-red-600 font-medium"
                                  : Number(supplier.balance) < 0
                                    ? "text-green-600 font-medium"
                                    : ""
                              }
                            >
                              ₹{Math.abs(Number(supplier.balance)).toLocaleString("en-IN")}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{supplier._count?.purchaseInvoices || 0}</TableCell>
                          <TableCell>
                            <Badge
                              variant={supplier.isActive ? "default" : "secondary"}
                            >
                              {supplier.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenOpeningBalanceDialog(supplier)}>
                                  <Wallet className="mr-2 h-4 w-4" />
                                  Opening Balance
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(supplier.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}
    </PageAnimation>
  );
}
