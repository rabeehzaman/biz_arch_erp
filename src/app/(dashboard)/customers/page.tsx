"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Plus, Pencil, Trash2, Search, Users, MoreHorizontal, Wallet, FileText, UserPlus, X } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Checkbox } from "@/components/ui/checkbox";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface Assignment {
  id: string;
  userId: string;
  user: User;
  assignedAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  balance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    invoices: number;
  };
  assignments?: Assignment[];
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isOpeningBalanceDialogOpen, setIsOpeningBalanceDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForBalance, setSelectedCustomerForBalance] = useState<Customer | null>(null);
  const [selectedCustomerForAssign, setSelectedCustomerForAssign] = useState<Customer | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    notes: "",
  });
  const [openingBalanceData, setOpeningBalanceData] = useState({
    amount: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchCustomers();
    fetchUsers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      toast.error("Failed to load customers");
      console.error("Failed to fetch customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleOpenAssignDialog = (customer: Customer) => {
    setSelectedCustomerForAssign(customer);
    setSelectedUserIds(customer.assignments?.map(a => a.userId) || []);
    setIsAssignDialogOpen(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedCustomerForAssign) return;

    try {
      // First, get current assignments
      const currentAssignments = selectedCustomerForAssign.assignments || [];
      const currentUserIds = currentAssignments.map(a => a.userId);

      // Find users to add and remove
      const usersToAdd = selectedUserIds.filter(id => !currentUserIds.includes(id));
      const usersToRemove = currentUserIds.filter(id => !selectedUserIds.includes(id));

      // Add new assignments
      if (usersToAdd.length > 0) {
        await fetch(`/api/customers/${selectedCustomerForAssign.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: usersToAdd }),
        });
      }

      // Remove assignments
      for (const userId of usersToRemove) {
        await fetch(`/api/customers/${selectedCustomerForAssign.id}/assign`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      }

      setIsAssignDialogOpen(false);
      setSelectedCustomerForAssign(null);
      setSelectedUserIds([]);
      fetchCustomers();
      toast.success("Customer assignments updated");
    } catch (error) {
      toast.error("Failed to update assignments");
      console.error("Failed to update assignments:", error);
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
      notes: formData.notes || null,
    };

    try {
      const response = editingCustomer
        ? await fetch(`/api/customers/${editingCustomer.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) throw new Error("Failed to save");

      setIsDialogOpen(false);
      resetForm();
      fetchCustomers();
      toast.success(editingCustomer ? "Customer updated" : "Customer added");
    } catch (error) {
      toast.error("Failed to save customer");
      console.error("Failed to save customer:", error);
    }
  };

  const handleOpeningBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForBalance) return;

    try {
      const response = await fetch(`/api/customers/${selectedCustomerForBalance.id}/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(openingBalanceData.amount),
          transactionDate: openingBalanceData.transactionDate,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setIsOpeningBalanceDialogOpen(false);
      setSelectedCustomerForBalance(null);
      setOpeningBalanceData({
        amount: "",
        transactionDate: new Date().toISOString().split("T")[0],
      });
      fetchCustomers();
      toast.success("Opening balance set successfully");
    } catch (error) {
      toast.error("Failed to set opening balance");
      console.error("Failed to set opening balance:", error);
    }
  };

  const handleOpenOpeningBalanceDialog = async (customer: Customer) => {
    setSelectedCustomerForBalance(customer);

    // Fetch existing opening balance if any
    try {
      const response = await fetch(`/api/customers/${customer.id}/opening-balance`);
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

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      zipCode: customer.zipCode || "",
      country: customer.country || "India",
      notes: customer.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      fetchCustomers();
      toast.success("Customer deleted");
    } catch (error) {
      toast.error("Failed to delete customer");
      console.error("Failed to delete customer:", error);
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India",
      notes: "",
    });
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
          <p className="text-slate-500">Manage your customer database</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? "Edit Customer" : "Add New Customer"}
                </DialogTitle>
                <DialogDescription>
                  {editingCustomer
                    ? "Update the customer details below."
                    : "Fill in the details to add a new customer."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-3 gap-4">
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
              <DialogFooter>
                <Button type="submit">
                  {editingCustomer ? "Update Customer" : "Add Customer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Opening Balance Dialog */}
      <Dialog open={isOpeningBalanceDialogOpen} onOpenChange={(open) => {
        setIsOpeningBalanceDialogOpen(open);
        if (!open) {
          setSelectedCustomerForBalance(null);
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
                Set the opening balance for {selectedCustomerForBalance?.name}. This represents the initial receivable amount.
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
                  placeholder="Enter amount (positive for receivable)"
                  required
                />
                <p className="text-xs text-slate-500">
                  Enter a positive amount for receivables (customer owes you), or negative for advances (you owe customer).
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

      {/* Assign Customer Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open);
        if (!open) {
          setSelectedCustomerForAssign(null);
          setSelectedUserIds([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Customer</DialogTitle>
            <DialogDescription>
              Select users to assign {selectedCustomerForAssign?.name} to. Only assigned users (and admins) will be able to see this customer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              {users.filter(u => u.role !== "admin").map((user) => (
                <div key={user.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUserIds.includes(user.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUserIds([...selectedUserIds, user.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                      }
                    }}
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {user.name}
                    <span className="text-slate-500 ml-2">({user.email})</span>
                  </label>
                </div>
              ))}
              {users.filter(u => u.role !== "admin").length === 0 && (
                <p className="text-sm text-slate-500">No users available for assignment.</p>
              )}
            </div>
            {selectedUserIds.length === 0 && (
              <p className="mt-4 text-xs text-amber-600">
                Note: If no users are selected, only admins will be able to see this customer.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignSubmit}>
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search customers..."
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
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No customers found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? "Try a different search term"
                  : "Add your first customer to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium">{customer.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {customer.email && <div>{customer.email}</div>}
                        {customer.phone && (
                          <div className="text-slate-500">{customer.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {customer.assignments && customer.assignments.length > 0 ? (
                          customer.assignments.map(a => (
                            <Badge key={a.id} variant="outline" className="text-xs">
                              {a.user.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 text-sm">Unassigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          Number(customer.balance) > 0
                            ? "text-green-600 font-medium"
                            : Number(customer.balance) < 0
                              ? "text-red-600 font-medium"
                              : ""
                        }
                      >
                        ₹{Math.abs(Number(customer.balance)).toLocaleString("en-IN")}
                      </span>
                    </TableCell>
                    <TableCell>{customer._count?.invoices || 0}</TableCell>
                    <TableCell>
                      <Badge
                        variant={customer.isActive ? "default" : "secondary"}
                      >
                        {customer.isActive ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => handleEdit(customer)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenOpeningBalanceDialog(customer)}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Opening Balance
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/customers/${customer.id}/statement`}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Statement
                            </Link>
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleOpenAssignDialog(customer)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Assign
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(customer.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
