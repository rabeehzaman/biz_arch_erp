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

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
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

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-64">
                <ProductCombobox
                  products={products}
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="fromDate" className="text-sm">
                  From
                </Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="toDate" className="text-sm">
                  To
                </Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button variant="outline" onClick={handleFilter}>
                Filter
              </Button>
              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={handleClearFilters}>
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
            <div className="overflow-x-auto">
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
                  {reportData.invoices.map((invoice) => (
                    <React.Fragment key={invoice.invoiceId}>
                      {/* Invoice Row */}
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
                      {/* Item Rows (expanded) */}
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
  );
}
