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
import { useLanguage } from "@/lib/i18n";

interface Organization {
  id: string;
  name: string;
  slug: string;
  edition: string;
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
  const { t } = useLanguage();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [edition, setEdition] = useState("INDIA");
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
      setError(t("admin.nameAndSlugRequired"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, edition }),
      });

      if (res.ok) {
        setCreateOpen(false);
        setName("");
        setSlug("");
        fetchOrganizations();
      } else {
        const data = await res.json();
        setError(data.error || t("admin.failedToCreateOrg"));
      }
    } catch {
      setError(t("admin.failedToCreateOrg"));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateUser = async () => {
    setUserError("");
    setUserSuccess("");
    if (!userName || !userEmail || !userPassword || !userOrgId) {
      setUserError(t("admin.allFieldsRequired"));
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
        setUserSuccess(t("admin.userCreatedSuccess"));
        setUserName("");
        setUserEmail("");
        setUserPassword("");
        setUserRole("admin");
        setUserOrgId("");
        fetchOrganizations();
      } else {
        const data = await res.json();
        setUserError(data.error || t("admin.failedToCreateUser"));
      }
    } catch {
      setUserError(t("admin.failedToCreateUser"));
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
      setDuplicateError(t("admin.nameAndSlugRequired"));
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
        setDuplicateError(data.error || t("admin.failedToDuplicateOrg"));
      }
    } catch {
      setDuplicateError(t("admin.failedToDuplicateOrg"));
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.organizations")}</h1>
            <p className="text-muted-foreground">{t("admin.manageOrganizations")}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={userOpen} onOpenChange={(open) => { setUserOpen(open); if (!open) { setUserError(""); setUserSuccess(""); } }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("admin.createUser")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.createUser")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.createUserDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">{t("admin.fullName")}</Label>
                    <Input
                      id="userName"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">{t("admin.email")}</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPassword">{t("admin.password")}</Label>
                    <Input
                      id="userPassword"
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userRole">{t("admin.role")}</Label>
                    <Select value={userRole} onValueChange={setUserRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t("admin.roleAdmin")}</SelectItem>
                        <SelectItem value="user">{t("admin.roleUser")}</SelectItem>
                        <SelectItem value="pos">{t("admin.rolePosOnly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userOrg">{t("admin.organization")}</Label>
                    <Select value={userOrgId} onValueChange={setUserOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.selectOrganization")} />
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
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={handleCreateUser} disabled={creatingUser}>
                    {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("admin.createUser")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.newOrganization")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.createOrganization")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.createOrgDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("admin.organizationName")}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">{t("admin.slug")}</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="acme-corp"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.slugHelp")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("edition.edition")}</Label>
                    <Select value={edition} onValueChange={setEdition}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INDIA">{"\u{1F1EE}\u{1F1F3}"} {t("edition.india")}</SelectItem>
                        <SelectItem value="SAUDI">{"\u{1F1F8}\u{1F1E6}"} {t("edition.saudi")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("edition.editionDesc")}
                    </p>
                  </div>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("common.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.allOrganizations")}</CardTitle>
            <CardDescription>
              {t("admin.orgTotal").replace("{count}", String(organizations.length))}
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
                      {t("admin.noOrganizationsFound")}
                    </div>
                  ) : (
                    organizations.map((org) => (
                      <div key={org.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <p className="font-semibold text-slate-900">{org.name}</p>
                              <span className="text-xs">{org.edition === "SAUDI" ? "\u{1F1F8}\u{1F1E6}" : "\u{1F1EE}\u{1F1F3}"}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary">{org.slug}</Badge>
                              <Badge variant="outline" className="text-xs">{org.edition === "SAUDI" ? t("edition.saudi") : t("edition.india")}</Badge>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">{t("common.actions")}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t("admin.viewDetails")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDuplicateDialog(org)}>
                                <Copy className="mr-2 h-4 w-4" />
                                {t("admin.duplicateOrganization")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.users")}</p>
                            <p className="mt-1 font-medium text-slate-900">{org._count.users}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.customers")}</p>
                            <p className="mt-1 font-medium text-slate-900">{org._count.customers}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.invoices")}</p>
                            <p className="mt-1 font-medium text-slate-900">{org._count.invoices}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.created")}</p>
                            <p className="mt-1 text-slate-900">{new Date(org.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <Button variant="outline" className="mt-4 min-h-[44px] w-full" onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t("admin.openDetails")}
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
                        <TableHead>{t("admin.organization")}</TableHead>
                        <TableHead>{t("admin.slug")}</TableHead>
                        <TableHead className="text-center">{t("admin.users")}</TableHead>
                        <TableHead className="text-center">{t("admin.customers")}</TableHead>
                        <TableHead className="text-center">{t("admin.invoices")}</TableHead>
                        <TableHead>{t("admin.created")}</TableHead>
                        <TableHead>{t("edition.edition")}</TableHead>
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
                              <span className="text-xs">{org.edition === "SAUDI" ? "\u{1F1F8}\u{1F1E6}" : "\u{1F1EE}\u{1F1F3}"}</span>
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
                            <Badge variant="outline" className="text-xs">
                              {org.edition === "SAUDI" ? t("edition.saudi") : t("edition.india")}
                            </Badge>
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
                                  <span className="sr-only">{t("common.actions")}</span>
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
                                  {t("admin.viewDetails")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDuplicateDialog(org);
                                  }}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  {t("admin.duplicateOrganization")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {organizations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            {t("admin.noOrganizationsFound")}
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
              <DialogTitle>{t("admin.duplicateOrganization")}</DialogTitle>
              <DialogDescription>
                {t("admin.duplicateOrgDesc")} — <strong>{duplicateSourceOrg?.name}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="duplicateName">{t("admin.newOrgName")}</Label>
                <Input
                  id="duplicateName"
                  value={duplicateName}
                  onChange={(e) => handleDuplicateNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duplicateSlug">{t("admin.slug")}</Label>
                <Input
                  id="duplicateSlug"
                  value={duplicateSlug}
                  onChange={(e) => setDuplicateSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.slugHelp")}
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
                    {t("admin.includeTransactionalData")}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.includeTransactionalDataDesc")}
                  </p>
                </div>
              </div>

              {duplicateError && (
                <p className="text-sm text-red-500">{duplicateError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleDuplicate} disabled={duplicating}>
                {duplicating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Copy className="mr-2 h-4 w-4" />
                {t("admin.duplicate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PageAnimation>
  );
}
