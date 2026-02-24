"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

interface Account {
    id: string;
    code: string;
    name: string;
    accountType: string;
}

interface Line {
    accountId: string;
    description: string;
    debit: string;
    credit: string;
}

export default function EditJournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState("");
    const [description, setDescription] = useState("");
    const [lines, setLines] = useState<Line[]>([]);

    useEffect(() => {
        fetch("/api/accounts")
            .then((r) => r.json())
            .then(setAccounts)
            .catch(() => toast.error("Failed to load accounts"));

        fetch(`/api/journal-entries/${id}`)
            .then((r) => r.json())
            .then((data) => {
                setDate(new Date(data.date).toISOString().split("T")[0]);
                setDescription(data.description);
                setLines(
                    data.lines.map((l: any) => ({
                        accountId: l.accountId,
                        description: l.description || "",
                        debit: l.debit > 0 ? l.debit.toString() : "",
                        credit: l.credit > 0 ? l.credit.toString() : "",
                    }))
                );
            })
            .catch(() => toast.error("Failed to load journal entry"))
            .finally(() => setIsLoading(false));
    }, [id]);

    const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const addLine = () => {
        setLines([...lines, { accountId: "", description: "", debit: "", credit: "" }]);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) return;
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof Line, value: string) => {
        const updated = [...lines];
        updated[index] = { ...updated[index], [field]: value };
        if (field === "debit" && value) updated[index].credit = "";
        if (field === "credit" && value) updated[index].debit = "";
        setLines(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isBalanced) {
            toast.error("Total debits must equal total credits");
            return;
        }

        const validLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
        if (validLines.length < 2) {
            toast.error("At least 2 lines with accounts and amounts are required");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/journal-entries/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    description,
                    lines: validLines.map((l) => ({
                        accountId: l.accountId,
                        description: l.description || null,
                        debit: parseFloat(l.debit) || 0,
                        credit: parseFloat(l.credit) || 0,
                    })),
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to update");
            }

            toast.success("Journal entry updated");
            router.push("/accounting/journal-entries");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update journal entry");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="p-8">Loading entry...</div>;

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/accounting/journal-entries">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Edit Journal Entry</h2>
                        <p className="text-slate-500">Modify existing journal entry</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Entry Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Date *</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description *</Label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Description of this journal entry"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <Label className="text-base font-semibold">Lines</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add Line
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 text-xs font-medium text-slate-500 px-1">
                                        <span>Account</span>
                                        <span>Description</span>
                                        <span className="text-right">Debit</span>
                                        <span className="text-right">Credit</span>
                                        <span />
                                    </div>

                                    {lines.map((line, index) => (
                                        <div
                                            key={index}
                                            className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 items-center"
                                        >
                                            <Select
                                                value={line.accountId}
                                                onValueChange={(v) => updateLine(index, "accountId", v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select account" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map((a) => (
                                                        <SelectItem key={a.id} value={a.id}>
                                                            {a.code} - {a.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Input
                                                value={line.description}
                                                onChange={(e) =>
                                                    updateLine(index, "description", e.target.value)
                                                }
                                                placeholder="Line description"
                                            />

                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.debit}
                                                onChange={(e) =>
                                                    updateLine(index, "debit", e.target.value)
                                                }
                                                placeholder="0.00"
                                                className="text-right"
                                            />

                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.credit}
                                                onChange={(e) =>
                                                    updateLine(index, "credit", e.target.value)
                                                }
                                                placeholder="0.00"
                                                className="text-right"
                                            />

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeLine(index)}
                                                disabled={lines.length <= 2}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 pt-3 border-t font-semibold">
                                        <span />
                                        <span className="text-right">Totals:</span>
                                        <span className="text-right font-mono">
                                            {totalDebit.toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </span>
                                        <span className="text-right font-mono">
                                            {totalCredit.toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </span>
                                        <span />
                                    </div>

                                    {!isBalanced && totalDebit + totalCredit > 0 && (
                                        <p className="text-sm text-red-600">
                                            Difference: {Math.abs(totalDebit - totalCredit).toLocaleString("en-IN", { minimumFractionDigits: 2 })} — debits must equal credits
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <Link href="/accounting/journal-entries">
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !isBalanced || totalDebit === 0}
                                >
                                    {isSubmitting ? "Updating..." : "Update Journal Entry"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </PageAnimation>
    );
}
