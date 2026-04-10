"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface BOMDetail {
  id: string;
  name: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  bomType: string;
  outputQuantity: string;
  autoConsumeOnSale: boolean;
  consumptionPolicy: string;
  processLossPercent: string;
  totalMaterialCost: string | null;
  notes: string | null;
  product: { id: string; name: string; sku: string | null; price: string; cost: string };
  unit: { id: string; name: string; code: string } | null;
  items: Array<{
    id: string;
    quantity: string;
    wastagePercent: string;
    issueMethod: string;
    isPhantom: boolean;
    product: { id: string; name: string; sku: string | null; cost: string };
    unit: { id: string; name: string; code: string } | null;
  }>;
  _count: { productionOrders: number };
}

interface CostRollup {
  totalMaterialCost: number;
  costPerUnit: number;
  components: Array<{
    productName: string;
    quantity: number;
    wastagePercent: number;
    effectiveQuantity: number;
    unitCost: number;
    lineCost: number;
    costSource: string;
    hasWarning: boolean;
  }>;
  warnings: string[];
}

export default function BOMDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [bom, setBom] = useState<BOMDetail | null>(null);
  const [costRollup, setCostRollup] = useState<CostRollup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBom();
  }, [params.id]);

  async function fetchBom() {
    try {
      const [bomRes, costRes] = await Promise.all([
        fetch(`/api/manufacturing/bom/${params.id}`),
        fetch(`/api/manufacturing/bom/${params.id}/cost-rollup`),
      ]);
      if (bomRes.ok) setBom(await bomRes.json());
      if (costRes.ok) setCostRollup(await costRes.json());
    } catch {
      toast.error("Failed to load BOM");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    const res = await fetch(`/api/manufacturing/bom/${params.id}/activate`, { method: "POST" });
    if (res.ok) {
      toast.success(t("manufacturing.bomActivated"));
      fetchBom();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleArchive() {
    const res = await fetch(`/api/manufacturing/bom/${params.id}/archive`, { method: "POST" });
    if (res.ok) {
      toast.success(t("manufacturing.bomArchived"));
      fetchBom();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure?")) return;
    const res = await fetch(`/api/manufacturing/bom/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("manufacturing.bomDeleted"));
      router.push("/manufacturing/bom");
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!bom) {
    return <div className="p-6 text-center text-muted-foreground">BOM not found</div>;
  }

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    ACTIVE: "bg-green-100 text-green-800",
    ARCHIVED: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/manufacturing/bom">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{bom.name}</h1>
            <Badge variant="outline">v{bom.version}</Badge>
            <Badge className={statusColors[bom.status]}>{t(`manufacturing.${bom.status.toLowerCase()}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{bom.product.name}</p>
        </div>
        <div className="flex gap-2">
          {bom.status === "DRAFT" && (
            <>
              <Button onClick={handleActivate} variant="default" size="sm">
                <CheckCircle className="mr-1 h-4 w-4" /> {t("manufacturing.activateBOM")}
              </Button>
              <Button onClick={handleDelete} variant="destructive" size="sm">
                <Trash2 className="mr-1 h-4 w-4" />
              </Button>
            </>
          )}
          {bom.status === "ACTIVE" && (
            <Button onClick={handleArchive} variant="outline" size="sm">
              <Archive className="mr-1 h-4 w-4" /> {t("manufacturing.archiveBOM")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("manufacturing.bomType")}</p>
            <p className="text-lg font-semibold">{t(`manufacturing.${bom.bomType.toLowerCase()}`)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("manufacturing.outputQuantity")}</p>
            <p className="text-lg font-semibold">{Number(bom.outputQuantity)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("manufacturing.totalMaterialCost")}</p>
            <p className="text-lg font-semibold">
              {costRollup ? costRollup.totalMaterialCost.toFixed(2) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("manufacturing.costPerUnit")}</p>
            <p className="text-lg font-semibold">
              {costRollup ? costRollup.costPerUnit.toFixed(2) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {costRollup && costRollup.warnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="font-medium text-yellow-800">Warnings</p>
            <ul className="mt-1 list-inside list-disc text-sm text-yellow-700">
              {costRollup.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("manufacturing.components")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.requiredQty")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.wastagePercent")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.unitCost")}</TableHead>
                <TableHead className="text-right">{t("manufacturing.lineCost")}</TableHead>
                <TableHead>{t("manufacturing.issueMethod")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(costRollup?.components || []).map((comp, i) => (
                <TableRow key={i} className={comp.hasWarning ? "bg-yellow-50" : ""}>
                  <TableCell className="font-medium">{comp.productName}</TableCell>
                  <TableCell className="text-right">{comp.effectiveQuantity}</TableCell>
                  <TableCell className="text-right">{comp.wastagePercent}%</TableCell>
                  <TableCell className="text-right">
                    {comp.unitCost.toFixed(2)}
                    <span className="ml-1 text-xs text-muted-foreground">({comp.costSource})</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{comp.lineCost.toFixed(2)}</TableCell>
                  <TableCell>
                    {bom.items[i]?.issueMethod === "MANUAL"
                      ? t("manufacturing.manual")
                      : t("manufacturing.backflush")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
