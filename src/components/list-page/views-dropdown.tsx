"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Plus, Pencil, Trash2, Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import type { SystemView, ViewFilters } from "@/lib/system-views";
import { cn } from "@/lib/utils";

export interface CustomViewData {
  id: string;
  name: string;
  filters: Record<string, string>;
  sortField: string | null;
  sortDirection: string | null;
  isDefault: boolean;
}

interface ViewsDropdownProps {
  module: string;
  systemViews: SystemView[];
  activeViewId: string;
  onViewChange: (viewId: string, filters: ViewFilters, customView?: CustomViewData) => void;
  onSaveView: () => void;
  /** Called when user clicks edit on a custom view */
  onEditView?: (view: CustomViewData) => void;
  /** Change this value to trigger a refetch of custom views */
  refreshKey?: number;
  className?: string;
}

export function ViewsDropdown({
  module,
  systemViews,
  activeViewId,
  onViewChange,
  onSaveView,
  onEditView,
  refreshKey,
  className,
}: ViewsDropdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [customViews, setCustomViews] = useState<CustomViewData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchCustomViews = useCallback(async () => {
    try {
      const res = await fetch(`/api/custom-views?module=${module}`);
      if (res.ok) {
        const data = await res.json();
        setCustomViews(data);
      }
    } catch {
      // silent fail
    }
  }, [module]);

  useEffect(() => {
    fetchCustomViews();
  }, [fetchCustomViews, refreshKey]);

  // Check for a default custom view on mount
  useEffect(() => {
    const defaultView = customViews.find((v) => v.isDefault);
    if (defaultView && activeViewId === "all") {
      onViewChange(`custom:${defaultView.id}`, { params: defaultView.filters }, defaultView);
    }
    // Only run once when custom views are first loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customViews.length]);

  const handleSelectSystem = (view: SystemView) => {
    onViewChange(view.id, view.filters);
    setOpen(false);
  };

  const handleSelectCustom = (view: CustomViewData) => {
    onViewChange(`custom:${view.id}`, { params: view.filters }, view);
    setOpen(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/custom-views/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCustomViews((prev) => prev.filter((v) => v.id !== id));
      // If we were viewing this one, reset to "all"
      if (activeViewId === `custom:${id}`) {
        const allView = systemViews[0];
        onViewChange(allView.id, allView.filters);
      }
      toast.success(t("views.viewDeleted"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleToggleDefault = async (view: CustomViewData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/custom-views/${view.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: !view.isDefault }),
      });
      if (!res.ok) throw new Error();
      await fetchCustomViews();
      toast.success(view.isDefault ? t("views.defaultRemoved") : t("views.defaultSet"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/custom-views/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error();
      setCustomViews((prev) =>
        prev.map((v) => (v.id === id ? { ...v, name: editName.trim() } : v))
      );
      setEditingId(null);
      toast.success(t("views.viewRenamed"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const startRename = (view: CustomViewData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(view.id);
    setEditName(view.name);
  };

  // Determine current label
  const getActiveLabel = () => {
    if (activeViewId.startsWith("custom:")) {
      const customId = activeViewId.replace("custom:", "");
      const view = customViews.find((v) => v.id === customId);
      return view?.name || t("views.customView");
    }
    const sysView = systemViews.find((v) => v.id === activeViewId);
    return sysView ? t(sysView.labelKey) : t(systemViews[0].labelKey);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between gap-1.5 font-medium text-slate-700 border-slate-200 hover:border-slate-300 bg-white",
            className
          )}
        >
          <span className="truncate">{getActiveLabel()}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 rounded-xl"
        align="start"
        sideOffset={6}
      >
        <div className="max-h-80 overflow-y-auto">
          {/* System views */}
          <div className="p-1.5">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("views.systemViews")}
            </div>
            {systemViews.map((view) => (
              <button
                key={view.id}
                onClick={() => handleSelectSystem(view)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  activeViewId === view.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {activeViewId === view.id && (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className={activeViewId === view.id ? "" : "ml-5.5"}>
                  {t(view.labelKey)}
                </span>
              </button>
            ))}
          </div>

          {/* Custom views */}
          {customViews.length > 0 && (
            <>
              <div className="mx-3 border-t border-slate-100" />
              <div className="p-1.5">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("views.customViews")}
                </div>
                {customViews.map((view) => (
                  <div
                    key={view.id}
                    onClick={() => handleSelectCustom(view)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer",
                      activeViewId === `custom:${view.id}`
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {activeViewId === `custom:${view.id}` && (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", activeViewId !== `custom:${view.id}` && "ml-5.5")}>
                      {editingId === view.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => handleRename(view.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(view.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded border border-slate-200 px-1.5 py-0.5 text-sm outline-none focus:border-primary"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{view.name}</span>
                          {view.isDefault && (
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                    {editingId !== view.id && (
                      <div className="hidden items-center gap-0.5 group-hover:flex">
                        <button
                          onClick={(e) => handleToggleDefault(view, e)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-500"
                          title={view.isDefault ? t("views.removeDefault") : t("views.setAsDefault")}
                        >
                          <Star className={cn("h-3 w-3", view.isDefault && "fill-amber-400 text-amber-400")} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            if (onEditView) onEditView(view);
                            else startRename(view, e);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title={t("common.edit") || "Edit"}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(view.id, e)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* New Custom View */}
          <div className="mx-3 border-t border-slate-100" />
          <div className="p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onSaveView();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("views.newCustomView")}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
