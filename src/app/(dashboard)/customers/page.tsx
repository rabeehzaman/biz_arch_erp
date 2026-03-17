"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
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
} from "@/components/ui/dialog";

import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Search, Users, MoreHorizontal, Wallet, FileText, UserPlus } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

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
  gstin: string | null;
  gstStateCode: string | null;
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
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  const formatAmount = (amount: number) => fmt(amount);

  const [openingBalanceData, setOpeningBalanceData] = useState({
    amount: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchCustomers();
    fetchUsers();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      toast.error(t("common.error"));
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
      toast.success(t("customers.customerUpdated"));
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to update assignments:", error);
    }
  };

  // Form logic moved to CustomerFormDialog

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
      toast.success(t("customers.customerUpdated"));
    } catch (error) {
      toast.error(t("common.error"));
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
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("customers.deleteCustomer"),
      description: t("customers.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          fetchCustomers();
          toast.success(t("customers.customerDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete customer:", error);
        }
      },
    });
  };



  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery)
  );

  return (
    <PageAnimation>
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("customers.title")}</h2>
            <p className="text-slate-500">{t("dashboard.manageCustomers")}</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
            <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
            {t("customers.addCustomer")}
          </Button>

          <CustomerFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingCustomer(null);
              }
            }}
            customerToEdit={editingCustomer || undefined}
            onSuccess={() => {
              fetchCustomers();
              setIsDialogOpen(false);
              setEditingCustomer(null);
            }}
          />
        </StaggerItem>

        <StaggerItem>
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
              <form className="contents" onSubmit={handleOpeningBalanceSubmit}>
                <DialogHeader className="pr-12">
                  <DialogTitle>{t("common.openingBalance")}</DialogTitle>
                  <DialogDescription>
                    {t("customers.openingBalanceDesc").replace("{name}", selectedCustomerForBalance?.name || "")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="openingAmount">{t("common.openingBalance")} *</Label>
                    <Input
                      id="openingAmount"
                      type="number"
                      step="0.01"
                      value={openingBalanceData.amount}
                      onChange={(e) =>
                        setOpeningBalanceData({ ...openingBalanceData, amount: e.target.value })
                      }
                      placeholder={t("customers.openingBalancePlaceholder")}
                      required
                    />
                    <p className="text-xs text-slate-500">
                      {t("customers.openingBalanceHint")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="balanceDate">{t("common.date")} *</Label>
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
                  <Button type="submit">{t("common.save")}</Button>
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
                <DialogTitle>{t("customers.assignCustomer")}</DialogTitle>
                <DialogDescription>
                  {t("customers.assignDesc")}
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
                    <p className="text-sm text-slate-500">{t("customers.noUsersAvailable")}</p>
                  )}
                </div>
                {selectedUserIds.length === 0 && (
                  <p className="mt-4 text-xs text-amber-600">
                    {t("customers.noUsersNote")}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleAssignSubmit}>
                  {t("customers.saveAssignments")}
                </Button>
              </DialogFooter>
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
                    placeholder={t("customers.searchCustomers")}
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
                  <h3 className="mt-4 text-lg font-semibold">{t("customers.noCustomers")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.noMatchFound")
                      : t("customers.noCustomersDesc")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {filteredCustomers.map((customer) => (
                      <div key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{customer.name}</p>
                            {(customer.email || customer.phone) && (
                              <div className="mt-1 space-y-1 text-sm text-slate-500">
                                {customer.email && <p className="break-all">{customer.email}</p>}
                                {customer.phone && <p>{customer.phone}</p>}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={customer.isActive ? "default" : "secondary"}>
                              {customer.isActive ? t("common.active") : t("common.inactive")}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="-mr-2 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(customer)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenOpeningBalanceDialog(customer)}>
                                  <Wallet className="mr-2 h-4 w-4" />
                                  {t("common.openingBalance")}
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/customers/${customer.id}/statement`}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    {t("customers.viewStatement")}
                                  </Link>
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem onClick={() => handleOpenAssignDialog(customer)}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    {t("customers.assign")}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(customer.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.balance")}</p>
                            <p className={`mt-1 font-semibold ${Number(customer.balance) > 0 ? "text-green-600" : Number(customer.balance) < 0 ? "text-red-600" : "text-slate-900"}`}>
                              {formatAmount(Math.abs(Number(customer.balance)))}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("customers.totalInvoices")}</p>
                            <p className="mt-1 font-medium text-slate-900">{customer._count?.invoices || 0}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.assigned")}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {customer.assignments && customer.assignments.length > 0 ? (
                              customer.assignments.map((assignment) => (
                                <Badge key={assignment.id} variant="outline" className="text-xs">
                                  {assignment.user.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-slate-400">{t("common.unassigned")}</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <Button asChild variant="outline" className="min-h-[44px] w-full">
                            <Link href={`/customers/${customer.id}/statement`}>
                              <FileText className="h-4 w-4" />
                              {t("customers.viewStatement")}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.name")}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t("customers.contactInfo")}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t("common.assigned")}</TableHead>
                          <TableHead>{t("common.balance")}</TableHead>
                          <TableHead>{t("customers.totalInvoices")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <div className="font-medium">{customer.name}</div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="text-sm">
                                {customer.email && <div>{customer.email}</div>}
                                {customer.phone && (
                                  <div className="text-slate-500">{customer.phone}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {customer.assignments && customer.assignments.length > 0 ? (
                                  customer.assignments.map(a => (
                                    <Badge key={a.id} variant="outline" className="text-xs">
                                      {a.user.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-slate-400 text-sm">{t("common.unassigned")}</span>
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
                                {formatAmount(Math.abs(Number(customer.balance)))}
                              </span>
                            </TableCell>
                            <TableCell>{customer._count?.invoices || 0}</TableCell>
                            <TableCell>
                              <Badge
                                variant={customer.isActive ? "default" : "secondary"}
                              >
                                {customer.isActive ? t("common.active") : t("common.inactive")}
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
                                    {t("common.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenOpeningBalanceDialog(customer)}>
                                    <Wallet className="mr-2 h-4 w-4" />
                                    {t("common.openingBalance")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/customers/${customer.id}/statement`}>
                                      <FileText className="mr-2 h-4 w-4" />
                                      {t("customers.viewStatement")}
                                    </Link>
                                  </DropdownMenuItem>
                                  {isAdmin && (
                                    <DropdownMenuItem onClick={() => handleOpenAssignDialog(customer)}>
                                      <UserPlus className="mr-2 h-4 w-4" />
                                      {t("customers.assign")}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDelete(customer.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t("common.delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
