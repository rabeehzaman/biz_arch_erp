"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Search, GitBranch, Warehouse, Loader2, Star } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";


interface Branch {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    isActive: boolean;
    _count: { warehouses: number };
}

interface WarehouseItem {
    id: string;
    name: string;
    code: string;
    address: string | null;
    isActive: boolean;
    isDefault: boolean;
    branchId: string;
    branch: { id: string; name: string; code: string };
    _count: { stockLots: number; posSessions?: number };
}

function BranchesPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t } = useLanguage();
    const activeTab = searchParams.get("tab") === "warehouses"
        ? "warehouses"
        : "branches";

    // Branches state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchesLoaded, setBranchesLoaded] = useState(false);
    const [branchesLoading, setBranchesLoading] = useState(false);
    const [branchSearch, setBranchSearch] = useState("");
    const [branchDialogOpen, setBranchDialogOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [branchForm, setBranchForm] = useState({ name: "", code: "", address: "", city: "", state: "", phone: "" });
    const [branchSaving, setBranchSaving] = useState(false);

    // Warehouses state
    const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
    const [warehousesLoaded, setWarehousesLoaded] = useState(false);
    const [warehousesLoading, setWarehousesLoading] = useState(false);
    const [warehouseSearch, setWarehouseSearch] = useState("");
    const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
    const [warehouseForm, setWarehouseForm] = useState({ name: "", code: "", branchId: "", address: "" });
    const [warehouseSaving, setWarehouseSaving] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        if (activeTab === "branches" && !branchesLoaded) fetchBranches();
        else if (activeTab === "warehouses" && !warehousesLoaded) {
            fetchWarehouses();
            if (!branchesLoaded) fetchBranches(); // need branches for dropdown
        }
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchBranches = async () => {
        setBranchesLoading(true);
        try {
            const res = await fetch("/api/branches");
            if (res.ok) { setBranches(await res.json()); setBranchesLoaded(true); }
        } catch { toast.error(t("inventory.failedToLoadBranches")); }
        finally { setBranchesLoading(false); }
    };

    const fetchWarehouses = async () => {
        setWarehousesLoading(true);
        try {
            const res = await fetch("/api/warehouses");
            if (res.ok) { setWarehouses(await res.json()); setWarehousesLoaded(true); }
        } catch { toast.error(t("inventory.failedToLoadWarehouses")); }
        finally { setWarehousesLoading(false); }
    };

    // Branch CRUD
    const openBranchDialog = (branch?: Branch) => {
        if (branch) {
            setEditingBranch(branch);
            setBranchForm({ name: branch.name, code: branch.code, address: branch.address || "", city: branch.city || "", state: branch.state || "", phone: branch.phone || "" });
        } else {
            setEditingBranch(null);
            setBranchForm({ name: "", code: "", address: "", city: "", state: "", phone: "" });
        }
        setBranchDialogOpen(true);
    };

    const saveBranch = async () => {
        if (!branchForm.name || !branchForm.code) { toast.error(t("inventory.nameAndCodeRequired")); return; }
        setBranchSaving(true);
        try {
            const url = editingBranch ? `/api/branches/${editingBranch.id}` : "/api/branches";
            const method = editingBranch ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchForm) });
            if (res.ok) {
                toast.success(editingBranch ? t("inventory.branchUpdated") : t("inventory.branchCreated"));
                setBranchDialogOpen(false);
                fetchBranches();
            } else {
                const data = await res.json();
                toast.error(data.error || t("inventory.failedToSaveBranch"));
            }
        } catch { toast.error(t("inventory.failedToSaveBranch")); }
        finally { setBranchSaving(false); }
    };

    const deleteBranch = (id: string) => {
        setConfirmDialog({
            title: t("inventory.deleteBranch"),
            description: t("inventory.deleteBranchDesc"),
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
                    if (res.ok) { toast.success(t("inventory.branchDeleted")); fetchBranches(); }
                    else { const d = await res.json(); toast.error(d.error || t("inventory.failedToDeleteBranch")); }
                } catch { toast.error(t("inventory.failedToDeleteBranch")); }
            },
        });
    };

    // Warehouse CRUD
    const openWarehouseDialog = (wh?: WarehouseItem) => {
        if (wh) {
            setEditingWarehouse(wh);
            setWarehouseForm({ name: wh.name, code: wh.code, branchId: wh.branchId, address: wh.address || "" });
        } else {
            setEditingWarehouse(null);
            setWarehouseForm({ name: "", code: "", branchId: branches[0]?.id || "", address: "" });
        }
        setWarehouseDialogOpen(true);
    };

    const saveWarehouse = async () => {
        if (!warehouseForm.name || !warehouseForm.code || !warehouseForm.branchId) { toast.error(t("inventory.nameCodeBranchRequired")); return; }
        setWarehouseSaving(true);
        try {
            const url = editingWarehouse ? `/api/warehouses/${editingWarehouse.id}` : "/api/warehouses";
            const method = editingWarehouse ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(warehouseForm) });
            if (res.ok) {
                toast.success(editingWarehouse ? t("inventory.warehouseUpdated") : t("inventory.warehouseCreated"));
                setWarehouseDialogOpen(false);
                fetchWarehouses();
            } else {
                const data = await res.json();
                toast.error(data.error || t("inventory.failedToSaveWarehouse"));
            }
        } catch { toast.error(t("inventory.failedToSaveWarehouse")); }
        finally { setWarehouseSaving(false); }
    };

    const setDefaultWarehouse = async (id: string) => {
        try {
            const res = await fetch(`/api/warehouses/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isDefault: true }),
            });
            if (res.ok) {
                toast.success(t("inventory.defaultWarehouseUpdated"));
                fetchWarehouses();
            } else {
                const d = await res.json();
                toast.error(d.error || t("inventory.failedToUpdateDefaultWarehouse"));
            }
        } catch { toast.error(t("inventory.failedToUpdateDefaultWarehouse")); }
    };

    const deleteWarehouse = (id: string) => {
        setConfirmDialog({
            title: t("inventory.deleteWarehouse"),
            description: t("inventory.deleteWarehouseDesc"),
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
                    if (res.ok) { toast.success(t("inventory.warehouseDeleted")); fetchWarehouses(); }
                    else { const d = await res.json(); toast.error(d.error || t("inventory.failedToDeleteWarehouse")); }
                } catch { toast.error(t("inventory.failedToDeleteWarehouse")); }
            },
        });
    };

    const switchTab = (tab: string) => router.replace(`/inventory/branches?tab=${tab}`, { scroll: false });

    const filteredBranches = branches.filter((b) =>
        b.name.toLowerCase().includes(branchSearch.toLowerCase()) || b.code.toLowerCase().includes(branchSearch.toLowerCase())
    );
    const filteredWarehouses = warehouses.filter((w) =>
        w.name.toLowerCase().includes(warehouseSearch.toLowerCase()) || w.code.toLowerCase().includes(warehouseSearch.toLowerCase())
    );

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{t("inventory.branchesAndWarehouses")}</h2>
                    <p className="text-slate-500">{t("inventory.manageBranchesDesc")}</p>
                </div>

                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex gap-1">
                        <button onClick={() => switchTab("branches")} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === "branches" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>
                            {t("inventory.branches")}
                        </button>
                        <button onClick={() => switchTab("warehouses")} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === "warehouses" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>
                            {t("inventory.warehouses")}
                        </button>
                    </nav>
                </div>

                {/* Branches Tab */}
                {activeTab === "branches" && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={() => openBranchDialog()}>
                                <Plus className="mr-2 h-4 w-4" /> {t("inventory.addBranch")}
                            </Button>
                        </div>
                        <StaggerContainer className="space-y-4">
                            <StaggerItem>
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1 max-w-sm">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input placeholder={t("inventory.searchBranches")} value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} className="pl-10" />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {branchesLoading ? <TableSkeleton columns={6} rows={3} /> : filteredBranches.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <GitBranch className="h-12 w-12 text-slate-300" />
                                                <h3 className="mt-4 text-lg font-semibold">{t("inventory.noBranchesFound")}</h3>
                                                <p className="text-sm text-slate-500">{branchSearch ? t("common.tryDifferentSearch") : t("inventory.createFirstBranch")}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-3 sm:hidden">
                                                    {filteredBranches.map((branch) => (
                                                        <div key={branch.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-slate-900">{branch.name}</p>
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        <Badge variant="outline">{branch.code}</Badge>
                                                                        <Badge variant={branch.isActive ? "default" : "secondary"}>
                                                                            {branch.isActive ? t("common.active") : t("common.inactive")}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.city")}</p>
                                                                    <p className="mt-1 text-slate-900">{branch.city || "-"}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.phone")}</p>
                                                                    <p className="mt-1 text-slate-900">{branch.phone || "-"}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.warehouses")}</p>
                                                                    <p className="mt-1 font-medium text-slate-900">{branch._count.warehouses}</p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                                <Button variant="outline" className="min-h-[44px]" onClick={() => openBranchDialog(branch)}>
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    {t("common.edit")}
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    className="min-h-[44px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                    onClick={() => deleteBranch(branch.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    {t("common.delete")}
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
                                                                <TableHead>{t("common.code")}</TableHead>
                                                                <TableHead className="hidden sm:table-cell">{t("common.city")}</TableHead>
                                                                <TableHead className="hidden sm:table-cell">{t("common.phone")}</TableHead>
                                                                <TableHead>{t("inventory.warehouses")}</TableHead>
                                                                <TableHead>{t("common.status")}</TableHead>
                                                                <TableHead className="text-right">{t("common.actions")}</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {filteredBranches.map((branch) => (
                                                                <TableRow key={branch.id}>
                                                                    <TableCell className="font-medium">{branch.name}</TableCell>
                                                                    <TableCell><Badge variant="outline">{branch.code}</Badge></TableCell>
                                                                    <TableCell className="hidden sm:table-cell">{branch.city || "-"}</TableCell>
                                                                    <TableCell className="hidden sm:table-cell">{branch.phone || "-"}</TableCell>
                                                                    <TableCell>{branch._count.warehouses}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={branch.isActive ? "default" : "secondary"}>
                                                                            {branch.isActive ? t("common.active") : t("common.inactive")}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button variant="ghost" size="icon" onClick={() => openBranchDialog(branch)}>
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" onClick={() => deleteBranch(branch.id)}>
                                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                                        </Button>
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
                    </div>
                )}

                {/* Warehouses Tab */}
                {activeTab === "warehouses" && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={() => openWarehouseDialog()}>
                                <Plus className="mr-2 h-4 w-4" /> {t("inventory.addWarehouse")}
                            </Button>
                        </div>
                        <StaggerContainer className="space-y-4">
                            <StaggerItem>
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1 max-w-sm">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input placeholder={t("inventory.searchWarehouses")} value={warehouseSearch} onChange={(e) => setWarehouseSearch(e.target.value)} className="pl-10" />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {warehousesLoading ? <TableSkeleton columns={5} rows={3} /> : filteredWarehouses.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <Warehouse className="h-12 w-12 text-slate-300" />
                                                <h3 className="mt-4 text-lg font-semibold">{t("inventory.noWarehousesFound")}</h3>
                                                <p className="text-sm text-slate-500">{warehouseSearch ? t("common.tryDifferentSearch") : t("inventory.createFirstWarehouse")}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-3 sm:hidden">
                                                    {filteredWarehouses.map((wh) => (
                                                        <div key={wh.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="font-semibold text-slate-900">{wh.name}</p>
                                                                        <Badge variant="outline">{wh.code}</Badge>
                                                                        {wh.isDefault && (
                                                                            <Badge variant="secondary" className="text-xs">
                                                                                <Star className="mr-1 h-3 w-3 fill-current" />
                                                                                {t("common.default")}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="mt-2">
                                                                        <Badge variant={wh.isActive ? "default" : "secondary"}>
                                                                            {wh.isActive ? t("common.active") : t("common.inactive")}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.branch")}</p>
                                                                    <p className="mt-1 text-slate-900">{wh.branch.name}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.stockLots")}</p>
                                                                    <p className="mt-1 font-medium text-slate-900">{wh._count.stockLots}</p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 grid gap-2">
                                                                {!wh.isDefault && (
                                                                    <Button variant="outline" className="min-h-[44px]" onClick={() => setDefaultWarehouse(wh.id)}>
                                                                        <Star className="mr-2 h-4 w-4" />
                                                                        {t("inventory.setAsDefault")}
                                                                    </Button>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <Button variant="outline" className="min-h-[44px]" onClick={() => openWarehouseDialog(wh)}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        {t("common.edit")}
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        className="min-h-[44px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                        onClick={() => deleteWarehouse(wh.id)}
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        {t("common.delete")}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="hidden sm:block">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>{t("common.name")}</TableHead>
                                                                <TableHead>{t("common.code")}</TableHead>
                                                                <TableHead>{t("inventory.branch")}</TableHead>
                                                                <TableHead className="hidden sm:table-cell">{t("inventory.stockLots")}</TableHead>
                                                                <TableHead>{t("common.status")}</TableHead>
                                                                <TableHead className="text-right">{t("common.actions")}</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {filteredWarehouses.map((wh) => (
                                                                <TableRow key={wh.id}>
                                                                    <TableCell className="font-medium">
                                                                        <div className="flex items-center gap-2">
                                                                            {wh.name}
                                                                            {wh.isDefault && (
                                                                                <Badge variant="secondary" className="text-xs">
                                                                                    <Star className="mr-1 h-3 w-3 fill-current" />
                                                                                    {t("common.default")}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell><Badge variant="outline">{wh.code}</Badge></TableCell>
                                                                    <TableCell>{wh.branch.name}</TableCell>
                                                                    <TableCell className="hidden sm:table-cell">{wh._count.stockLots}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={wh.isActive ? "default" : "secondary"}>
                                                                            {wh.isActive ? t("common.active") : t("common.inactive")}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {!wh.isDefault && (
                                                                            <Button variant="ghost" size="icon" title={t("inventory.setAsDefault")} onClick={() => setDefaultWarehouse(wh.id)}>
                                                                                <Star className="h-4 w-4 text-slate-400" />
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="ghost" size="icon" onClick={() => openWarehouseDialog(wh)}>
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" onClick={() => deleteWarehouse(wh.id)}>
                                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                                        </Button>
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
                    </div>
                )}

                {/* Branch Dialog */}
                <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingBranch ? t("inventory.editBranch") : t("inventory.addBranch")}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("common.name")} *</Label>
                                    <Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} placeholder={t("inventory.branchNamePlaceholder")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("common.code")} *</Label>
                                    <Input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} placeholder={t("inventory.branchCodePlaceholder")} maxLength={10} className="font-mono" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("common.address")}</Label>
                                <Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} placeholder="123 Business St" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("common.city")}</Label>
                                    <Input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("settings.state")}</Label>
                                    <Input value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("common.phone")}</Label>
                                <Input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>{t("common.cancel")}</Button>
                            <Button onClick={saveBranch} disabled={branchSaving}>
                                {branchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingBranch ? t("common.update") : t("common.create")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Warehouse Dialog */}
                <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingWarehouse ? t("inventory.editWarehouse") : t("inventory.addWarehouse")}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("common.name")} *</Label>
                                    <Input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} placeholder={t("inventory.warehouseNamePlaceholder")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("common.code")} *</Label>
                                    <Input value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })} placeholder={t("inventory.warehouseCodePlaceholder")} maxLength={10} className="font-mono" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("inventory.branch")} *</Label>
                                <Select value={warehouseForm.branchId} onValueChange={(v) => setWarehouseForm({ ...warehouseForm, branchId: v })}>
                                    <SelectTrigger><SelectValue placeholder={t("inventory.selectBranch")} /></SelectTrigger>
                                    <SelectContent>
                                        {branches.filter((b) => b.isActive).map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("common.address")}</Label>
                                <Input value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>{t("common.cancel")}</Button>
                            <Button onClick={saveWarehouse} disabled={warehouseSaving}>
                                {warehouseSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingWarehouse ? t("common.update") : t("common.create")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {confirmDialog && (
                    <ConfirmDialog
                        open={!!confirmDialog}
                        onOpenChange={(open) => !open && setConfirmDialog(null)}
                        title={confirmDialog.title}
                        description={confirmDialog.description}
                        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                    />
                )}
            </div>
        </PageAnimation>
    );
}

export default function BranchesPage() {
    return (
        <Suspense>
            <BranchesPageContent />
        </Suspense>
    );
}
