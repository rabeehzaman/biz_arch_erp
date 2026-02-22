"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, ChevronRight, ChevronDown, BookOpen, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface TreeNode {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountSubType: string;
  isSystem: boolean;
  isActive: boolean;
  parentId: string | null;
  transactionCount: number;
  children: TreeNode[];
}

interface FlatAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountSubType: string;
  isSystem: boolean;
  parentId: string | null;
}

const accountTypeLabels: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

const accountSubTypeLabels: Record<string, string> = {
  CURRENT_ASSET: "Current Asset",
  FIXED_ASSET: "Fixed Asset",
  BANK: "Bank",
  CASH: "Cash",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  INVENTORY: "Inventory",
  OTHER_ASSET: "Other Asset",
  CURRENT_LIABILITY: "Current Liability",
  LONG_TERM_LIABILITY: "Long-Term Liability",
  ACCOUNTS_PAYABLE: "Accounts Payable",
  OTHER_LIABILITY: "Other Liability",
  OWNERS_EQUITY: "Owner's Equity",
  RETAINED_EARNINGS: "Retained Earnings",
  OTHER_EQUITY: "Other Equity",
  SALES_REVENUE: "Sales Revenue",
  OTHER_REVENUE: "Other Revenue",
  COST_OF_GOODS_SOLD: "Cost of Goods Sold",
  OPERATING_EXPENSE: "Operating Expense",
  PAYROLL_EXPENSE: "Payroll Expense",
  OTHER_EXPENSE: "Other Expense",
};

const subTypesByType: Record<string, string[]> = {
  ASSET: ["CURRENT_ASSET", "FIXED_ASSET", "BANK", "CASH", "ACCOUNTS_RECEIVABLE", "INVENTORY", "OTHER_ASSET"],
  LIABILITY: ["CURRENT_LIABILITY", "LONG_TERM_LIABILITY", "ACCOUNTS_PAYABLE", "OTHER_LIABILITY"],
  EQUITY: ["OWNERS_EQUITY", "RETAINED_EARNINGS", "OTHER_EQUITY"],
  REVENUE: ["SALES_REVENUE", "OTHER_REVENUE"],
  EXPENSE: ["COST_OF_GOODS_SOLD", "OPERATING_EXPENSE", "PAYROLL_EXPENSE", "OTHER_EXPENSE"],
};

const typeBadgeColors: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700",
  LIABILITY: "bg-red-100 text-red-700",
  EQUITY: "bg-purple-100 text-purple-700",
  REVENUE: "bg-green-100 text-green-700",
  EXPENSE: "bg-orange-100 text-orange-700",
};

