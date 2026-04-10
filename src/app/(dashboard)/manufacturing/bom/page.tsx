"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface BOM {
  id: string;
  name: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  bomType: "MANUFACTURING" | "RECIPE" | "KIT";
  outputQuantity: string;
  autoConsumeOnSale: boolean;
  totalMaterialCost: string | null;
  product: { id: string; name: string; sku: string | null };
  items: Array<{ id: string }>;
  _count: { productionOrders: number };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-green-100 text-green-800",
  ARCHIVED: "bg-yellow-100 text-yellow-800",
};

const typeColors: Record<string, string> = {
  MANUFACTURING: "bg-blue-100 text-blue-800",
  RECIPE: "bg-purple-100 text-purple-800",
  KIT: "bg-orange-100 text-orange-800",
};

export default function BOMListPage() {
  const { t } = useLanguage();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchBoms();
  }, [statusFilter]);

  async function fetchBoms() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/manufacturing/bom?${params}`);
      if (res.ok) {
        setBoms(await res.json());
      }
    } catch {
      toast.error("Failed to load BOMs");
    } finally {
      setLoading(false);
    }
  }

  const filtered = boms.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("manufacturing.billOfMaterials")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("manufacturing.components")} &amp; {t("manufacturing.costRollup")}
          </p>
        </div>
        <Link href="/manufacturing/bom/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("manufacturing.newBOM")}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {["all", "DRAFT", "ACTIVE", "ARCHIVED"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? t("common.all") : t(`manufacturing.${s.toLowerCase()}`)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">{t("manufacturing.noBOMFound")}</p>
            <Link href="/manufacturing/bom/new" className="mt-4">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {t("manufacturing.newBOM")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((bom) => (
            <Link key={bom.id} href={`/manufacturing/bom/${bom.id}`}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{bom.name}</span>
                      <Badge variant="outline" className="text-xs">v{bom.version}</Badge>
                      <Badge className={`text-xs ${statusColors[bom.status]}`}>
                        {t(`manufacturing.${bom.status.toLowerCase()}`)}
                      </Badge>
                      <Badge className={`text-xs ${typeColors[bom.bomType]}`}>
                        {t(`manufacturing.${bom.bomType.toLowerCase()}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {bom.product.name} {bom.product.sku ? `(${bom.product.sku})` : ""} &middot; {bom.items.length} {t("manufacturing.components").toLowerCase()}
                      {bom.autoConsumeOnSale && " · Auto-consume"}
                    </p>
                  </div>
                  <div className="text-right">
                    {bom.totalMaterialCost && (
                      <p className="font-medium">{Number(bom.totalMaterialCost).toFixed(2)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {bom._count.productionOrders} {t("manufacturing.productionOrders").toLowerCase()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
