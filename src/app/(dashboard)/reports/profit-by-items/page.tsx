"use client";

import { useState, useEffect } from "react";
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
import { FileText, X } from "lucide-react";
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
  invoiceNumber: string;
  invoiceDate: string;
  invoiceId: string;
  customerName: string;
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

interface Summary {
  totalItems: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCOGS: number;
  totalProfit: number;
  averageProfitPercent: number;
}

interface ReportData {
  items: ProfitItem[];
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
          <h2 className="text-2xl font-bold text-slate-900">Profit by Items</h2>
          <p className="text-slate-500">
            View profit analysis for individual invoice items
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton columns={10} rows={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Profit by Items</h2>
        <p className="text-slate-500">
          View profit analysis for individual invoice items
        </p>
      </div>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reportData.summary.totalItems}
              </div>
              <p className="text-xs text-slate-500">
                {reportData.summary.totalQuantity.toLocaleString("en-IN")} units
                sold
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
            <CardTitle>Item Details</CardTitle>
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
          {!reportData || reportData.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No items found</h3>
              <p className="text-sm text-slate-500">
                {hasFilters
                  ? "Try adjusting your filters"
                  : "No invoice items have been recorded yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">FIFO Cost</TableHead>
                    <TableHead className="text-right">Profit/Unit</TableHead>
                    <TableHead className="text-right">Profit %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/invoices/${item.invoiceId}`}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          {item.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {format(new Date(item.invoiceDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>{item.customerName}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          {item.productSku && (
                            <div className="text-xs text-slate-500">
                              SKU: {item.productSku}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.discount > 0 ? `${item.discount}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.salePriceAfterDiscount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.fifoCostPerUnit)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${item.profitPerUnit >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatCurrency(item.profitPerUnit)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${item.profitPercent >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {item.profitPercent.toFixed(1)}%
                      </TableCell>
                    </TableRow>
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