function AccountTreeItem({
  node,
  level,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  searchQuery,
}: {
  node: TreeNode;
  level: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  searchQuery: string;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const matchesSearch =
    !searchQuery ||
    node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase());

  // Recursively check all descendants, not just direct children
  const hasDescendantMatch = (n: TreeNode): boolean => {
    return n.children.some(
      (child) =>
        child.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hasDescendantMatch(child)
    );
  };
  const descendantsMatch = searchQuery ? hasDescendantMatch(node) : false;

  if (searchQuery && !matchesSearch && !descendantsMatch) return null;

  return (
    <>
      <div
        className={`flex items-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-lg group ${
          !node.isActive ? "opacity-50" : ""
        }`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className="w-5 h-5 flex items-center justify-center"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        <span className="font-mono text-sm text-slate-500 w-16">{node.code}</span>
        <span className="flex-1 text-sm font-medium">{node.name}</span>

        <Badge variant="outline" className={typeBadgeColors[node.accountType]}>
          {accountTypeLabels[node.accountType]}
        </Badge>

        {node.isSystem && (
          <Badge variant="secondary" className="text-xs">
            System
          </Badge>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(node)}>
            Edit
          </Button>
          {!node.isSystem && node.children.length === 0 && node.transactionCount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(node)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {isExpanded &&
        node.children.map((child) => (
          <AccountTreeItem
            key={child.id}
            node={child}
            level={level + 1}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            searchQuery={searchQuery}
          />
        ))}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<FlatAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TreeNode | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<TreeNode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    accountType: "",
    accountSubType: "",
    description: "",
    parentId: "",
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [treeRes, flatRes] = await Promise.all([
        fetch("/api/accounts/tree"),
        fetch("/api/accounts"),
      ]);
      const treeData = await treeRes.json();
      const flatData = await flatRes.json();
      setTree(treeData);
      setFlatAccounts(flatData);

      // Expand top-level by default
      const topLevelIds = new Set<string>(treeData.map((n: TreeNode) => n.id));
      setExpanded(topLevelIds);
    } catch {
      toast.error("Failed to load chart of accounts");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        allIds.add(n.id);
        collect(n.children);
      }
    };
    collect(tree);
    setExpanded(allIds);
  };

  const collapseAll = () => setExpanded(new Set());

  const handleEdit = (node: TreeNode) => {
    setEditingAccount(node);
    setFormData({
      code: node.code,
      name: node.name,
      accountType: node.accountType,
      accountSubType: node.accountSubType,
      description: "",
      parentId: node.parentId || "",
      isActive: node.isActive,
    });
    // Fetch full account details to get description
    fetch(`/api/accounts/${node.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.description) {
          setFormData((prev) => ({ ...prev, description: data.description }));
        }
      })
      .catch(() => {});
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingAccount) {
        const response = await fetch(`/api/accounts/${editingAccount.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            parentId: formData.parentId || null,
            isActive: formData.isActive,
          }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to update");
        }
        toast.success("Account updated");
      } else {
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: formData.code,
            name: formData.name,
            accountType: formData.accountType,
            accountSubType: formData.accountSubType,
            description: formData.description || null,
            parentId: formData.parentId || null,
          }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to create");
        }
        toast.success("Account created");
      }

      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save account");
    }
  };

  const handleDelete = async () => {
    if (!deleteAccount) return;
    try {
      const response = await fetch(`/api/accounts/${deleteAccount.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete");
      }
      toast.success("Account deleted");
      setDeleteAccount(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      accountType: "",
      accountSubType: "",
      description: "",
      parentId: "",
      isActive: true,
    });
  };

  const availableSubTypes = formData.accountType
    ? subTypesByType[formData.accountType] || []
    : [];

  const parentOptions = flatAccounts.filter(
    (a) =>
      a.accountType === formData.accountType &&
      a.id !== editingAccount?.id
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Chart of Accounts</h2>
          <p className="text-slate-500">Manage your accounting structure</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingAccount(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingAccount ? "Edit Account" : "Add Account"}
                </DialogTitle>
                <DialogDescription>
                  {editingAccount
                    ? "Update account details."
                    : "Create a new account in the chart of accounts."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Code *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value })
                      }
                      disabled={!!editingAccount}
                      placeholder="e.g. 5210"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g. Rent"
                      required
                    />
                  </div>
                </div>
                {!editingAccount && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Account Type *</Label>
                        <Select
                          value={formData.accountType}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              accountType: value,
                              accountSubType: "",
                              parentId: "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(accountTypeLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Sub Type *</Label>
                        <Select
                          value={formData.accountSubType}
                          onValueChange={(value) =>
                            setFormData({ ...formData, accountSubType: value })
                          }
                          disabled={!formData.accountType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sub type" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubTypes.map((key) => (
                              <SelectItem key={key} value={key}>
                                {accountSubTypeLabels[key]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {parentOptions.length > 0 && (
                      <div className="grid gap-2">
                        <Label>Parent Account</Label>
                        <Select
                          value={formData.parentId}
                          onValueChange={(value) =>
                            setFormData({ ...formData, parentId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None (top-level)" />
                          </SelectTrigger>
                          <SelectContent>
                            {parentOptions.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Optional description"
                  />
                </div>
                {editingAccount && !editingAccount.isSystem && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingAccount ? "Update" : "Create"} Account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No accounts found</h3>
              <p className="text-sm text-slate-500">
                Add your first account to get started
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {tree.map((node) => (
                <AccountTreeItem
                  key={node.id}
                  node={node}
                  level={0}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onEdit={handleEdit}
                  onDelete={setDeleteAccount}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteAccount} onOpenChange={() => setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete account {deleteAccount?.code} - {deleteAccount?.name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
