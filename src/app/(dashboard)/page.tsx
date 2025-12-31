import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Package, TrendingUp, Clock, CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { format } from "date-fns";

async function getDashboardStats() {
  const [
    totalInvoices,
    pendingInvoices,
    totalCustomers,
    totalProducts,
    revenueResult,
    recentInvoices,
  ] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({
      where: { status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } },
    }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.invoice.aggregate({
      _sum: { amountPaid: true },
      where: { status: { in: ["PAID", "PARTIALLY_PAID"] } },
    }),
    prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
      },
    }),
  ]);

  return {
    totalInvoices,
    pendingInvoices,
    totalCustomers,
    totalProducts,
    totalRevenue: Number(revenueResult._sum.amountPaid || 0),
    recentInvoices,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500">Overview of your business</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/new">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            <p className="text-xs text-slate-500">
              {stats.pendingInvoices} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-slate-500">Active customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-slate-500">In catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{stats.totalRevenue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-500">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/invoices/new">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Create Invoice</h3>
                <p className="text-sm text-slate-500">
                  Generate a new invoice for a customer
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/customers">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Customers</h3>
                <p className="text-sm text-slate-500">
                  View and edit customer details
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/payments">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Record Payment</h3>
                <p className="text-sm text-slate-500">
                  Record a payment from a customer
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No invoices yet</h3>
              <p className="text-sm text-slate-500">
                Start by creating your first invoice
              </p>
              <Link href="/invoices/new" className="mt-4">
                <Button variant="outline">Create Invoice</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-slate-500">{invoice.customer.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{Number(invoice.total).toLocaleString("en-IN")}</p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(invoice.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                </Link>
              ))}
              <Link href="/invoices" className="block">
                <Button variant="outline" className="w-full">
                  View All Invoices
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
