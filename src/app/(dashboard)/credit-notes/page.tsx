"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  issueDate: string;
  total: number;
  reason: string | null;
  _count: {
    items: number;
  };
}

export default function CreditNotesPage() {
  const router = useRouter();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const fetchCreditNotes = async () => {
    try {
      const response = await fetch("/api/credit-notes");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCreditNotes(data);
    } catch (error) {
      toast.error("Failed to load credit notes");
      console.error("Failed to fetch credit notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: "Delete Credit Note",
      description: "Are you sure you want to delete this credit note? This will restore customer balance and remove stock lots.",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/credit-notes/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          fetchCreditNotes();
          toast.success("Credit note deleted");
        } catch (error) {
          toast.error("Failed to delete credit note");
          console.error("Failed to delete credit note:", error);
        }
      },
    });
  };

  const filteredCreditNotes = creditNotes.filter(
    (cn) =>
      cn.creditNoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cn.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cn.invoice?.invoiceNumber &&
        cn.invoice.invoiceNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Credit Notes</h2>
              <p className="text-slate-500">
                Manage sales returns and customer credits
              </p>
            </div>
            <Link href="/credit-notes/new" className="w-full sm:w-auto">
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                New Credit Note
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search credit notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={6} rows={5} />
              ) : filteredCreditNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">
                    No credit notes found
                  </h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? "Try a different search term"
                      : "Create your first credit note to get started"}
                  </p>
                  {!searchQuery && (
                    <Link href="/credit-notes/new" className="mt-4">
                      <Button variant="outline">Create Credit Note</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CN #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCreditNotes.map((creditNote) => (
                      <TableRow
                        key={creditNote.id}
                        onClick={() => router.push(`/credit-notes/${creditNote.id}`)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          {creditNote.creditNoteNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {creditNote.customer.name}
                            </div>
                            {creditNote.customer.email && (
                              <div className="text-sm text-slate-500">
                                {creditNote.customer.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {creditNote.invoice ? (
                            <Link
                              href={`/invoices/${creditNote.invoice.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline"
                            >
                              {creditNote.invoice.invoiceNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(creditNote.issueDate), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          ₹{Number(creditNote.total).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/credit-notes/${creditNote.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(creditNote.id)}
                          >
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
