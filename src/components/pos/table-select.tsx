"use client";

import useSWR from "swr";
import { Loader2, Users, Package } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RestaurantTable {
  id: string;
  number: number;
  name: string;
  capacity: number;
  floor?: string | null;
  section?: string | null;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
}

interface TableSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTable: (table: { id: string; number: number; name: string; section?: string; capacity: number } | null) => void;
  onTakeaway: () => void;
  /** When true, the sheet cannot be dismissed by tapping outside — user must pick a table or takeaway */
  required?: boolean;
}

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-50 border-green-300 hover:bg-green-100 text-green-800",
  OCCUPIED: "bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-800",
  RESERVED: "bg-blue-50 border-blue-300 text-blue-800 opacity-60 cursor-not-allowed",
  CLEANING: "bg-gray-50 border-gray-300 text-gray-500 opacity-60 cursor-not-allowed",
};

const statusLabelKeys: Record<string, string> = {
  AVAILABLE: "restaurant.available",
  OCCUPIED: "restaurant.occupied",
  RESERVED: "restaurant.reserved",
  CLEANING: "restaurant.cleaning",
};

export function TableSelect({ open, onOpenChange, onSelectTable, onTakeaway, required }: TableSelectProps) {
  const { t } = useLanguage();
  const { data: tables, isLoading } = useSWR<RestaurantTable[]>(
    open ? "/api/restaurant/tables" : null,
    fetcher,
    { revalidateOnMount: true, dedupingInterval: 0 }
  );

  const handleTableClick = (table: RestaurantTable) => {
    if (table.status !== "AVAILABLE" && table.status !== "OCCUPIED") return;
    onSelectTable({
      id: table.id,
      number: table.number,
      name: table.name,
      section: table.section || undefined,
      capacity: table.capacity,
    });
  };

  const handleTakeaway = () => {
    onTakeaway();
    onOpenChange(false);
  };

  // Group tables by section
  const sections = (tables || []).reduce<Record<string, RestaurantTable[]>>((acc, table) => {
    const key = table.section || table.floor || "Main";
    if (!acc[key]) acc[key] = [];
    acc[key].push(table);
    return acc;
  }, {});

  return (
    <>
      <Sheet open={open} onOpenChange={required ? undefined : onOpenChange}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto" onInteractOutside={required ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={required ? (e) => e.preventDefault() : undefined}>
          <SheetHeader>
            <SheetTitle>{t("restaurant.selectTable")}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Takeaway button */}
            <Button
              variant="outline"
              className="w-full h-12 border-2 border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium"
              onClick={handleTakeaway}
            >
              <Package className="h-5 w-5 mr-2" />
              {t("restaurant.takeaway")}
            </Button>

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Table grid by section */}
            {!isLoading && Object.entries(sections).map(([sectionName, sectionTables]) => (
              <div key={sectionName}>
                {Object.keys(sections).length > 1 && (
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{sectionName}</h3>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {sectionTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      disabled={table.status !== "AVAILABLE" && table.status !== "OCCUPIED"}
                      className={`relative flex flex-col items-center justify-center rounded-lg border-2 p-3 transition-colors ${statusColors[table.status] || statusColors.CLEANING}`}
                    >
                      <span className="text-lg font-bold">{table.number}</span>
                      <span className="text-xs truncate max-w-full">{table.name}</span>
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        <Users className="h-3 w-3" />
                        <span>{table.capacity}</span>
                      </div>
                      {table.status !== "AVAILABLE" && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 text-[10px] px-1 py-0"
                        >
                          {t(statusLabelKeys[table.status])}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* No tables */}
            {!isLoading && (!tables || tables.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">{t("restaurant.noTablesConfigured")}</p>
                <p className="text-xs mt-1">{t("restaurant.addTablesInSettings")}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
