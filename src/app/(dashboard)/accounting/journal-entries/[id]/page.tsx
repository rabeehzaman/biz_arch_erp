"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

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
  sourceId: string | null;
  lines: JournalLine[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  POSTED: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

export default function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"post" | "void" | null>(null);

  useEffect(() => {
    fetchEntry();
  }, [id]);

  const fetchEntry = async () => {
    try {
      const response = await fetch(`/api/journal-entries/${id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEntry(data);
    } catch {
      toast.error("Failed to load journal entry");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction || !entry) return;

    try {
      const response = await fetch(
        `/api/journal-entries/${entry.id}/${confirmAction}`,
        { method: "POST" }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Failed to ${confirmAction}`);
      }
      toast.success(
        confirmAction === "post"
          ? "Journal entry posted"
          : "Journal entry voided"
      );
      setConfirmAction(null);
      fetchEntry();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to ${confirmAction}`
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!entry) {
    return <p className="text-center py-8 text-slate-500">Entry not found</p>;
  }

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce(
    (sum, l) => sum + Number(l.credit),
    0
  );

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/accounting/journal-entries">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {entry.journalNumber}
                </h2>
                <p className="text-slate-500">{entry.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={statusColors[entry.status]}>{entry.status}</Badge>
              {entry.status === "DRAFT" && (
                <Button onClick={() => setConfirmAction("post")}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Post
                </Button>
              )}
              {entry.status === "POSTED" && entry.sourceType === "MANUAL" && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmAction("void")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Void
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Entry Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Date</span>
                  <p className="font-medium">
                    {format(new Date(entry.date), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Source</span>
                  <p className="font-medium">{entry.sourceType}</p>
                </div>
                <div>
                  <span className="text-slate-500">Total Debit</span>
                  <p className="font-medium font-mono">
                    {totalDebit.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Total Credit</span>
                  <p className="font-medium font-mono">
                    {totalCredit.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <span className="font-mono text-slate-500 mr-2">
                          {line.account.code}
                        </span>
                        {line.account.name}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {line.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(line.debit) > 0
                          ? Number(line.debit).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(line.credit) > 0
                          ? Number(line.credit).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2} className="text-right">
                      Totals
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totalDebit.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totalCredit.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <AlertDialog
            open={!!confirmAction}
            onOpenChange={() => setConfirmAction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmAction === "post"
                    ? "Post Journal Entry"
                    : "Void Journal Entry"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction === "post"
                    ? "Once posted, this entry will affect account balances. Are you sure?"
                    : "This will create a reversal entry and mark the original as void. Are you sure?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAction}
                  className={
                    confirmAction === "void"
                      ? "bg-red-600 hover:bg-red-700"
                      : undefined
                  }
                >
                  {confirmAction === "post" ? "Post Entry" : "Void Entry"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </PageAnimation>
      );
}
