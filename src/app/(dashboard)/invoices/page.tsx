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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  balanceDue: number;
  _count: {
    items: number;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  SENT: "default",
  PAID: "default",
  PARTIALLY_PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  PARTIALLY_PAID: "Partial",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/invoices?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      toast.error("Failed to load invoices");
      console.error("Failed to fetch invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      fetchInvoices();
      toast.success("Invoice deleted");
    } catch (error) {
      toast.error("Failed to delete invoice");
      console.error("Failed to delete invoice:", error);
    }
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invoices</h2>
          <p className="text-slate-500">Create and manage invoices</p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={8} rows={5} />
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery || statusFilter !== "all"
                  ? "Try different filters"
                  : "Create your first invoice to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Link href="/invoices/new" className="mt-4">
                  <Button variant="outline">Create Invoice</Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.customer.name}</div>
                        {invoice.customer.email && (
                          <div className="text-sm text-slate-500">
                            {invoice.customer.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[invoice.status] as "default" | "secondary" | "destructive"}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{Number(invoice.total).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          Number(invoice.balanceDue) > 0
                            ? "text-red-600 font-medium"
                            : "text-green-600"
                        }
                      >
                        ₹{Number(invoice.balanceDue).toLocaleString("en-IN")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(invoice.id)}
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
    </div>
  );
}
