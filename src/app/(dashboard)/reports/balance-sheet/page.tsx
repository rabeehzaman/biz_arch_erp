"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface AccountRow {
  account: { code: string; name: string };
  balance: number;
}

interface BalanceSheet {
  asOfDate: string;
  assets: AccountRow[];
  liabilities: AccountRow[];
  equity: AccountRow[];
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

function SectionTable({ title, rows, total, color }: {
  title: string;
  rows: AccountRow[];
  total: number;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={color}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.account.code}>
                <TableCell>
                  <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                  {row.account.name}
                </TableCell>
                <TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold border-t-2">
              <TableCell>Total {title}</TableCell>
              <TableCell className="text-right font-mono">{fmt(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/balance-sheet?asOfDate=${asOfDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error("Failed to load balance sheet");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Balance Sheet</h2>
        <p className="text-slate-500">Financial position as of a date</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="grid gap-2">
              <Label>As of Date</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </div>
            <Button onClick={fetchReport} className="mt-6">Generate</Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : data ? (
        <>
          <div className="flex gap-2 items-center">
            {data.isBalanced ? (
              <Badge className="bg-green-100 text-green-700">Assets = Liabilities + Equity</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700">Not Balanced</Badge>
            )}
          </div>

          <SectionTable title="Assets" rows={data.assets} total={data.totalAssets} color="text-blue-700" />

          <SectionTable title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} color="text-red-700" />

          <Card>
            <CardHeader>
              <CardTitle className="text-purple-700">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.equity.map((row) => (
                    <TableRow key={row.account.code}>
                      <TableCell>
                        <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                        {row.account.name}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="italic text-slate-600">Retained Earnings (computed)</TableCell>
                    <TableCell className="text-right font-mono italic">{fmt(data.retainedEarnings)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Equity</TableCell>
                    <TableCell className="text-right font-mono">{fmt(data.totalEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-slate-500">Total Assets</span>
                  <p className="text-xl font-bold font-mono">{fmt(data.totalAssets)}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Total Liabilities + Equity</span>
                  <p className="text-xl font-bold font-mono">{fmt(data.totalLiabilitiesAndEquity)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-center py-8 text-slate-500">No data available</p>
      )}
    </div>
  );
}
