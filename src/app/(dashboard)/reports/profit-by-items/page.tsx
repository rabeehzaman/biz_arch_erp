"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, X, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";

interface Product {
  id: string;
  name: string;
  price: number;
  unitId?: string | null;
  unit?: { id: string; name: string; code: string } | null;
  sku?: string;
}

interface ProfitItem {
  id: string;
  productId: string | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  salePriceAfterDiscount: number;
  fifoCostPerUnit: number;
  profitPerUnit: number;
  profitPercent: number;
  lineTotal: number;
  lineCOGS: number;
  lineProfit: number;
}

interface InvoiceProfit {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  totalQty: number;
  totalRevenue: number;
  totalCOGS: number;
  totalProfit: number;
  profitPercent: number;
  items: ProfitItem[];
}

interface Summary {
  totalInvoices: number;
  totalItems: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCOGS: number;
  totalProfit: number;
  averageProfitPercent: number;
}

interface ReportData {
  invoices: InvoiceProfit[];
  summary: Summary;
  generatedAt: string;
}

export default function ProfitByItemsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(
    new Set()
  );
  const [displayCount, setDisplayCount] = useState(20);
  const { fmt: formatCurrency } = useCurrency();

  const toggleInvoice = (invoiceId: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchProducts();
    fetchReport();
    // Initial report load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const fetchReport = async () => {
    setIsLoading(true);
    setDisplayCount(20);
    try {
      let url = "/api/reports/profit-by-items";
      const params = new URLSearchParams();
      if (selectedProductId) params.append("productId", selectedProductId);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch report");
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = () => {
    fetchReport();
  };

  const handleClearFilters = () => {
    setSelectedProductId("");
    setFromDate("");
    setToDate("");
    // Fetch report after clearing (will run on next render with empty values)
    setTimeout(() => {
      fetchReport();
    }, 0);
  };

  const hasFilters = selectedProductId || fromDate || toDate;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profit by Invoice</h2>
          <p className="text-slate-500">
            View profit analysis by invoice with expandable item details
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton columns={8} rows={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Profit by Invoice</h2>
            <p className="text-slate-500">
              View profit analysis by invoice with expandable item details
            </p>
          </div>

          {/* Summary Cards */}
          {reportData && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Total Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reportData.summary.totalInvoices}
                  </div>
                  <p className="text-xs text-slate-500">
                    {reportData.summary.totalItems} items,{" "}
                    {reportData.summary.totalQuantity.toLocaleString("en-IN")} units
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(reportData.summary.totalRevenue)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Total COGS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(reportData.summary.totalCOGS)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Total Profit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${reportData.summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(reportData.summary.totalProfit)}
                  </div>
                  <p className="text-xs text-slate-500">
                    {reportData.summary.averageProfitPercent.toFixed(1)}% margin
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter and Table Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle>Invoice Details</CardTitle>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="w-full sm:w-64">
                    <ProductCombobox
                      products={products}
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                    />
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Label htmlFor="fromDate" className="text-sm">
                      From
                    </Label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full sm:w-40"
                    />
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Label htmlFor="toDate" className="text-sm">
                      To
                    </Label>
                    <Input
                      id="toDate"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full sm:w-40"
                    />
                  </div>
                  <Button variant="outline" onClick={handleFilter} className="w-full sm:w-auto">
                    Filter
                  </Button>
                  {hasFilters && (
                    <Button variant="ghost" size="icon" onClick={handleClearFilters} className="self-start sm:self-auto">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!reportData || reportData.invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
                  <p className="text-sm text-slate-500">
                    {hasFilters
                      ? "Try adjusting your filters"
                      : "No invoices have been recorded yet"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                    <span>
                      Showing {Math.min(displayCount, reportData.invoices.length)} of{" "}
                      {reportData.invoices.length} invoices
                    </span>
                    {reportData.invoices.length > displayCount && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600"
                        onClick={() => setDisplayCount(reportData.invoices.length)}
                      >
                        Show All
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 sm:hidden">
                    {reportData.invoices.slice(0, displayCount).map((invoice) => {
                      const isExpanded = expandedInvoices.has(invoice.invoiceId);

                      return (
                        <div key={invoice.invoiceId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/invoices/${invoice.invoiceId}`}
                                className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                              >
                                {invoice.invoiceNumber}
                              </Link>
                              <p className="mt-1 text-sm text-slate-500">
                                {invoice.customerName} · {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => toggleInvoice(invoice.invoiceId)}>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                              )}
                            </Button>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Qty</p>
                              <p className="mt-1 font-medium text-slate-900">{invoice.totalQty}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Revenue</p>
                              <p className="mt-1 font-medium text-slate-900">{formatCurrency(invoice.totalRevenue)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">COGS</p>
                              <p className="mt-1 font-medium text-orange-600">{formatCurrency(invoice.totalCOGS)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Profit</p>
                              <p className={`mt-1 font-semibold ${invoice.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(invoice.totalProfit)}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Profit %</p>
                              <p className={`mt-1 font-semibold ${invoice.profitPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {invoice.profitPercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                              {invoice.items.map((item) => (
                                <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900">{item.productName}</p>
                                      {item.productSku && (
                                        <p className="mt-1 text-xs text-slate-500">SKU: {item.productSku}</p>
                                      )}
                                    </div>
                                    <p className={`text-sm font-semibold ${item.lineProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {formatCurrency(item.lineProfit)}
                                    </p>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <p className="text-xs text-slate-500">Price x Qty</p>
                                      <p className="font-medium text-slate-900">
                                        {formatCurrency(item.unitPrice)} x {item.quantity}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500">Revenue</p>
                                      <p className="font-medium text-slate-900">{formatCurrency(item.lineTotal)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500">COGS</p>
                                      <p className="font-medium text-orange-600">{formatCurrency(item.lineCOGS)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500">Profit %</p>
                                      <p className={`font-medium ${item.profitPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {item.profitPercent.toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                  {item.discount > 0 && (
                                    <p className="mt-2 text-xs text-orange-600">Discount: {item.discount}%</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Total Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">COGS</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Profit %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.invoices.slice(0, displayCount).map((invoice) => (
                          <React.Fragment key={invoice.invoiceId}>
                            <TableRow
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => toggleInvoice(invoice.invoiceId)}
                            >
                              <TableCell className="w-10">
                                {expandedInvoices.has(invoice.invoiceId) ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href={`/invoices/${invoice.invoiceId}`}
                                  className="text-blue-600 hover:underline font-mono"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {invoice.invoiceNumber}
                                </Link>
                              </TableCell>
                              <TableCell>
                                {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell>{invoice.customerName}</TableCell>
                              <TableCell className="text-right">
                                {invoice.totalQty}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(invoice.totalRevenue)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(invoice.totalCOGS)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${invoice.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {formatCurrency(invoice.totalProfit)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${invoice.profitPercent >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {invoice.profitPercent.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                            {expandedInvoices.has(invoice.invoiceId) &&
                              invoice.items.map((item) => (
                                <TableRow
                                  key={item.id}
                                  className="bg-slate-50/50"
                                >
                                  <TableCell></TableCell>
                                  <TableCell colSpan={2} className="pl-8">
                                    <div>
                                      <div className="font-medium text-slate-700">
                                        {item.productName}
                                      </div>
                                      {item.productSku && (
                                        <div className="text-xs text-slate-500">
                                          SKU: {item.productSku}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-slate-600">
                                    {formatCurrency(item.unitPrice)} x {item.quantity}
                                    {item.discount > 0 && (
                                      <span className="text-orange-600 ml-1">
                                        (-{item.discount}%)
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-slate-600">
                                    {item.quantity}
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-slate-600">
                                    {formatCurrency(item.lineTotal)}
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-slate-600">
                                    {formatCurrency(item.lineCOGS)}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right text-sm ${item.lineProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {formatCurrency(item.lineProfit)}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right text-sm ${item.profitPercent >= 0 ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {item.profitPercent.toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {reportData.invoices.length > displayCount && (
                    <div className="flex items-center justify-center pt-4 pb-2">
                      <Button
                        variant="outline"
                        onClick={() => setDisplayCount((prev) => prev + 20)}
                      >
                        Show More ({reportData.invoices.length - displayCount} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {reportData && (
            <div className="text-center text-sm text-slate-400">
              Report generated on{" "}
              {format(new Date(reportData.generatedAt), "dd MMM yyyy, hh:mm a")}
            </div>
          )}
        </div>
        </PageAnimation>
      );
}
