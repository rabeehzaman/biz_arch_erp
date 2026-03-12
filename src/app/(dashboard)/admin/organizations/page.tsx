"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Plus, Users, FileText, ShoppingCart, Loader2, UserPlus, ChevronRight, Copy, MoreHorizontal, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageAnimation } from "@/components/ui/page-animation";

interface Organization {
  id: string;
  name: string;
  slug: string;
  gstEnabled: boolean;
  gstin: string | null;
  createdAt: string;
  _count: {
    users: number;
    customers: number;
    invoices: number;
  };
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  // User creation state
  const [userOpen, setUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [userOrgId, setUserOrgId] = useState("");
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");

  // Duplicate org state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateSourceOrg, setDuplicateSourceOrg] = useState<Organization | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateSlug, setDuplicateSlug] = useState("");
  const [duplicateIncludeTransactions, setDuplicateIncludeTransactions] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");



  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
      }
    } catch {
      console.error("Failed to fetch organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleCreate = async () => {
    setError("");
    if (!name || !slug) {
      setError("Name and slug are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      if (res.ok) {
        setCreateOpen(false);
        setName("");
        setSlug("");
        fetchOrganizations();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create organization");
      }
    } catch {
      setError("Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateUser = async () => {
    setUserError("");
    setUserSuccess("");
    if (!userName || !userEmail || !userPassword || !userOrgId) {
      setUserError("All fields are required");
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password: userPassword,
          role: userRole,
          organizationId: userOrgId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUserSuccess(`User "${data.name}" created successfully!`);
        setUserName("");
        setUserEmail("");
        setUserPassword("");
        setUserRole("admin");
        setUserOrgId("");
        fetchOrganizations();
      } else {
        const data = await res.json();
        setUserError(data.error || "Failed to create user");
      }
    } catch {
      setUserError("Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const openDuplicateDialog = (org: Organization) => {
    setDuplicateSourceOrg(org);
    setDuplicateName(`${org.name} (Copy)`);
    setDuplicateSlug(`${org.slug}-copy`);
    setDuplicateIncludeTransactions(false);
    setDuplicateError("");
    setDuplicateOpen(true);
  };

  const handleDuplicateNameChange = (value: string) => {
    setDuplicateName(value);
    setDuplicateSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleDuplicate = async () => {
    setDuplicateError("");
    if (!duplicateName || !duplicateSlug || !duplicateSourceOrg) {
      setDuplicateError("Name and slug are required");
      return;
    }

    setDuplicating(true);
    try {
      const res = await fetch(`/api/admin/organizations/${duplicateSourceOrg.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: duplicateName,
          slug: duplicateSlug,
          includeTransactions: duplicateIncludeTransactions
        }),
      });

      if (res.ok) {
        setDuplicateOpen(false);
        setDuplicateSourceOrg(null);
        setDuplicateName("");
        setDuplicateSlug("");
        fetchOrganizations();
      } else {
        const data = await res.json();
        setDuplicateError(data.error || "Failed to duplicate organization");
      }
    } catch {
      setDuplicateError("Failed to duplicate organization");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
            <p className="text-muted-foreground">Manage tenant organizations</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={userOpen} onOpenChange={(open) => { setUserOpen(open); if (!open) { setUserError(""); setUserSuccess(""); } }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                  <DialogDescription>
                    Create a new user and assign them to an organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Full Name</Label>
                    <Input
                      id="userName"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">Email</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPassword">Password</Label>
                    <Input
                      id="userPassword"
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userRole">Role</Label>
                    <Select value={userRole} onValueChange={setUserRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userOrg">Organization</Label>
                    <Select value={userOrgId} onValueChange={setUserOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {userError && (
                    <p className="text-sm text-red-500">{userError}</p>
                  )}
                  {userSuccess && (
                    <p className="text-sm text-green-600">{userSuccess}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUserOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser} disabled={creatingUser}>
                    {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Organization</DialogTitle>
                  <DialogDescription>
                    Add a new tenant organization to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="acme-corp"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lowercase letters, numbers, and hyphens only
                    </p>
                  </div>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>
              {organizations.length} organization{organizations.length !== 1 ? "s" : ""} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {organizations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-muted-foreground">
                      No organizations found
                    </div>
                  ) : (
                    organizations.map((org) => (
                      <div key={org.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <p className="font-semibold text-slate-900">{org.name}</p>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary">{org.slug}</Badge>
                              {org.gstEnabled ? (
                                <Badge variant="default" className="text-xs">GST</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">No GST</Badge>
                              )}
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDuplicateDialog(org)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate Organization
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Users</p>
                            <p className="mt-1 font-medium text-slate-900">{org._count.users}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Customers</p>
                            <p className="mt-1 font-medium text-slate-900">{org._count.customers}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Invoices</p>
                            <p className="mt-1 font-medium text-slate-900">{org._count.invoices}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Created</p>
                            <p className="mt-1 text-slate-900">{new Date(org.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <Button variant="outline" className="mt-4 min-h-[44px] w-full" onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Open details
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="text-center">Users</TableHead>
                        <TableHead className="text-center">Customers</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>GST</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations.map((org) => (
                        <TableRow
                          key={org.id}
                          onClick={() => router.push(`/admin/organizations/${org.id}`)}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                        >
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground mr-2" />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {org.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{org.slug}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {org._count.users}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                              {org._count.customers}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              {org._count.invoices}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(org.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {org.gstEnabled ? (
                              <Badge variant="default" className="text-xs">GST</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">No GST</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/admin/organizations/${org.id}`);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDuplicateDialog(org);
                                  }}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate Organization
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {organizations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No organizations found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Duplicate Organization Dialog */}
        <Dialog open={duplicateOpen} onOpenChange={(open) => { setDuplicateOpen(open); if (!open) { setDuplicateError(""); setDuplicateSourceOrg(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate Organization</DialogTitle>
              <DialogDescription>
                Create a copy of <strong>{duplicateSourceOrg?.name}</strong> with all its configuration
                (accounts, products, categories, units, settings, branches).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="duplicateName">New Organization Name</Label>
                <Input
                  id="duplicateName"
                  value={duplicateName}
                  onChange={(e) => handleDuplicateNameChange(e.target.value)}
                  placeholder="Acme Corp (Copy)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duplicateSlug">Slug</Label>
                <Input
                  id="duplicateSlug"
                  value={duplicateSlug}
                  onChange={(e) => setDuplicateSlug(e.target.value)}
                  placeholder="acme-corp-copy"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="includeTransactions"
                  checked={duplicateIncludeTransactions}
                  onCheckedChange={(checked) => setDuplicateIncludeTransactions(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="includeTransactions"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include Transactional Data
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Copy all customers, suppliers, invoices, payments, journal entries, and stock records.
                  </p>
                </div>
              </div>

              {duplicateError && (
                <p className="text-sm text-red-500">{duplicateError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDuplicate} disabled={duplicating}>
                {duplicating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PageAnimation>
  );
}
