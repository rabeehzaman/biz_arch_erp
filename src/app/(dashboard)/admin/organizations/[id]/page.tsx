"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, ArrowLeft, Loader2, Settings, Trash2, Shield, Receipt } from "lucide-react";
import { OrgSettingsDialog } from "../gst-config-dialog";
import { SidebarConfigDialog } from "../sidebar-config-dialog";
import { PageAnimation } from "@/components/ui/page-animation";
import Link from "next/link";

interface OrganizationDetails {
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

export default function OrganizationDetailsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Dialog states
    const [gstConfigOpen, setGstConfigOpen] = useState(false);
    const [sidebarConfigOpen, setSidebarConfigOpen] = useState(false);

    // Delete state
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    // Reset state
    const [resetTxOpen, setResetTxOpen] = useState(false);
    const [resetFullOpen, setResetFullOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetError, setResetError] = useState("");
    const [resetSuccess, setResetSuccess] = useState("");

    const fetchOrganization = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/organizations/${id}`);
            if (res.ok) {
                const data = await res.json();
                setOrganization(data);
            } else {
                setError("Failed to load organization details");
            }
        } catch {
            setError("Failed to load organization details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (session?.user?.role !== "superadmin") {
            router.push("/");
            return;
        }
        fetchOrganization();
    }, [session, router, fetchOrganization]);

    const handleDeleteOrg = async (e: React.MouseEvent) => {
        e.preventDefault();
        setDeleteError("");
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/admin/organizations/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                router.push("/admin/organizations");
            } else {
                const data = await res.json();
                setDeleteError(data.error || "Failed to delete organization");
            }
        } catch {
            setDeleteError("Failed to delete organization");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReset = async (type: "transactions_only" | "complete_reset") => {
        setResetError("");
        setResetSuccess("");
        setIsResetting(true);
        try {
            const res = await fetch(`/api/admin/organizations/${id}/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type }),
            });
            if (res.ok) {
                setResetSuccess(`Successfully performed ${type === "transactions_only" ? "transaction reset" : "complete reset"}.`);
                fetchOrganization();
                setResetTxOpen(false);
                setResetFullOpen(false);
            } else {
                const data = await res.json();
                setResetError(data.error || "Failed to reset organization");
            }
        } catch {
            setResetError("Failed to reset organization");
        } finally {
            setIsResetting(false);
        }
    };

    if (session?.user?.role !== "superadmin") {
        return null;
    }

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !organization) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <p className="text-xl font-medium text-destructive">{error || "Organization not found"}</p>
                <Button variant="outline" asChild>
                    <Link href="/admin/organizations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Organizations
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                        <Link href="/admin/organizations">
                            <ArrowLeft className="h-5 w-5" />
                            <span className="sr-only">Back</span>
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
                            <Badge variant="secondary">{organization.slug}</Badge>
                            {organization.gstEnabled && <Badge variant="default">GST Enabled</Badge>}
                        </div>
                        <p className="text-muted-foreground">Manage settings and configuration for this organization</p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Organization Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                                    <p className="text-sm">{new Date(organization.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">GSTIN</p>
                                    <p className="text-sm">{organization.gstin || "Not provided"}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Users</p>
                                    <p className="text-sm">{organization._count.users}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Customers</p>
                                    <p className="text-sm">{organization._count.customers}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Invoices</p>
                                    <p className="text-sm">{organization._count.invoices}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Configuration
                            </CardTitle>
                            <CardDescription>Configure features available for this organization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                                        <Receipt className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Organization Settings</h4>
                                        <p className="text-sm text-muted-foreground">Configure GST, alternate units, and other settings</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => setGstConfigOpen(true)}>Configure</Button>
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Sidebar Features</h4>
                                        <p className="text-sm text-muted-foreground">Manage accessible menu items</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => setSidebarConfigOpen(true)}>Configure</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-red-600 flex items-center gap-2">
                                <Trash2 className="h-5 w-5" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>Irreversible actions for this organization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {resetSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                                    {resetSuccess}
                                </div>
                            )}
                            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Reset Transactions Only</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently remove all transactions (invoices, bills, payments, journals) but keep master data such as products, customers, suppliers, chart of accounts, and settings.
                                    </p>
                                </div>
                                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setResetTxOpen(true)}>
                                    Reset Transactions
                                </Button>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-border/50">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Complete Reset</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently remove all data (transactions AND master data) associated with this organization. Administrative users will be kept, but the organization will be essentially new.
                                    </p>
                                </div>
                                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setResetFullOpen(true)}>
                                    Complete Reset
                                </Button>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-border/50">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Delete Organization</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently remove this organization and all its data. Only possible if the organization has no existing customers or invoices.
                                    </p>
                                </div>
                                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                                    Yes, Delete Organization
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {gstConfigOpen && (
                    <OrgSettingsDialog
                        open={gstConfigOpen}
                        onOpenChange={(open) => {
                            setGstConfigOpen(open);
                            if (!open) fetchOrganization();
                        }}
                        orgId={organization.id}
                        orgName={organization.name}
                    />
                )}

                {sidebarConfigOpen && (
                    <SidebarConfigDialog
                        open={sidebarConfigOpen}
                        onOpenChange={setSidebarConfigOpen}
                        orgId={organization.id}
                        orgName={organization.name}
                    />
                )}

                <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && !isDeleting && setDeleteOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the organization <strong className="text-foreground">{organization.name}</strong>.
                                This action cannot be undone. You can only delete organizations that have no associated data (customers, invoices, products, etc).
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {deleteError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {deleteError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <Button variant="destructive" onClick={handleDeleteOrg} disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete Organization
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetTxOpen} onOpenChange={(open) => !open && !isResetting && setResetTxOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reset Transactions?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete all transactions for <strong className="text-foreground">{organization.name}</strong>?
                                Master data like products, customers, and suppliers will be kept.
                                <br />
                                <span className="text-red-600 font-semibold mt-2 block">This action is irreversible and should be done with caution.</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {resetError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                            <Button variant="destructive" onClick={() => handleReset("transactions_only")} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Confirm Reset
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetFullOpen} onOpenChange={(open) => !open && !isResetting && setResetFullOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Complete Reset?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to perform a complete reset for <strong className="text-foreground">{organization.name}</strong>?
                                This will wipe ALL transactions and master data, effectively emptying the organization.
                                <br />
                                <span className="text-red-600 font-semibold mt-2 block">This action is irreversible and should be done with extreme caution.</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {resetError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                            <Button variant="destructive" onClick={() => handleReset("complete_reset")} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Confirm Full Reset
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </PageAnimation>
    );
}
