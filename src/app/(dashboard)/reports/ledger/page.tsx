"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

interface LedgerTransaction {
    id: string;
    date: string;
    ref: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export default function UnifiedLedgerPage() {
    const searchParams = useSearchParams();
    const initialAccountId = searchParams.get("accountId");

    const [entityType, setEntityType] = useState<string>(initialAccountId ? "ACCOUNT" : "");
    const [entities, setEntities] = useState<any[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>(initialAccountId || "");
    const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
    const [isLoadingEntities, setIsLoadingEntities] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => {
        if (initialAccountId) {
            const fetchInitialLedger = async () => {
                setIsLoadingData(true);
                try {
                    const res = await fetch(`/api/reports/ledger?type=ACCOUNT&id=${initialAccountId}`);
                    if (!res.ok) throw new Error("Failed to load ledger");
                    const data = await res.json();
                    setTransactions(data);
                } catch {
                    toast.error("Failed to load ledger transactions");
                } finally {
                    setIsLoadingData(false);
                }
            };
            fetchInitialLedger();
        }
    }, [initialAccountId]);

    useEffect(() => {
        if (!entityType) {
            setEntities([]);
            setSelectedEntityId("");
            return;
        }

        const fetchEntities = async () => {
            setIsLoadingEntities(true);
            try {
                let url = "";
                if (entityType === "ACCOUNT") url = "/api/accounts";
                else if (entityType === "CUSTOMER") url = "/api/customers";
                else if (entityType === "SUPPLIER") url = "/api/suppliers";

                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                setEntities(data);
            } catch {
                toast.error("Failed to load entities");
            } finally {
                setIsLoadingEntities(false);
            }
        };

        fetchEntities();
    }, [entityType]);

    const loadLedger = async () => {
        if (!entityType || !selectedEntityId) return;

        setIsLoadingData(true);
        try {
            const res = await fetch(`/api/reports/ledger?type=${entityType}&id=${selectedEntityId}`);
            if (!res.ok) throw new Error("Failed to load ledger");
            const data = await res.json();
            setTransactions(data);
        } catch {
            toast.error("Failed to load ledger transactions");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Unified Ledger</h2>
                    <p className="text-slate-500">View detailed transactions for any account, customer, or supplier</p>
                </div>

                <Card className="print:hidden">
                    <CardHeader>
                        <CardTitle>Select Ledger</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="grid gap-2 w-full sm:w-64">
                                <Label>Ledger Type</Label>
                                <Select value={entityType} onValueChange={(val) => { setEntityType(val); setSelectedEntityId(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACCOUNT">General Account (Asset/Expense/etc)</SelectItem>
                                        <SelectItem value="CUSTOMER">Customer Ledger</SelectItem>
                                        <SelectItem value="SUPPLIER">Supplier Ledger</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2 w-full sm:w-80">
                                <Label>Entity / Account</Label>
                                <Select
                                    value={selectedEntityId}
                                    onValueChange={setSelectedEntityId}
                                    disabled={!entityType || isLoadingEntities}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingEntities ? "Loading..." : "Select entity"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {entities.map(e => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {entityType === "ACCOUNT" ? `${e.code} - ${e.name}` : e.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={loadLedger} disabled={!selectedEntityId || isLoadingData}>
                                {isLoadingData ? "Loading..." : "View Ledger"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {transactions.length > 0 && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Ledger Statement</CardTitle>
                                <CardDescription>
                                    {entities.find(e => e.id === selectedEntityId)?.name || "Ledger Details"}
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                                <Download className="mr-2 h-4 w-4" />
                                Download / Print
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 sm:hidden">
                                {transactions.map((tx) => (
                                    <div key={tx.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900">{tx.ref}</p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {format(new Date(tx.date), "dd MMM yyyy")}
                                                </p>
                                            </div>
                                            <p className="font-mono text-sm font-semibold text-slate-900">
                                                {tx.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        <p className="mt-3 text-sm text-slate-600">{tx.description}</p>

                                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Debit</p>
                                                <p className="mt-1 font-mono font-medium text-red-600">
                                                    {tx.debit > 0 ? tx.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Credit</p>
                                                <p className="mt-1 font-mono font-medium text-green-600">
                                                    {tx.credit > 0 ? tx.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Balance</p>
                                                <p className="mt-1 font-mono font-semibold text-slate-900">
                                                    {tx.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Reference</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Debit</TableHead>
                                            <TableHead className="text-right">Credit</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(tx.date), "dd MMM yyyy")}
                                                </TableCell>
                                                <TableCell className="font-medium">{tx.ref}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {tx.debit > 0 ? tx.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {tx.credit > 0 ? tx.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-medium">
                                                    {tx.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {!isLoadingData && transactions.length === 0 && selectedEntityId && (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl shadow-sm border border-slate-200 print:hidden">
                        <FileText className="h-10 w-10 text-slate-300 mb-2" />
                        <h3 className="text-lg font-semibold text-slate-900">No Transactions Found</h3>
                        <p className="text-slate-500 max-w-sm mt-1">
                            There are no recorded transactions for this ledger in the selected period.
                        </p>
                    </div>
                )}
            </div>
        </PageAnimation>
    );
}
