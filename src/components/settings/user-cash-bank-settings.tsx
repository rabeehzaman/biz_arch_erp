"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users, Wallet, Loader2, ShieldCheck } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface CashBankAccountInfo {
    id: string;
    name: string;
    accountSubType: string;
    bankName: string | null;
    accountNumber: string | null;
}

interface AccessRow {
    id: string;
    isDefault: boolean;
    user: { id: string; name: string; email: string };
    cashBankAccount: CashBankAccountInfo;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

export function UserCashBankSettings() {
    const { t } = useLanguage();
    const [access, setAccess] = useState<AccessRow[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [accounts, setAccounts] = useState<CashBankAccountInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ userId: "", cashBankAccountId: "", isDefault: false });
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [accRes, usrRes, cbRes] = await Promise.all([
                fetch("/api/user-cash-bank-access"),
                fetch("/api/users"),
                fetch("/api/cash-bank-accounts"),
            ]);
            if (accRes.ok) setAccess(await accRes.json());
            if (usrRes.ok) setUsers(await usrRes.json());
            if (cbRes.ok) {
                const data = await cbRes.json();
                setAccounts(
                    data.map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        accountSubType: a.accountSubType,
                        bankName: a.bankName,
                        accountNumber: a.accountNumber,
                    }))
                );
            }
        } catch {
            toast.error(t("userCashBank.loadFailed"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openDialog = () => {
        setForm({ userId: "", cashBankAccountId: "", isDefault: false });
        setDialogOpen(true);
    };

    const save = async () => {
        if (!form.userId || !form.cashBankAccountId) {
            toast.error(t("userCashBank.userAndAccountRequired"));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/user-cash-bank-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success(t("userCashBank.accessGranted"));
                setDialogOpen(false);
                fetchAll();
            } else {
                const d = await res.json();
                toast.error(d.error || t("userCashBank.grantFailed"));
            }
        } catch {
            toast.error(t("userCashBank.grantFailed"));
        } finally {
            setSaving(false);
        }
    };

    const revoke = (row: AccessRow) => {
        setConfirmDialog({
            title: t("userCashBank.revokeAccess"),
            description: `Remove ${row.user.name}'s access to ${row.cashBankAccount.name}?`,
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/user-cash-bank-access?id=${row.id}`, { method: "DELETE" });
                    if (res.ok) { toast.success(t("userCashBank.accessRevoked")); fetchAll(); }
                    else { const d = await res.json(); toast.error(d.error || t("userCashBank.grantFailed")); }
                } catch { toast.error(t("userCashBank.grantFailed")); }
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500">
                        {t("userCashBank.description")}
                    </p>
                </div>
                <Button onClick={openDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("userCashBank.grantAccess")}
                </Button>
            </div>

            {loading ? (
                <TableSkeleton columns={5} rows={4} />
            ) : access.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-slate-50">
                    <ShieldCheck className="h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="font-semibold text-slate-700">{t("userCashBank.noAssignments")}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {t("userCashBank.noAssignmentsDesc")}
                    </p>
                    <Button onClick={openDialog} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("userCashBank.grantFirstAccess")}
                    </Button>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("common.user")}</TableHead>
                            <TableHead>{t("common.account")}</TableHead>
                            <TableHead>{t("common.type")}</TableHead>
                            <TableHead className="text-center">{t("common.default")}</TableHead>
                            <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {access.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Users className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{row.user.name}</p>
                                            <p className="text-xs text-slate-400">{row.user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Wallet className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-sm font-medium">{row.cashBankAccount.name}</span>
                                    </div>
                                    {row.cashBankAccount.bankName && (
                                        <p className="text-xs text-slate-400 mt-0.5">{row.cashBankAccount.bankName}</p>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                        {row.cashBankAccount.accountSubType}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    {row.isDefault && (
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Default</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => revoke(row)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Grant Access Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("userCashBank.grantAccountAccess")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t("common.user")} *</Label>
                            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                                <SelectTrigger><SelectValue placeholder={t("userCashBank.selectUser")} /></SelectTrigger>
                                <SelectContent>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name} — {u.email} ({u.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t("userCashBank.selectAccount")} *</Label>
                            <Select value={form.cashBankAccountId} onValueChange={(v) => setForm({ ...form, cashBankAccountId: v })}>
                                <SelectTrigger><SelectValue placeholder={t("userCashBank.selectAccount")} /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.name} ({a.accountSubType}){a.bankName ? ` — ${a.bankName}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                id="isDefaultCashBank"
                                checked={form.isDefault}
                                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                            />
                            <Label htmlFor="isDefaultCashBank" className="cursor-pointer">
                                {t("userCashBank.setAsDefault")}
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                        <Button onClick={save} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("userCashBank.grantAccess")}
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
                    variant="destructive"
                />
            )}
        </div>
    );
}
