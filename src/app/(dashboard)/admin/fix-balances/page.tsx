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
    if (!confirm("Are you sure you want to fix all customer balances? This will update the database.")) {
      return;
    }

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
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
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
    </div>
  );
}
