"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

type SettingsTab = "company" | "units" | "accounting" | "pos" | "users";

function SettingsPanelFallback() {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

const CompanySettings = dynamic(
  () => import("@/components/settings/company-settings").then((mod) => mod.CompanySettings),
  { loading: () => <SettingsPanelFallback /> }
);
const UnitsSettings = dynamic(
  () => import("@/components/settings/units-settings").then((mod) => mod.UnitsSettings),
  { loading: () => <SettingsPanelFallback /> }
);
const AccountingSettings = dynamic(
  () => import("@/components/settings/accounting-settings").then((mod) => mod.AccountingSettings),
  { loading: () => <SettingsPanelFallback /> }
);
const POSSettings = dynamic(
  () => import("@/components/settings/pos-settings").then((mod) => mod.POSSettings),
  { loading: () => <SettingsPanelFallback /> }
);
const UserWarehouseSettings = dynamic(
  () => import("@/components/settings/user-warehouse-settings").then((mod) => mod.UserWarehouseSettings),
  { loading: () => <SettingsPanelFallback /> }
);

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>("company");
  const [loadedTabs, setLoadedTabs] = useState<SettingsTab[]>(["company"]);

  const handleTabChange = (value: string) => {
    const nextTab = value as SettingsTab;
    setActiveTab(nextTab);
    setLoadedTabs((current) => (current.includes(nextTab) ? current : [...current, nextTab]));
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h2>
          <p className="text-slate-500">
            {t("settings.subtitle")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <TabsList className="h-auto w-max min-w-max justify-start gap-1 rounded-xl p-1 sm:w-fit sm:min-w-0">
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="company">{t("settings.tabCompany")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="units">{t("settings.tabUnits")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="accounting">{t("settings.tabAccounting")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="pos">{t("settings.tabPOS")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="users">{t("settings.tabUsers")}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="company" forceMount={loadedTabs.includes("company")} className="mt-6">
            {loadedTabs.includes("company") ? <CompanySettings /> : null}
          </TabsContent>
          <TabsContent value="units" forceMount={loadedTabs.includes("units")} className="mt-6">
            {loadedTabs.includes("units") ? <UnitsSettings /> : null}
          </TabsContent>
          <TabsContent value="accounting" forceMount={loadedTabs.includes("accounting")} className="mt-6">
            {loadedTabs.includes("accounting") ? <AccountingSettings /> : null}
          </TabsContent>
          <TabsContent value="pos" forceMount={loadedTabs.includes("pos")} className="mt-6">
            {loadedTabs.includes("pos") ? <POSSettings /> : null}
          </TabsContent>
          <TabsContent value="users" forceMount={loadedTabs.includes("users")} className="mt-6">
            {loadedTabs.includes("users") ? <UserWarehouseSettings /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </PageAnimation>
  );
}
