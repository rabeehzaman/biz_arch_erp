"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

interface JournalLine {
  id: string;
  account: { id: string; code: string; name: string };
  description: string | null;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  date: string;
  description: string;
  status: string;
  sourceType: string;
  lines: JournalLine[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  POSTED: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

const sourceLabels: Record<string, string> = {
  MANUAL: "Manual",
  INVOICE: "Invoice",
  PURCHASE_INVOICE: "Purchase",
  PAYMENT: "Payment",
  SUPPLIER_PAYMENT: "Supplier Pay",
  EXPENSE: "Expense",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
  TRANSFER: "Transfer",
  OPENING_BALANCE: "Opening",
};

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const response = await fetch("/api/journal-entries");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEntries(data);
    } catch {
      toast.error("Failed to load journal entries");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.journalNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTotals = (lines: JournalLine[]) => {
    const debit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const credit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
    return { debit, credit };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Journal Entries</h2>
          <p className="text-slate-500">Double-entry accounting records</p>
        </div>
        <Link href="/accounting/journal-entries/new" className="w-full sm:w-auto">
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Journal Entry
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search journal entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={6} rows={5} />
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No journal entries found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? "Try a different search term"
                  : "Create your first journal entry to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Source</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const totals = getTotals(entry.lines);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Link
                          href={`/accounting/journal-entries/${entry.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {entry.journalNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">
                          {sourceLabels[entry.sourceType] || entry.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={statusColors[entry.status]}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.debit.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right font-mono">
                        {totals.credit.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
