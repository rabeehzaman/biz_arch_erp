"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettings } from "@/components/settings/company-settings";
import { UnitsSettings } from "@/components/settings/units-settings";
import { AccountingSettings } from "@/components/settings/accounting-settings";
import { POSSettings } from "@/components/settings/pos-settings";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <PageAnimation>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h2>
          <p className="text-slate-500">
            {t("settings.subtitle")}
          </p>
        </div>

        <Tabs defaultValue="company">
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="company">{t("settings.tabCompany")}</TabsTrigger>
              <TabsTrigger value="units">{t("settings.tabUnits")}</TabsTrigger>
              <TabsTrigger value="accounting">{t("settings.tabAccounting")}</TabsTrigger>
              <TabsTrigger value="pos">{t("settings.tabPOS")}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="company" className="mt-6">
            <CompanySettings />
          </TabsContent>
          <TabsContent value="units" className="mt-6">
            <UnitsSettings />
          </TabsContent>
          <TabsContent value="accounting" className="mt-6">
            <AccountingSettings />
          </TabsContent>
          <TabsContent value="pos" className="mt-6">
            <POSSettings />
          </TabsContent>
        </Tabs>
      </div>
    </PageAnimation>
  );
}
