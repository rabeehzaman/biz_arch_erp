"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

export function AccountingSettings() {
  const { t } = useLanguage();
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    checkAccounts();
  }, []);

  const checkAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      const data = await response.json();
      setHasAccounts(Array.isArray(data) && data.length > 0);
    } catch {
      setHasAccounts(false);
    }
  };

  const handleSeedCOA = async () => {
    setIsSeeding(true);
    try {
      const response = await fetch("/api/accounts/seed", {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to seed");
      }
      toast.success("Chart of accounts created successfully");
      setHasAccounts(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to seed chart of accounts"
      );
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("accounting.chartOfAccounts")}</CardTitle>
          <CardDescription>
            {t("accounting.foundation")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasAccounts === null ? (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              {t("accounting.checking")}
            </div>
          ) : hasAccounts ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">
                {t("accounting.isSetup")}
              </span>
              <Badge variant="secondary">{t("common.active")}</Badge>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {t("accounting.noAccountsYet")}
              </p>
              <Button onClick={handleSeedCOA} disabled={isSeeding}>
                <BookOpen className="mr-2 h-4 w-4" />
                {isSeeding ? t("accounting.settingUp") : t("accounting.setUpCoA")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
