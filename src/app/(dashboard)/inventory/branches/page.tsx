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
import { Plus, Pencil, Trash2, Search, GitBranch, Warehouse, Loader2 } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    branchId: string;
    branch: { id: string; name: string; code: string };
    _count: { stockLots: number; posSessions?: number };
}

function BranchesPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") === "warehouses" ? "warehouses" : "branches";

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
        } catch { toast.error("Failed to load branches"); }
        finally { setBranchesLoading(false); }
    };

    const fetchWarehouses = async () => {
        setWarehousesLoading(true);
        try {
            const res = await fetch("/api/warehouses");
            if (res.ok) { setWarehouses(await res.json()); setWarehousesLoaded(true); }
        } catch { toast.error("Failed to load warehouses"); }
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
        if (!branchForm.name || !branchForm.code) { toast.error("Name and code are required"); return; }
        setBranchSaving(true);
        try {
            const url = editingBranch ? `/api/branches/${editingBranch.id}` : "/api/branches";
            const method = editingBranch ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchForm) });
            if (res.ok) {
                toast.success(editingBranch ? "Branch updated" : "Branch created");
                setBranchDialogOpen(false);
                fetchBranches();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to save branch");
            }
        } catch { toast.error("Failed to save branch"); }
        finally { setBranchSaving(false); }
    };

    const deleteBranch = (id: string) => {
        setConfirmDialog({
            title: "Delete Branch",
            description: "This will permanently delete this branch and all its warehouses. This cannot be undone.",
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
                    if (res.ok) { toast.success("Branch deleted"); fetchBranches(); }
                    else { const d = await res.json(); toast.error(d.error || "Failed to delete"); }
                } catch { toast.error("Failed to delete branch"); }
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
        if (!warehouseForm.name || !warehouseForm.code || !warehouseForm.branchId) { toast.error("Name, code, and branch are required"); return; }
        setWarehouseSaving(true);
        try {
            const url = editingWarehouse ? `/api/warehouses/${editingWarehouse.id}` : "/api/warehouses";
            const method = editingWarehouse ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(warehouseForm) });
            if (res.ok) {
                toast.success(editingWarehouse ? "Warehouse updated" : "Warehouse created");
                setWarehouseDialogOpen(false);
                fetchWarehouses();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to save warehouse");
            }
        } catch { toast.error("Failed to save warehouse"); }
        finally { setWarehouseSaving(false); }
    };

    const deleteWarehouse = (id: string) => {
        setConfirmDialog({
            title: "Delete Warehouse",
            description: "This will permanently delete this warehouse. This cannot be undone.",
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
                    if (res.ok) { toast.success("Warehouse deleted"); fetchWarehouses(); }
                    else { const d = await res.json(); toast.error(d.error || "Failed to delete"); }
                } catch { toast.error("Failed to delete warehouse"); }
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
                    <h2 className="text-2xl font-bold text-slate-900">Branches & Warehouses</h2>
                    <p className="text-slate-500">Manage your organization locations and storage facilities</p>
                </div>

                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex gap-1">
                        <button onClick={() => switchTab("branches")} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === "branches" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>
                            Branches
                        </button>
                        <button onClick={() => switchTab("warehouses")} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === "warehouses" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>
                            Warehouses
                        </button>
                    </nav>
                </div>

                {/* Branches Tab */}
                {activeTab === "branches" && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={() => openBranchDialog()}>
                                <Plus className="mr-2 h-4 w-4" /> Add Branch
                            </Button>
                        </div>
                        <StaggerContainer className="space-y-4">
                            <StaggerItem>
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1 max-w-sm">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input placeholder="Search branches..." value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} className="pl-10" />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {branchesLoading ? <TableSkeleton columns={6} rows={3} /> : filteredBranches.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <GitBranch className="h-12 w-12 text-slate-300" />
                                                <h3 className="mt-4 text-lg font-semibold">No branches found</h3>
                                                <p className="text-sm text-slate-500">{branchSearch ? "Try a different search term" : "Create your first branch"}</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Code</TableHead>
                                                        <TableHead className="hidden sm:table-cell">City</TableHead>
                                                        <TableHead className="hidden sm:table-cell">Phone</TableHead>
                                                        <TableHead>Warehouses</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
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
                                                                    {branch.isActive ? "Active" : "Inactive"}
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
                                <Plus className="mr-2 h-4 w-4" /> Add Warehouse
                            </Button>
                        </div>
                        <StaggerContainer className="space-y-4">
                            <StaggerItem>
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1 max-w-sm">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input placeholder="Search warehouses..." value={warehouseSearch} onChange={(e) => setWarehouseSearch(e.target.value)} className="pl-10" />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {warehousesLoading ? <TableSkeleton columns={5} rows={3} /> : filteredWarehouses.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <Warehouse className="h-12 w-12 text-slate-300" />
                                                <h3 className="mt-4 text-lg font-semibold">No warehouses found</h3>
                                                <p className="text-sm text-slate-500">{warehouseSearch ? "Try a different search term" : "Create your first warehouse"}</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Code</TableHead>
                                                        <TableHead>Branch</TableHead>
                                                        <TableHead>Stock Lots</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredWarehouses.map((wh) => (
                                                        <TableRow key={wh.id}>
                                                            <TableCell className="font-medium">{wh.name}</TableCell>
                                                            <TableCell><Badge variant="outline">{wh.code}</Badge></TableCell>
                                                            <TableCell>{wh.branch.name}</TableCell>
                                                            <TableCell>{wh._count.stockLots}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={wh.isActive ? "default" : "secondary"}>
                                                                    {wh.isActive ? "Active" : "Inactive"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
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
                            <DialogTitle>{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name *</Label>
                                    <Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} placeholder="Head Office" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Code *</Label>
                                    <Input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} placeholder="HO" maxLength={10} className="font-mono" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} placeholder="123 Business St" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>City</Label>
                                    <Input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>State</Label>
                                    <Input value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveBranch} disabled={branchSaving}>
                                {branchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingBranch ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Warehouse Dialog */}
                <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name *</Label>
                                    <Input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} placeholder="Main Warehouse" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Code *</Label>
                                    <Input value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })} placeholder="MW" maxLength={10} className="font-mono" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Branch *</Label>
                                <Select value={warehouseForm.branchId} onValueChange={(v) => setWarehouseForm({ ...warehouseForm, branchId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                                    <SelectContent>
                                        {branches.filter((b) => b.isActive).map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveWarehouse} disabled={warehouseSaving}>
                                {warehouseSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingWarehouse ? "Update" : "Create"}
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
