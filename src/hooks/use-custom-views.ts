"use client";

import { useState, useMemo, useCallback } from "react";
import type { SystemView, ViewFilters } from "@/lib/system-views";
import type { CustomViewData } from "@/components/list-page/views-dropdown";

interface UseCustomViewsOptions {
  module: string;
  systemViews: SystemView[];
}

interface UseCustomViewsReturn {
  /** Current active view ID: "all", "paid", or "custom:<id>" */
  activeViewId: string;
  /** Filters to pass to useInfiniteList params or fetch calls */
  activeFilters: Record<string, string>;
  /** Client-side status filter */
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  /** Client-side date filter */
  dateFilter: string;
  setDateFilter: (v: string) => void;
  /** Sort state */
  sortField: string | null;
  sortDirection: "asc" | "desc";
  setSortField: (v: string | null) => void;
  setSortDirection: (v: "asc" | "desc") => void;
  /** Toggle sort on a column */
  toggleSort: (field: string) => void;
  /** Advanced search state */
  advancedSearch: Record<string, string>;
  advancedSearchOpen: boolean;
  setAdvancedSearchOpen: (v: boolean) => void;
  /** Number of active advanced search filters */
  activeFilterCount: number;
  /** Called when user selects a view from ViewsDropdown */
  handleViewChange: (viewId: string, filters: ViewFilters, customView?: CustomViewData) => void;
  /** Called when user applies advanced search */
  handleAdvancedSearch: (values: Record<string, string>) => void;
  /** Called when user resets advanced search */
  handleResetAdvancedSearch: () => void;
  /** Save view dialog state */
  saveViewDialogOpen: boolean;
  setSaveViewDialogOpen: (v: boolean) => void;
  /** Opens save view dialog */
  handleSaveView: () => void;
  /** Current filters formatted for saving as a custom view */
  filtersForSave: Record<string, string>;
  /** Current sort field for saving */
  sortFieldForSave: string | null;
  /** Current sort direction for saving */
  sortDirectionForSave: string | null;
  /** Trigger ViewsDropdown to refetch */
  viewsRefreshKey: number;
  /** Call after a view is saved to refetch the views list */
  handleViewSaved: () => void;
  /** View currently being edited (for edit mode) */
  editingView: CustomViewData | undefined;
  /** Called when user clicks edit on a custom view */
  handleEditView: (view: CustomViewData) => void;
}

export function useCustomViews({
  systemViews,
}: UseCustomViewsOptions): UseCustomViewsReturn {
  const [activeViewId, setActiveViewId] = useState("all");
  const [advancedSearch, setAdvancedSearch] = useState<Record<string, string>>({});
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [viewsRefreshKey, setViewsRefreshKey] = useState(0);
  const [editingView, setEditingView] = useState<CustomViewData | undefined>(undefined);

  // Build the params that go to useInfiniteList / fetch
  const activeFilters = useMemo(() => {
    const p: Record<string, string> = {};
    Object.entries(advancedSearch).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    return p;
  }, [advancedSearch]);

  const activeFilterCount = useMemo(
    () => Object.values(advancedSearch).filter((v) => v).length,
    [advancedSearch]
  );

  const handleViewChange = useCallback(
    (viewId: string, filters: ViewFilters, customView?: CustomViewData) => {
      setActiveViewId(viewId);

      if (customView) {
        // Custom view — restore saved filters
        setAdvancedSearch(customView.filters || {});
        if (customView.sortField) {
          setSortField(customView.sortField);
          setSortDirection((customView.sortDirection as "asc" | "desc") || "desc");
        } else {
          setSortField(null);
          setSortDirection("desc");
        }
        // Custom views don't store statusFilter/dateFilter separately,
        // they're encoded in the filters params. Reset to "all" for client-side.
        setStatusFilter("all");
        setDateFilter("all");
      } else {
        // System view — apply its filter config
        setAdvancedSearch(filters.params || {});
        setStatusFilter(filters.statusFilter || "all");
        setDateFilter(filters.dateFilter || "all");
        setSortField(null);
        setSortDirection("desc");
      }
    },
    []
  );

  const handleAdvancedSearch = useCallback(
    (values: Record<string, string>) => {
      setAdvancedSearch(values);
      // When user applies custom filters, switch to the first system view
      // but keep the advanced filters on top
      const currentSystem = systemViews.find((v) => v.id === activeViewId);
      if (!currentSystem && !activeViewId.startsWith("custom:")) {
        setActiveViewId("all");
      }
    },
    [activeViewId, systemViews]
  );

  const handleResetAdvancedSearch = useCallback(() => {
    setAdvancedSearch({});
  }, []);

  const toggleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  const handleSaveView = useCallback(() => {
    setEditingView(undefined);
    setSaveViewDialogOpen(true);
  }, []);

  const handleEditView = useCallback((view: CustomViewData) => {
    setEditingView(view);
    setSaveViewDialogOpen(true);
  }, []);

  const handleViewSaved = useCallback(() => {
    setEditingView(undefined);
    setViewsRefreshKey((k) => k + 1);
  }, []);

  // Aggregate current state for saving
  const filtersForSave = useMemo(() => {
    const f: Record<string, string> = { ...advancedSearch };
    // Include status/date if not "all" — these are API-level filters
    if (statusFilter !== "all") f._statusFilter = statusFilter;
    if (dateFilter !== "all") f._dateFilter = dateFilter;
    // Remove empty values
    Object.keys(f).forEach((k) => {
      if (!f[k]) delete f[k];
    });
    return f;
  }, [advancedSearch, statusFilter, dateFilter]);

  return {
    activeViewId,
    activeFilters,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    toggleSort,
    advancedSearch,
    advancedSearchOpen,
    setAdvancedSearchOpen,
    activeFilterCount,
    handleViewChange,
    handleAdvancedSearch,
    handleResetAdvancedSearch,
    saveViewDialogOpen,
    setSaveViewDialogOpen,
    handleSaveView,
    filtersForSave,
    sortFieldForSave: sortField,
    sortDirectionForSave: sortDirection,
    viewsRefreshKey,
    handleViewSaved,
    editingView,
    handleEditView,
  };
}
