"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

type SettingsTab = "units" | "categories" | "accounting" | "pos" | "users" | "employees" | "restaurant";

function SettingsPanelFallback() {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

const UnitsSettings = dynamic(
  () => import("@/components/settings/units-settings").then((mod) => mod.UnitsSettings),
  { loading: () => <SettingsPanelFallback /> }
);
const CategoriesSettings = dynamic(
  () => import("@/components/settings/categories-settings").then((mod) => mod.CategoriesSettings),
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
const EmployeesSettings = dynamic(
  () => import("@/components/settings/employees-settings").then((mod) => mod.EmployeesSettings),
  { loading: () => <SettingsPanelFallback /> }
);
const RestaurantSettings = dynamic(
  () => import("@/components/settings/restaurant-settings").then((mod) => mod.RestaurantSettings),
  { loading: () => <SettingsPanelFallback /> }
);

export default function SettingsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const isRestaurantEnabled = (session?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled ?? false;
  const [activeTab, setActiveTab] = useState<SettingsTab>("units");
  const [loadedTabs, setLoadedTabs] = useState<SettingsTab[]>(["units"]);

  const getForceMountProps = (tab: SettingsTab) =>
    loadedTabs.includes(tab) ? { forceMount: true as const } : {};

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
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="units">{t("settings.tabUnits")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="categories">{t("settings.tabCategories")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="accounting">{t("settings.tabAccounting")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="pos">{t("settings.tabPOS")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="users">{t("settings.tabUsers")}</TabsTrigger>
              <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="employees">{t("settings.tabEmployees")}</TabsTrigger>
              {isRestaurantEnabled && (
                <TabsTrigger className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2" value="restaurant">{t("settings.tabRestaurant")}</TabsTrigger>
              )}
            </TabsList>
          </div>
          <TabsContent value="units" {...getForceMountProps("units")} className="mt-6 data-[state=inactive]:hidden">
            {loadedTabs.includes("units") ? <UnitsSettings /> : null}
          </TabsContent>
          <TabsContent value="categories" {...getForceMountProps("categories")} className="mt-6 data-[state=inactive]:hidden">
            {loadedTabs.includes("categories") ? <CategoriesSettings /> : null}
          </TabsContent>
          <TabsContent value="accounting" {...getForceMountProps("accounting")} className="mt-6 data-[state=inactive]:hidden">
            {loadedTabs.includes("accounting") ? <AccountingSettings /> : null}
          </TabsContent>
          <TabsContent value="pos" {...getForceMountProps("pos")} className="mt-6 data-[state=inactive]:hidden">
            {loadedTabs.includes("pos") ? <POSSettings /> : null}
          </TabsContent>
          <TabsContent value="users" {...getForceMountProps("users")} className="mt-6 data-[state=inactive]:hidden">
            {loadedTabs.includes("users") ? <UserWarehouseSettings /> : null}
          </TabsContent>
          <TabsContent value="employees" {...getForceMountProps("employees")} className="mt-6 data-[state=inactive]:hidden">
            {loadedTabs.includes("employees") ? <EmployeesSettings /> : null}
          </TabsContent>
          {isRestaurantEnabled && (
            <TabsContent value="restaurant" {...getForceMountProps("restaurant")} className="mt-6 data-[state=inactive]:hidden">
              {loadedTabs.includes("restaurant") ? <RestaurantSettings /> : null}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageAnimation>
  );
}
