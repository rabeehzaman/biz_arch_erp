"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettings } from "@/components/settings/company-settings";
import { UnitsSettings } from "@/components/settings/units-settings";
import { AccountingSettings } from "@/components/settings/accounting-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500">
          Manage your company information, banking details, and units of measure
        </p>
      </div>

      <Tabs defaultValue="company">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="units">Units of Measure</TabsTrigger>
            <TabsTrigger value="accounting">Accounting</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
