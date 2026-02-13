"use client";

import { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, CreditCard, Trash2 } from "lucide-react";
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
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

interface Payment {
  id: string;
  paymentNumber: string;
  customer: {
    id: string;
    name: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  amount: number;
  discountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

interface Customer {
  id: string;
  name: string;
  balance: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  balanceDue: number;
}

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Check",
  CREDIT_CARD: "Credit Card",
  UPI: "UPI",
  OTHER: "Other",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",
    discountReceived: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "CASH",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
    fetchInvoices();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/payments");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      toast.error("Failed to load payments");
      console.error("Failed to fetch payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers");
    const data = await response.json();
    setCustomers(data);
  };

  const fetchInvoices = async () => {
    const response = await fetch("/api/invoices");
    const data = await response.json();
    setInvoices(data.filter((inv: Invoice) => Number(inv.balanceDue) > 0));
  };

  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === formData.customerId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          invoiceId: formData.invoiceId || null,
          amount: parseFloat(formData.amount),
          discountReceived: parseFloat(formData.discountReceived) || 0,
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          reference: formData.reference || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setIsDialogOpen(false);
      resetForm();
      fetchPayments();
      fetchCustomers();
      fetchInvoices();
      toast.success("Payment recorded");
    } catch (error) {
      toast.error("Failed to record payment");
      console.error("Failed to save payment:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: "",
      invoiceId: "",
      amount: "",
      discountReceived: "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "CASH",
      reference: "",
      notes: "",
    });
  };

  const handleDelete = async () => {
    if (!deletePayment) return;

    try {
      const response = await fetch(`/api/payments/${deletePayment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setDeletePayment(null);
      fetchPayments();
      fetchCustomers();
      fetchInvoices();
      toast.success("Payment deleted successfully");
    } catch (error) {
      toast.error("Failed to delete payment");
      console.error("Failed to delete payment:", error);
    }
  };

  const filteredPayments = payments.filter(
    (payment) =>
      payment.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Payments</h2>
          <p className="text-slate-500">Record and manage payments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Record a payment from a customer.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Combobox
                    items={customers}
                    value={formData.customerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, customerId: value, invoiceId: "" })
                    }
                    getId={(customer) => customer.id}
                    getLabel={(customer) => customer.name}
                    filterFn={(customer, query) =>
                      customer.name.toLowerCase().includes(query)
                    }
                    renderItem={(customer) => (
                      <div className="flex justify-between w-full">
                        <span>{customer.name}</span>
                        <span className="text-slate-500 text-xs">
                          Balance: ₹{Number(customer.balance).toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                    placeholder="Search customer..."
                    emptyText="No customers found."
                  />
                </div>
                {formData.customerId && customerInvoices.length > 0 && (
                  <div className="grid gap-2">
                    <Label htmlFor="invoice">Link to Invoice (Optional)</Label>
                    <Select
                      value={formData.invoiceId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, invoiceId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerInvoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.invoiceNumber} (Due: ₹{Number(invoice.balanceDue).toLocaleString("en-IN")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="discountReceived">Discount Received</Label>
                    <Input
                      id="discountReceived"
                      type="number"
                      step="0.01"
                      value={formData.discountReceived}
                      onChange={(e) =>
                        setFormData({ ...formData, discountReceived: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="paymentDate">Payment Date *</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentDate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) =>
                        setFormData({ ...formData, paymentMethod: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="CHECK">Check</SelectItem>
                        <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reference">Reference</Label>
                    <Input
                      id="reference"
                      value={formData.reference}
                      onChange={(e) =>
                        setFormData({ ...formData, reference: e.target.value })
                      }
                      placeholder="Check #, Transaction ID..."
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Record Payment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search payments..."
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
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CreditCard className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No payments found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? "Try a different search term"
                  : "Record your first payment to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.paymentNumber}
                    </TableCell>
                    <TableCell>{payment.customer.name}</TableCell>
                    <TableCell>
                      {payment.invoice?.invoiceNumber || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.paymentDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {methodLabels[payment.paymentMethod]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      ₹{Number(payment.amount).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right text-slate-500">
                      {Number(payment.discountReceived) > 0
                        ? `₹${Number(payment.discountReceived).toLocaleString("en-IN")}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePayment(payment)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletePayment} onOpenChange={() => setDeletePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete payment {deletePayment?.paymentNumber}?
              This will reverse the customer balance and any invoice allocations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
