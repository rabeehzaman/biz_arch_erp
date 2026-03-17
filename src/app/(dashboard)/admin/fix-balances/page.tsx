"use client";

import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
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
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
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
        throw new Error(data.error || t("admin.fixBalancesDesc"));
      }

      const data = await response.json();
      setCheckResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.fixBalancesDesc"));
    } finally {
      setIsChecking(false);
    }
  };

  const handleFix = async () => {
    setConfirmDialog({
      title: t("admin.fixAllCustomerBalances"),
      description: t("admin.fixBalancesConfirm"),
      onConfirm: async () => {
        setIsFixing(true);
        setError(null);

        try {
          const response = await fetch("/api/admin/fix-customer-balances", {
            method: "POST",
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || t("admin.fixBalancesDesc"));
          }

          const data = await response.json();
          setFixResult(data);
          setCheckResult(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : t("admin.fixBalancesDesc"));
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
        throw new Error(data.error || t("admin.fixProductCostsDesc"));
      }
      setCostCheckResult(await response.json());
    } catch (err) {
      setCostError(err instanceof Error ? err.message : t("admin.fixProductCostsDesc"));
    } finally {
      setIsCheckingCosts(false);
    }
  };

  const handleFixCosts = async () => {
    setConfirmDialog({
      title: t("admin.fixAllProductCosts"),
      description: t("admin.fixCostsConfirm"),
      onConfirm: async () => {
        setIsFixingCosts(true);
        setCostError(null);

        try {
          const response = await fetch("/api/admin/fix-product-costs", { method: "POST" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || t("admin.fixProductCostsDesc"));
          }
          setCostFixResult(await response.json());
          setCostCheckResult(null);
        } catch (err) {
          setCostError(err instanceof Error ? err.message : t("admin.fixProductCostsDesc"));
        } finally {
          setIsFixingCosts(false);
        }
      },
    });
  };

  const { fmt: formatCurrency } = useCurrency();

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("admin.fixCustomerBalances")}</h2>
            <p className="text-slate-500">
              {t("admin.fixBalancesDesc")}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.balanceChecker")}</CardTitle>
              <CardDescription>
                {t("admin.balanceCheckerDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={handleCheck} disabled={isChecking || isFixing}>
                  {isChecking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {t("admin.checkBalances")}
                </Button>

                {checkResult && checkResult.customersWithIssues > 0 && (
                  <Button onClick={handleFix} disabled={isChecking || isFixing} variant="destructive">
                    {isFixing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t("admin.fixAllBalances")}
                  </Button>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("common.error")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {checkResult && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("admin.checkResults")}</AlertTitle>
                  <AlertDescription>
                    {checkResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">{t("admin.totalCustomers2")}: {checkResult.totalCustomers}</Badge>
                      <Badge variant={checkResult.customersWithIssues > 0 ? "destructive" : "default"}>
                        {t("admin.issuesFound")}: {checkResult.customersWithIssues}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {fixResult && (
                <Alert className="border-green-600 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-900">{t("admin.success")}</AlertTitle>
                  <AlertDescription className="text-green-800">
                    {fixResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">{t("admin.totalCustomers2")}: {fixResult.summary.totalCustomers}</Badge>
                      <Badge className="bg-green-600">{t("admin.fixed")}: {fixResult.summary.fixedCount}</Badge>
                      {fixResult.summary.errorCount > 0 && (
                        <Badge variant="destructive">{t("admin.errors")}: {fixResult.summary.errorCount}</Badge>
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
                <CardTitle>{t("admin.customersWithBalanceIssues")}</CardTitle>
                <CardDescription>
                  {t("admin.customersBalanceIssuesDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {checkResult.issues.map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{issue.name}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.stored")}</p>
                          <p className="mt-1 font-medium text-slate-900">{formatCurrency(issue.storedBalance || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.calculated")}</p>
                          <p className="mt-1 font-medium text-green-600">{formatCurrency(issue.calculatedBalance || 0)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.difference")}</p>
                          <p className="mt-1 font-semibold text-red-600">{formatCurrency(issue.difference)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.customerName")}</TableHead>
                        <TableHead className="text-right">{t("admin.storedBalance")}</TableHead>
                        <TableHead className="text-right">{t("admin.calculatedBalance")}</TableHead>
                        <TableHead className="text-right">{t("admin.difference")}</TableHead>
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
                </div>
              </CardContent>
            </Card>
          )}

          {fixResult && fixResult.fixes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.fixedBalances")}</CardTitle>
                <CardDescription>
                  {t("admin.fixedBalancesDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {fixResult.fixes.map((fix) => (
                    <div key={fix.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{fix.name}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.oldBalance")}</p>
                          <p className="mt-1 font-medium text-red-600">{formatCurrency(fix.oldBalance || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.newBalance")}</p>
                          <p className="mt-1 font-medium text-green-600">{formatCurrency(fix.newBalance || 0)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.correction")}</p>
                          <p className="mt-1 font-semibold text-slate-900">{formatCurrency(fix.difference)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.customerName")}</TableHead>
                        <TableHead className="text-right">{t("admin.oldBalance")}</TableHead>
                        <TableHead className="text-right">{t("admin.newBalance")}</TableHead>
                        <TableHead className="text-right">{t("admin.correction")}</TableHead>
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Cost Fix Section */}
          <div className="pt-6 border-t">
            <h2 className="text-2xl font-bold text-slate-900">{t("admin.fixProductCosts")}</h2>
            <p className="text-slate-500">
              {t("admin.fixProductCostsDesc")}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.productCostChecker")}</CardTitle>
              <CardDescription>
                {t("admin.productCostCheckerDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={handleCheckCosts} disabled={isCheckingCosts || isFixingCosts}>
                  {isCheckingCosts ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {t("admin.checkProductCosts")}
                </Button>

                {costCheckResult && costCheckResult.productsWithIssues > 0 && (
                  <Button onClick={handleFixCosts} disabled={isCheckingCosts || isFixingCosts} variant="destructive">
                    {isFixingCosts ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t("admin.fixAllCosts")}
                  </Button>
                )}
              </div>

              {costError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("common.error")}</AlertTitle>
                  <AlertDescription>{costError}</AlertDescription>
                </Alert>
              )}

              {costCheckResult && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("admin.checkResults")}</AlertTitle>
                  <AlertDescription>
                    {costCheckResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">{t("admin.totalProducts")}: {costCheckResult.totalProducts}</Badge>
                      <Badge variant={costCheckResult.productsWithIssues > 0 ? "destructive" : "default"}>
                        {t("admin.issuesFound")}: {costCheckResult.productsWithIssues}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {costFixResult && (
                <Alert className="border-green-600 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-900">{t("admin.success")}</AlertTitle>
                  <AlertDescription className="text-green-800">
                    {costFixResult.message}
                    <div className="mt-2 flex gap-4">
                      <Badge variant="outline">{t("admin.totalProducts")}: {costFixResult.summary.totalProducts}</Badge>
                      <Badge className="bg-green-600">{t("admin.fixed")}: {costFixResult.summary.fixedCount}</Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {costCheckResult && costCheckResult.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.productsWithIncorrectCosts")}</CardTitle>
                <CardDescription>
                  {t("admin.incorrectCostsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {costCheckResult.issues.map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{issue.name}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.currentCost")}</p>
                          <p className="mt-1 font-medium text-red-600">{formatCurrency(issue.currentCost)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.correctMrp")}</p>
                          <p className="mt-1 font-medium text-green-600">{formatCurrency(issue.correctCost)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.discount")}</p>
                          <p className="mt-1 font-medium text-slate-900">{issue.discount}%</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.latestInvoice")}</p>
                          <p className="mt-1 break-all text-slate-900">{issue.latestInvoice}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.productName")}</TableHead>
                        <TableHead className="text-right">{t("admin.currentCost")}</TableHead>
                        <TableHead className="text-right">{t("admin.correctMrp")}</TableHead>
                        <TableHead className="text-right">{t("common.discount")}</TableHead>
                        <TableHead>{t("admin.latestInvoice")}</TableHead>
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
                </div>
              </CardContent>
            </Card>
          )}

          {costFixResult && costFixResult.fixes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.fixedProductCosts")}</CardTitle>
                <CardDescription>
                  {t("admin.fixedProductCostsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {costFixResult.fixes.map((fix) => (
                    <div key={fix.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{fix.name}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.oldCost")}</p>
                          <p className="mt-1 font-medium text-red-600">{formatCurrency(fix.oldCost)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("admin.newCost")}</p>
                          <p className="mt-1 font-medium text-green-600">{formatCurrency(fix.newCost)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.discount")}</p>
                          <p className="mt-1 font-medium text-slate-900">{fix.discount}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.productName")}</TableHead>
                        <TableHead className="text-right">{t("admin.oldCost")}</TableHead>
                        <TableHead className="text-right">{t("admin.newCostMrp")}</TableHead>
                        <TableHead className="text-right">{t("common.discount")}</TableHead>
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
                </div>
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
