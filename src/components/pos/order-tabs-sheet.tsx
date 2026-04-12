"use client";

import { Plus, X, ShoppingCart, RotateCcw, Armchair } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TabContext } from "@/hooks/use-pos-tabs";
import { useLanguage } from "@/lib/i18n";

interface OrderTabsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: TabContext[];
  activeTabId: string;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
}

export function OrderTabsSheet({
  open,
  onOpenChange,
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNew,
}: OrderTabsSheetProps) {
  const { t } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t("pos.openOrders")}
            <Badge variant="secondary" className="text-xs">
              {tabs.filter(t => t.id === activeTabId || t.kotSentQuantities.size > 0 || t.cartState.items.length > 0).length}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {(() => {
            // Only show tabs that have KOT-sent items, cart items, or are the active tab
            const visibleTabs = tabs.filter(
              (tab) => tab.id === activeTabId || tab.kotSentQuantities.size > 0 || tab.cartState.items.length > 0
            ).sort((a, b) => a.orderNumber - b.orderNumber);
            return visibleTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <ShoppingCart className="h-8 w-8" />
              <span className="text-sm">{t("pos.noOpenOrders")}</span>
            </div>
          ) : (
            <ul className="divide-y">
              {visibleTabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const itemCount = tab.cartState.items.length;
                const totalQty = tab.cartState.totalQuantity;
                const hasKotItems = tab.kotSentQuantities.size > 0;
                const canClose = !hasKotItems && (!isActive || itemCount === 0);

                return (
                  <li
                    key={tab.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                      isActive
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-slate-50 border-l-2 border-l-transparent"
                    )}
                    onClick={() => {
                      if (!isActive) {
                        onSwitch(tab.id);
                      }
                      onOpenChange(false);
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        tab.isReturnMode
                          ? "bg-red-100 text-red-600"
                          : tab.selectedTable
                            ? "bg-orange-100 text-orange-600"
                            : isActive
                              ? "bg-primary/10 text-primary"
                              : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {tab.isReturnMode ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : tab.selectedTable ? (
                        <Armchair className="h-4 w-4" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium text-sm truncate", isActive && "text-primary")}>
                          {tab.label}
                        </span>
                        {isActive && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {t("common.active")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {tab.selectedCustomer ? (
                          <span className="truncate">{tab.selectedCustomer.name}</span>
                        ) : (
                          <span>{t("pos.noCustomer")}</span>
                        )}
                      </div>
                    </div>

                    {/* Item count */}
                    {itemCount > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 text-xs",
                          tab.isReturnMode && "bg-red-100 text-red-700"
                        )}
                      >
                        {totalQty} {totalQty === 1 ? t("common.item") : t("common.items")}
                      </Badge>
                    )}

                    {/* Billed indicator */}
                    {tab.preBillPrinted && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-xs bg-green-50 text-green-700 border-green-200"
                      >
                        {t("pos.preBillPrinted")}
                      </Badge>
                    )}

                    {/* Close button */}
                    {canClose && tabs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose(tab.id);
                        }}
                        title={t("common.close")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          );
          })()}
        </div>

        {/* New order button */}
        <div className="border-t p-4 shrink-0">
          <Button
            className="w-full"
            onClick={() => {
              onNew();
              onOpenChange(false);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("pos.newOrder")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
