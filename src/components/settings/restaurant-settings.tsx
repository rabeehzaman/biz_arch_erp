"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { UtensilsCrossed, Printer, Grid3X3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/i18n";
import { KOTPrinterSettingsDialog } from "@/components/restaurant/kot-printer-settings-dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RestaurantSettings() {
    const { t } = useLanguage();
    const { data: settings, mutate } = useSWR("/api/settings/restaurant", fetcher);
    const [kotPrinterOpen, setKotPrinterOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const autoPrintKot = settings?.restaurant_auto_print_kot === "true";
    const showTableGrid = settings?.restaurant_show_table_grid !== "false"; // default true

    const handleToggle = async (key: string, value: boolean) => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/restaurant", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value: String(value) }),
            });
            if (!res.ok) throw new Error();
            mutate();
            toast.success(t("settings.saved"));
        } catch {
            toast.error(t("settings.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* KOT Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5" />
                        {t("restaurant.kotSettings") || "KOT Settings"}
                    </CardTitle>
                    <CardDescription>
                        {t("restaurant.kotSettingsDesc") || "Configure kitchen order token printing and behavior"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>{t("restaurant.autoPrintKot") || "Auto-print KOT"}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t("restaurant.autoPrintKotDesc") || "Automatically print when KOT is created"}
                            </p>
                        </div>
                        <Switch
                            checked={autoPrintKot}
                            onCheckedChange={(checked) => handleToggle("restaurant_auto_print_kot", checked)}
                            disabled={saving}
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                                <Printer className="h-4 w-4" />
                                {t("restaurant.kotPrinterSettings") || "KOT Printer Settings"}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {t("restaurant.configureKotPrinter") || "Configure the printer for kitchen order tokens"}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setKotPrinterOpen(true)}>
                            {t("restaurant.configure") || "Configure"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table Display Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Grid3X3 className="h-5 w-5" />
                        {t("restaurant.tableSettings") || "Table Display"}
                    </CardTitle>
                    <CardDescription>
                        {t("restaurant.tableSettingsDesc") || "Configure how tables appear in POS"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>{t("restaurant.showTableGrid") || "Show table grid in POS"}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t("restaurant.showTableGridDesc") || "Display table selection grid when starting an order"}
                            </p>
                        </div>
                        <Switch
                            checked={showTableGrid}
                            onCheckedChange={(checked) => handleToggle("restaurant_show_table_grid", checked)}
                            disabled={saving}
                        />
                    </div>
                </CardContent>
            </Card>

            <KOTPrinterSettingsDialog open={kotPrinterOpen} onOpenChange={setKotPrinterOpen} />
        </div>
    );
}
