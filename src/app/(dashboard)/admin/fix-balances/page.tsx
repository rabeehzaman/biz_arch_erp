"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ProductCostIssue {
  id: string;
  name: string;
  currentCost: number;
  correctCost: number;
  latestInvoice: string;
  discount: number;
}

interface ProductCostFix {
  id: string;
  name: string;
  oldCost: number;
  newCost: number;
  discount: number;
}

interface BalanceIssue {
  id: string;
  name: string;
  storedBalance?: number;
  calculatedBalance?: number;
  oldBalance?: number;
  newBalance?: number;
  difference: number;
}

interface CheckResponse {
  totalCustomers: number;
  customersWithIssues: number;
  issues: BalanceIssue[];
  message: string;
}

interface FixResponse {
  success: boolean;
  summary: {
    totalCustomers: number;
    fixedCount: number;
    errorCount: number;
  };
  fixes: BalanceIssue[];
  message: string;
}

export default function FixBalancesPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResponse | null>(null);
  const [fixResult, setFixResult] = useState<FixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Product cost fix state
  const [isCheckingCosts, setIsCheckingCosts] = useState(false);
  const [isFixingCosts, setIsFixingCosts] = useState(false);
  const [costCheckResult, setCostCheckResult] = useState<{
    totalProducts: number;
    productsWithIssues: number;
    issues: ProductCostIssue[];
    message: string;
  } | null>(null);
  const [costFixResult, setCostFixResult] = useState<{
    success: boolean;
    summary: { totalProducts: number; fixedCount: number };
    fixes: ProductCostFix[];
    message: string;
  } | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const handleCheck = async () => {
    setIsChecking(true);
    setError(null);
    setFixResult(null);

    try {
      const response = await fetch("/api/admin/fix-customer-balances");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to check balances");
      }

      const data = await response.json();
      setCheckResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check balances");
    } finally {
      setIsChecking(false);
    }
  };

  const handleFix = async () => {
    setConfirmDialog({
      title: "Fix All Customer Balances",
      description: "Are you sure you want to fix all customer balances? This will update the database.",
      onConfirm: async () => {
        setIsFixing(true);
        setError(null);

        try {
          const response = await fetch("/api/admin/fix-customer-balances", {
            method: "POST",
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to fix balances");
          }

          const data = await response.json();
          setFixResult(data);
          setCheckResult(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fix balances");
        } finally {
          setIsFixing(false);
        }
      },
    });
  };

  const handleCheckCosts = async () => {
    setIsCheckingCosts(true);
    setCostError(null);
    setCostFixResult(null);

    try {
      const response = await fetch("/api/admin/fix-product-costs");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to check product costs");
      }
      setCostCheckResult(await response.json());
    } catch (err) {
      setCostError(err instanceof Error ? err.message : "Failed to check product costs");
    } finally {
      setIsCheckingCosts(false);
    }
  };

  const handleFixCosts = async () => {
    setConfirmDialog({
      title: "Fix All Product Costs",
      description: "Are you sure you want to fix all product costs to MRP? This will update the database.",
      onConfirm: async () => {
        setIsFixingCosts(true);
        setCostError(null);

        try {
          const response = await fetch("/api/admin/fix-product-costs", { method: "POST" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to fix product costs");
          }
          setCostFixResult(await response.json());
          setCostCheckResult(null);
        } catch (err) {
          setCostError(err instanceof Error ? err.message : "Failed to fix product costs");
        } finally {
          setIsFixingCosts(false);
        }
      },
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Fix Customer Balances</h2>
            <p className="text-slate-500">
              Check and fix customer balance discrepancies across the system
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Balance Checker</CardTitle>
              <CardDescription>
                This tool will check all customer balances against their transaction history and fix any
                discrepancies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={handleCheck} disabled={isChecking || isFixing}>
                  {isChecking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Check Balances
                </Button>

                {checkResult && checkResult.customersWithIssues > 0 && (
                  <Button onClick={handleFix} disabled={isChecking || isFixing} variant="destructive">
                    {isFixing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Fix All Balances
                  </Button>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {checkResult && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Check Results</AlertTitle>
                  <AlertDescription>
                    {checkResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">Total Customers: {checkResult.totalCustomers}</Badge>
                      <Badge variant={checkResult.customersWithIssues > 0 ? "destructive" : "default"}>
                        Issues Found: {checkResult.customersWithIssues}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {fixResult && (
                <Alert className="border-green-600 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-900">Success</AlertTitle>
                  <AlertDescription className="text-green-800">
                    {fixResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">Total Customers: {fixResult.summary.totalCustomers}</Badge>
                      <Badge className="bg-green-600">Fixed: {fixResult.summary.fixedCount}</Badge>
                      {fixResult.summary.errorCount > 0 && (
                        <Badge variant="destructive">Errors: {fixResult.summary.errorCount}</Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {checkResult && checkResult.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Customers with Balance Issues</CardTitle>
                <CardDescription>
                  The following customers have discrepancies between their stored balance and calculated
                  balance from transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead className="text-right">Stored Balance</TableHead>
                      <TableHead className="text-right">Calculated Balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkResult.issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.name}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(issue.storedBalance || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(issue.calculatedBalance || 0)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(issue.difference)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {fixResult && fixResult.fixes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fixed Balances</CardTitle>
                <CardDescription>
                  Successfully updated the following customer balances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead className="text-right">Old Balance</TableHead>
                      <TableHead className="text-right">New Balance</TableHead>
                      <TableHead className="text-right">Correction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fixResult.fixes.map((fix) => (
                      <TableRow key={fix.id}>
                        <TableCell className="font-medium">{fix.name}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(fix.oldBalance || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(fix.newBalance || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(fix.difference)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Product Cost Fix Section */}
          <div className="pt-6 border-t">
            <h2 className="text-2xl font-bold text-slate-900">Fix Product Costs</h2>
            <p className="text-slate-500">
              Fix products whose cost was set to the discounted price instead of MRP
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Product Cost Checker</CardTitle>
              <CardDescription>
                This tool checks all products with purchase history and ensures their cost reflects the
                original MRP (pre-discount), not the discounted price.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={handleCheckCosts} disabled={isCheckingCosts || isFixingCosts}>
                  {isCheckingCosts ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Check Product Costs
                </Button>

                {costCheckResult && costCheckResult.productsWithIssues > 0 && (
                  <Button onClick={handleFixCosts} disabled={isCheckingCosts || isFixingCosts} variant="destructive">
                    {isFixingCosts ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Fix All Costs
                  </Button>
                )}
              </div>

              {costError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{costError}</AlertDescription>
                </Alert>
              )}

              {costCheckResult && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Check Results</AlertTitle>
                  <AlertDescription>
                    {costCheckResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">Total Products: {costCheckResult.totalProducts}</Badge>
                      <Badge variant={costCheckResult.productsWithIssues > 0 ? "destructive" : "default"}>
                        Issues Found: {costCheckResult.productsWithIssues}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {costFixResult && (
                <Alert className="border-green-600 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-900">Success</AlertTitle>
                  <AlertDescription className="text-green-800">
                    {costFixResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">Total Products: {costFixResult.summary.totalProducts}</Badge>
                      <Badge className="bg-green-600">Fixed: {costFixResult.summary.fixedCount}</Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {costCheckResult && costCheckResult.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Products with Incorrect Costs</CardTitle>
                <CardDescription>
                  These products have their cost set to the discounted price instead of MRP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Current Cost</TableHead>
                      <TableHead className="text-right">Correct MRP</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead>Latest Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costCheckResult.issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.name}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(issue.currentCost)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(issue.correctCost)}
                        </TableCell>
                        <TableCell className="text-right">{issue.discount}%</TableCell>
                        <TableCell>{issue.latestInvoice}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {costFixResult && costFixResult.fixes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fixed Product Costs</CardTitle>
                <CardDescription>
                  Successfully updated the following product costs to MRP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Old Cost</TableHead>
                      <TableHead className="text-right">New Cost (MRP)</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costFixResult.fixes.map((fix) => (
                      <TableRow key={fix.id}>
                        <TableCell className="font-medium">{fix.name}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(fix.oldCost)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(fix.newCost)}
                        </TableCell>
                        <TableCell className="text-right">{fix.discount}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
