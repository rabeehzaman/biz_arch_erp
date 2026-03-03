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
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  account: {
    id: string;
    code: string;
    name: string;
  };
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  date: string;
  description: string;
  sourceType: string;
  lines: JournalLine[];
}

interface JournalEntryTabProps {
  sourceType: "INVOICE" | "PURCHASE_INVOICE";
  sourceId: string;
}

export function JournalEntryTab({ sourceType, sourceId }: JournalEntryTabProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const response = await fetch(
          `/api/journal-entries?sourceType=${sourceType}&sourceId=${sourceId}`
        );
        if (response.ok) {
          const data = await response.json();
          setEntries(data);
        }
      } catch (error) {
        console.error("Failed to fetch journal entries:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEntries();
  }, [sourceType, sourceId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">Loading journal entries...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
          <BookOpen className="h-10 w-10 mb-3 text-slate-300" />
          <p className="font-medium">No journal entries</p>
          <p className="text-sm">Journal entries will appear here once the invoice is posted.</p>
        </CardContent>
      </Card>
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        let entryDebit = 0;
        let entryCredit = 0;
        entry.lines.forEach((line) => {
          entryDebit += Number(line.debit);
          entryCredit += Number(line.credit);
        });
        totalDebit += entryDebit;
        totalCredit += entryCredit;

        return (
          <Card key={entry.id}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Link
                    href={`/accounting/journal-entries/${entry.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {entry.journalNumber}
                  </Link>
                  <p className="text-sm text-slate-500">{entry.description}</p>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <span className="text-slate-400 mr-2">{line.account.code}</span>
                          {line.account.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(line.debit) > 0
                            ? `₹${Number(line.debit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(line.credit) > 0
                            ? `₹${Number(line.credit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        ₹{entryDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{entryCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Mobile view */}
              <div className="sm:hidden divide-y divide-slate-200 border rounded-lg">
                {entry.lines.map((line) => (
                  <div key={line.id} className="p-3 space-y-1">
                    <div className="text-sm font-medium">
                      <span className="text-slate-400 mr-1">{line.account.code}</span>
                      {line.account.name}
                    </div>
                    <div className="flex justify-between text-sm">
                      {Number(line.debit) > 0 && (
                        <span className="text-emerald-600">
                          Dr ₹{Number(line.debit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {Number(line.credit) > 0 && (
                        <span className="text-blue-600 ml-auto">
                          Cr ₹{Number(line.credit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="p-3 font-bold flex justify-between text-sm bg-slate-50">
                  <span>Dr ₹{entryDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span>Cr ₹{entryCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {entries.length > 1 && (
        <div className="flex justify-end px-4">
          <div className="text-sm font-semibold text-slate-600 space-x-4">
            <span>Grand Total — Debit: ₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span>Credit: ₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
