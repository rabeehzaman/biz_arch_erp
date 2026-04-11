"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Save,
  ChevronDown,
  ChevronRight,
  FileText,
  BarChart3,
  PanelLeft,
  Smartphone,
  Home,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlertTriangle,
  X,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

import {
  FORM_REGISTRY,
  SIDEBAR_SECTIONS,
  SIDEBAR_ITEMS,
  MOBILE_NAV_TAB_POOL,
  LANDING_PAGE_OPTIONS,
  ALL_REPORT_SLUGS,
  POS_COMPONENT_CATEGORIES,
  type FormName,
  type OrgFormConfig,
  type MobileNavTab,
  type ColumnDef,
} from "@/lib/form-config/types";

// ── Report categories for grouping ─────────────────────────────
const REPORT_CATEGORIES: { label: string; slugs: string[] }[] = [
  {
    label: "Sales",
    slugs: [
      "profit-by-items",
      "sales-by-customer",
      "sales-by-item",
      "sales-by-salesperson",
      "sales-register",
    ],
  },
  {
    label: "Purchases",
    slugs: ["purchase-register", "purchases-by-supplier", "purchases-by-item"],
  },
  {
    label: "Receivables & Payables",
    slugs: ["customer-balances", "supplier-balances", "ar-aging", "ap-aging"],
  },
  {
    label: "Financial Statements",
    slugs: ["profit-loss", "balance-sheet", "trial-balance", "cash-flow"],
  },
  {
    label: "Cash & Bank",
    slugs: ["cash-book", "bank-book", "cash-bank-summary", "ledger"],
  },
  {
    label: "Tax",
    slugs: ["vat-summary", "vat-detail", "gst-summary", "gst-detail"],
  },
  {
    label: "Other",
    slugs: ["expense-report", "stock-summary", "branch-pl"],
  },
];

// ── Human-readable sidebar section labels ───────────────────────
const SIDEBAR_SECTION_LABELS: Record<string, string> = {
  general: "General",
  sales: "Sales",
  purchases: "Purchases",
  accounting: "Accounting",
  inventory: "Inventory",
  mobileShop: "Mobile Shop",
  jewellery: "Jewellery",
  restaurant: "Restaurant",
};

// ── Human-readable report slug labels ───────────────────────────
const REPORT_SLUG_LABELS: Record<string, string> = {
  "profit-by-items": "Profit by Items",
  "sales-by-customer": "Sales by Customer",
  "sales-by-item": "Sales by Item",
  "sales-by-salesperson": "Sales by Salesperson",
  "sales-register": "Sales Register",
  "purchase-register": "Purchase Register",
  "purchases-by-supplier": "Purchases by Supplier",
  "purchases-by-item": "Purchases by Item",
  "customer-balances": "Customer Balances",
  "supplier-balances": "Supplier Balances",
  "ar-aging": "AR Aging",
  "ap-aging": "AP Aging",
  "profit-loss": "Profit & Loss",
  "balance-sheet": "Balance Sheet",
  "trial-balance": "Trial Balance",
  "cash-flow": "Cash Flow",
  "cash-book": "Cash Book",
  "bank-book": "Bank Book",
  "cash-bank-summary": "Cash & Bank Summary",
  ledger: "Ledger",
  "vat-summary": "VAT Summary",
  "vat-detail": "VAT Detail",
  "gst-summary": "GST Summary",
  "gst-detail": "GST Detail",
  "expense-report": "Expense Report",
  "stock-summary": "Stock Summary",
  "branch-pl": "Branch P&L",
};

// ── Collapsible section component ───────────────────────────────
function CollapsibleSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-0.5 text-xs">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Default config to use when server returns nothing ───────────
function defaultConfig(): OrgFormConfig {
  return {
    fields: {},
    disabledReports: [],
    disabledSidebarItems: [],
    sidebarMode: "full",
    sidebarSectionOrder: null,
    mobileNavTabs: null,
    defaultLandingPage: null,
    posHiddenComponents: [],
  };
}

// ── Default mobile tabs ─────────────────────────────────────────
const DEFAULT_MOBILE_TABS: MobileNavTab[] = MOBILE_NAV_TAB_POOL.slice(0, 5);

// ── Main component ──────────────────────────────────────────────
interface FormConfigTabProps {
  orgId: string;
  edition?: string;
  /** If set, editing user-level config instead of org-level */
  userId?: string;
  userName?: string;
}

export function FormConfigTab({ orgId, edition, userId, userName }: FormConfigTabProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState<OrgFormConfig>(defaultConfig());
  const [orgConfig, setOrgConfig] = useState<OrgFormConfig | null>(null);
  const [hasUserOverrides, setHasUserOverrides] = useState(false);

  // Track which form accordions are expanded
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());

  const isUserMode = !!userId;

  const fetchConfig = useCallback(async () => {
    try {
      if (isUserMode) {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/user-form-config/${userId}`
        );
        if (res.ok) {
          const data = await res.json();
          setOrgConfig(data.orgConfig);
          setHasUserOverrides(data.overriddenKeys.length > 0);
          // If user has overrides, show user config; otherwise show org config as starting point
          const activeConfig = data.overriddenKeys.length > 0 ? data.userConfig : data.orgConfig;
          setConfig({
            fields: activeConfig.fields ?? {},
            disabledReports: activeConfig.disabledReports ?? [],
            disabledSidebarItems: activeConfig.disabledSidebarItems ?? [],
            sidebarMode: activeConfig.sidebarMode ?? "full",
            sidebarSectionOrder: activeConfig.sidebarSectionOrder ?? null,
            mobileNavTabs: activeConfig.mobileNavTabs ?? null,
            defaultLandingPage: activeConfig.defaultLandingPage ?? null,
            posHiddenComponents: activeConfig.posHiddenComponents ?? [],
          });
        } else {
          toast.error(t("admin.failedToLoadUserFormConfig"));
        }
      } else {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/form-config`
        );
        if (res.ok) {
          const data = await res.json();
          setConfig({
            fields: data.fields ?? {},
            disabledReports: data.disabledReports ?? [],
            disabledSidebarItems: data.disabledSidebarItems ?? [],
            sidebarMode: data.sidebarMode ?? "full",
            sidebarSectionOrder: data.sidebarSectionOrder ?? null,
            mobileNavTabs: data.mobileNavTabs ?? null,
            defaultLandingPage: data.defaultLandingPage ?? null,
            posHiddenComponents: data.posHiddenComponents ?? [],
          });
        } else {
          toast.error(t("admin.failedToLoadFormConfig"));
        }
      }
    } catch {
      toast.error(t("admin.failedToLoadFormConfig"));
    } finally {
      setLoading(false);
    }
  }, [orgId, userId, isUserMode]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = isUserMode
        ? `/api/admin/organizations/${orgId}/user-form-config/${userId}`
        : `/api/admin/organizations/${orgId}/form-config`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success(
          isUserMode
            ? `Configuration saved for ${userName}`
            : "Form configuration saved successfully"
        );
        if (isUserMode) setHasUserOverrides(true);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save configuration");
      }
    } catch {
      toast.error(t("admin.failedToSaveConfig"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetToOrg = async () => {
    if (!isUserMode) return;
    setResetting(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/user-form-config/${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success(`Configuration reset to org defaults for ${userName}`);
        setHasUserOverrides(false);
        // Reload to show org config
        setLoading(true);
        fetchConfig();
      } else {
        toast.error(t("admin.failedToResetConfig"));
      }
    } catch {
      toast.error(t("admin.failedToResetConfig"));
    } finally {
      setResetting(false);
    }
  };

  const handleCopyFromOrg = () => {
    if (!orgConfig) return;
    setConfig({
      fields: orgConfig.fields ?? {},
      disabledReports: orgConfig.disabledReports ?? [],
      disabledSidebarItems: orgConfig.disabledSidebarItems ?? [],
      sidebarMode: orgConfig.sidebarMode ?? "full",
      sidebarSectionOrder: orgConfig.sidebarSectionOrder ?? null,
      mobileNavTabs: orgConfig.mobileNavTabs ?? null,
      defaultLandingPage: orgConfig.defaultLandingPage ?? null,
      posHiddenComponents: orgConfig.posHiddenComponents ?? [],
    });
    toast.success(t("admin.loadedOrgConfig"));
  };

  // ── Field helpers ───────────────────────────────────────────
  const isFieldHidden = (formName: FormName, fieldKey: string): boolean => {
    return config.fields[formName]?.hidden?.includes(fieldKey) ?? false;
  };

  const toggleFieldHidden = (formName: FormName, fieldKey: string) => {
    setConfig((prev) => {
      const formConfig = prev.fields[formName] ?? { hidden: [], defaults: {} };
      const hidden = formConfig.hidden.includes(fieldKey)
        ? formConfig.hidden.filter((k) => k !== fieldKey)
        : [...formConfig.hidden, fieldKey];
      return {
        ...prev,
        fields: {
          ...prev.fields,
          [formName]: { ...formConfig, hidden },
        },
      };
    });
  };

  const getFieldDefault = (
    formName: FormName,
    fieldKey: string
  ): string | number | boolean | undefined => {
    return config.fields[formName]?.defaults?.[fieldKey];
  };

  const setFieldDefault = (
    formName: FormName,
    fieldKey: string,
    value: string | number | boolean
  ) => {
    setConfig((prev) => {
      const formConfig = prev.fields[formName] ?? { hidden: [], defaults: {} };
      return {
        ...prev,
        fields: {
          ...prev.fields,
          [formName]: {
            ...formConfig,
            defaults: { ...formConfig.defaults, [fieldKey]: value },
          },
        },
      };
    });
  };

  // ── Column helpers ─────────────────────────────────────────
  const isColumnHiddenAdmin = (formName: FormName, colKey: string): boolean => {
    return config.fields[formName]?.hiddenColumns?.includes(colKey) ?? false;
  };

  const toggleColumnHidden = (formName: FormName, colKey: string) => {
    setConfig((prev) => {
      const formConfig = prev.fields[formName] ?? { hidden: [], defaults: {}, hiddenColumns: [] };
      const hiddenColumns = formConfig.hiddenColumns ?? [];
      const updated = hiddenColumns.includes(colKey)
        ? hiddenColumns.filter((k) => k !== colKey)
        : [...hiddenColumns, colKey];
      return {
        ...prev,
        fields: {
          ...prev.fields,
          [formName]: { ...formConfig, hiddenColumns: updated },
        },
      };
    });
  };

  // ── Sidebar item helpers ────────────────────────────────────
  const isSidebarItemDisabled = (item: string): boolean => {
    return config.disabledSidebarItems.includes(item);
  };

  const toggleSidebarItem = (item: string) => {
    setConfig((prev) => {
      const disabled = prev.disabledSidebarItems.includes(item)
        ? prev.disabledSidebarItems.filter((i) => i !== item)
        : [...prev.disabledSidebarItems, item];
      return { ...prev, disabledSidebarItems: disabled };
    });
  };

  // ── Report helpers ──────────────────────────────────────────
  const isReportDisabled = (slug: string): boolean => {
    return config.disabledReports.includes(slug);
  };

  const toggleReport = (slug: string) => {
    setConfig((prev) => {
      const disabled = prev.disabledReports.includes(slug)
        ? prev.disabledReports.filter((s) => s !== slug)
        : [...prev.disabledReports, slug];
      return { ...prev, disabledReports: disabled };
    });
  };

  // ── POS component helpers ──────────────────────────────────
  const isPosComponentHidden = (slug: string): boolean => {
    return config.posHiddenComponents.includes(slug);
  };

  const togglePosComponent = (slug: string) => {
    setConfig((prev) => {
      const hidden = prev.posHiddenComponents.includes(slug)
        ? prev.posHiddenComponents.filter((s) => s !== slug)
        : [...prev.posHiddenComponents, slug];
      return { ...prev, posHiddenComponents: hidden };
    });
  };

  // ── Sidebar helpers ─────────────────────────────────────────
  const sidebarOrder: string[] =
    config.sidebarSectionOrder ?? [...SIDEBAR_SECTIONS];

  const moveSidebarSection = (index: number, direction: "up" | "down") => {
    const newOrder = [...sidebarOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[index],
    ];
    setConfig((prev) => ({ ...prev, sidebarSectionOrder: newOrder }));
  };

  const resetSidebarOrder = () => {
    setConfig((prev) => ({ ...prev, sidebarSectionOrder: null }));
  };

  // ── Mobile nav helpers ──────────────────────────────────────
  const activeMobileTabs: MobileNavTab[] =
    config.mobileNavTabs ?? [...DEFAULT_MOBILE_TABS];

  const isMobileTabEnabled = (key: string): boolean => {
    return activeMobileTabs.some((t) => t.key === key);
  };

  const toggleMobileTab = (tab: MobileNavTab) => {
    const current = [...activeMobileTabs];
    const existingIndex = current.findIndex((t) => t.key === tab.key);
    if (existingIndex >= 0) {
      // Removing — enforce min 2
      if (current.length <= 2) {
        toast.error(t("admin.minTabsRequired"));
        return;
      }
      current.splice(existingIndex, 1);
    } else {
      // Adding — enforce max 5
      if (current.length >= 5) {
        toast.error(t("admin.maxTabsAllowed"));
        return;
      }
      current.push(tab);
    }
    setConfig((prev) => ({ ...prev, mobileNavTabs: current }));
  };

  const moveMobileTab = (index: number, direction: "up" | "down") => {
    const current = [...activeMobileTabs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    [current[index], current[targetIndex]] = [
      current[targetIndex],
      current[index],
    ];
    setConfig((prev) => ({ ...prev, mobileNavTabs: current }));
  };

  const resetMobileTabs = () => {
    setConfig((prev) => ({ ...prev, mobileNavTabs: null }));
  };

  // ── Form toggle ─────────────────────────────────────────────
  const toggleFormExpanded = (formName: string) => {
    setExpandedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formName)) {
        next.delete(formName);
      } else {
        next.add(formName);
      }
      return next;
    });
  };

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════
          Section A: Form Field Configuration
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Form Field Configuration"
        description="Configure visible fields and default values for each form"
        icon={<FileText className="h-5 w-5 text-blue-600" />}
        defaultOpen
      >
        <div className="space-y-3">
          {(Object.keys(FORM_REGISTRY) as FormName[]).map((formName) => {
            const formDef = FORM_REGISTRY[formName] as { label: string; fields: Record<string, { label: string; type: string; required: boolean; canHide: boolean; perUser?: boolean; options?: readonly string[]; edition?: string }>; columns?: Record<string, ColumnDef> };
            const filteredFields = Object.entries(formDef.fields).filter(
              ([, fd]) => !fd.edition || fd.edition === edition
            );
            const isExpanded = expandedForms.has(formName);
            const hiddenCount =
              (config.fields[formName]?.hidden?.length ?? 0) +
              (config.fields[formName]?.hiddenColumns?.length ?? 0);

            return (
              <div
                key={formName}
                className="rounded-lg border bg-card"
              >
                {/* Form header */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => toggleFormExpanded(formName)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      {formDef.label}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {filteredFields.length} fields
                    </Badge>
                    {hiddenCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs text-orange-600 border-orange-300"
                      >
                        {hiddenCount} hidden
                      </Badge>
                    )}
                  </div>
                </button>

                {/* Form fields table */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">
                              Field Name
                            </TableHead>
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="w-[80px]">Hidden</TableHead>
                            <TableHead>Default Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFields.map(
                            ([fieldKey, fieldDef]) => {
                              const hidden = isFieldHidden(formName, fieldKey);
                              const needsDefault =
                                hidden && fieldDef.required;
                              const defaultVal = getFieldDefault(
                                formName,
                                fieldKey
                              );

                              return (
                                <TableRow
                                  key={fieldKey}
                                  className={
                                    needsDefault && !defaultVal
                                      ? "bg-amber-50 dark:bg-amber-950/20"
                                      : ""
                                  }
                                >
                                  {/* Field name */}
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">
                                        {fieldDef.label}
                                      </span>
                                      {fieldDef.required && (
                                        <span className="text-xs text-red-500">
                                          *
                                        </span>
                                      )}
                                      {needsDefault && !defaultVal && (
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Type badge */}
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-mono"
                                    >
                                      {fieldDef.type}
                                    </Badge>
                                  </TableCell>

                                  {/* Hidden toggle */}
                                  <TableCell>
                                    <Switch
                                      checked={hidden}
                                      onCheckedChange={() =>
                                        toggleFieldHidden(formName, fieldKey)
                                      }
                                      disabled={!fieldDef.canHide}
                                    />
                                  </TableCell>

                                  {/* Default value */}
                                  <TableCell>
                                    {fieldDef.type === "select" &&
                                    fieldDef.options ? (
                                      <Select
                                        value={
                                          defaultVal != null
                                            ? String(defaultVal)
                                            : ""
                                        }
                                        onValueChange={(val) =>
                                          setFieldDefault(
                                            formName,
                                            fieldKey,
                                            val
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-8 w-[180px]">
                                          <SelectValue placeholder="No default" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {fieldDef.options.map((opt: string) => (
                                            <SelectItem
                                              key={opt}
                                              value={opt}
                                            >
                                              {opt}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : fieldDef.type === "boolean" ? (
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={
                                            defaultVal === true ||
                                            defaultVal === "true"
                                          }
                                          onCheckedChange={(checked) =>
                                            setFieldDefault(
                                              formName,
                                              fieldKey,
                                              checked
                                            )
                                          }
                                        />
                                        <span className="text-xs text-muted-foreground">
                                          {defaultVal === true ||
                                          defaultVal === "true"
                                            ? "Yes"
                                            : "No"}
                                        </span>
                                      </div>
                                    ) : fieldDef.type === "entity" ? (
                                      <span className="text-xs text-muted-foreground italic">
                                        Set via user defaults
                                      </span>
                                    ) : (
                                      <Input
                                        type={
                                          fieldDef.type === "number"
                                            ? "number"
                                            : fieldDef.type === "date"
                                              ? "date"
                                              : "text"
                                        }
                                        className="h-8 w-[180px]"
                                        placeholder="No default"
                                        value={
                                          defaultVal != null
                                            ? String(defaultVal)
                                            : ""
                                        }
                                        onChange={(e) => {
                                          const val =
                                            fieldDef.type === "number"
                                              ? e.target.value === ""
                                                ? ""
                                                : Number(e.target.value)
                                              : e.target.value;
                                          setFieldDefault(
                                            formName,
                                            fieldKey,
                                            val as string | number
                                          );
                                        }}
                                      />
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Line Item Column Configuration */}
                    {formDef.columns && Object.keys(formDef.columns).length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Line Item Columns
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[180px]">Column</TableHead>
                              <TableHead className="w-[80px]">Hidden</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(formDef.columns).map(([colKey, colDef]) => (
                              <TableRow key={colKey}>
                                <TableCell>
                                  <span className="text-sm">{colDef.label}</span>
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={isColumnHiddenAdmin(formName, colKey)}
                                    onCheckedChange={() => toggleColumnHidden(formName, colKey)}
                                    disabled={!colDef.canHide}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          Section B: Report Configuration
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Report Configuration"
        description="Enable or disable reports for this organization"
        icon={<BarChart3 className="h-5 w-5 text-green-600" />}
      >
        <div className="space-y-6">
          {REPORT_CATEGORIES.map((category) => (
            <div key={category.label}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                {category.label}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.slugs.map((slug) => {
                  const disabled = isReportDisabled(slug);
                  return (
                    <div
                      key={slug}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <Label
                        htmlFor={`report-${slug}`}
                        className={`text-sm cursor-pointer ${
                          disabled
                            ? "text-muted-foreground line-through"
                            : ""
                        }`}
                      >
                        {REPORT_SLUG_LABELS[slug] ?? slug}
                      </Label>
                      <Switch
                        id={`report-${slug}`}
                        checked={!disabled}
                        onCheckedChange={() => toggleReport(slug)}
                      />
                    </div>
                  );
                })}
              </div>
              {category !==
                REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          Section B2: POS Component Visibility
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="POS Component Visibility"
        description="Show or hide individual POS terminal UI components"
        icon={<Monitor className="h-5 w-5 text-cyan-600" />}
      >
        <div className="space-y-6">
          {POS_COMPONENT_CATEGORIES.map((category) => (
            <div key={category.label}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                {category.label}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.items.map(({ slug, label }) => {
                  const hidden = isPosComponentHidden(slug);
                  return (
                    <div
                      key={slug}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <Label
                        htmlFor={`pos-${slug}`}
                        className={`text-sm cursor-pointer ${
                          hidden
                            ? "text-muted-foreground line-through"
                            : ""
                        }`}
                      >
                        {label}
                      </Label>
                      <Switch
                        id={`pos-${slug}`}
                        checked={!hidden}
                        onCheckedChange={() => togglePosComponent(slug)}
                      />
                    </div>
                  );
                })}
              </div>
              {category !==
                POS_COMPONENT_CATEGORIES[POS_COMPONENT_CATEGORIES.length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          Section C: Sidebar Configuration
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Sidebar Configuration"
        description="Control sidebar mode and section ordering"
        icon={<PanelLeft className="h-5 w-5 text-purple-600" />}
      >
        <div className="space-y-6">
          {/* Sidebar mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sidebar Mode</Label>
            <Select
              value={config.sidebarMode}
              onValueChange={(val: "full" | "hidden") =>
                setConfig((prev) => ({ ...prev, sidebarMode: val }))
              }
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Sidebar</SelectItem>
                <SelectItem value="hidden">
                  Hidden (POS-only mode)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Section order */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Sidebar Section Order
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSidebarOrder}
                className="text-xs h-7"
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Reset to Default Order
              </Button>
            </div>
            <div className="space-y-1">
              {sidebarOrder.map((section, index) => (
                <div
                  key={section}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-5 text-center">
                      {index + 1}
                    </span>
                    <span className="text-sm">
                      {SIDEBAR_SECTION_LABELS[section] ?? section}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={index === 0}
                      onClick={() => moveSidebarSection(index, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={index === sidebarOrder.length - 1}
                      onClick={() => moveSidebarSection(index, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Menu item visibility */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Menu Item Visibility
            </Label>
            <p className="text-xs text-muted-foreground">
              Disabled items will be hidden from the sidebar{isUserMode ? " for this user" : " for all users in this organization"}.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SIDEBAR_ITEMS.map((group) => (
                <div key={group.group} className="space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide border-b pb-1">
                    {group.group}
                  </h4>
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const disabled = isSidebarItemDisabled(item);
                      return (
                        <div
                          key={item}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <Label
                            htmlFor={`sidebar-${item}`}
                            className={`text-sm cursor-pointer ${
                              disabled
                                ? "text-muted-foreground line-through"
                                : ""
                            }`}
                          >
                            {item}
                          </Label>
                          <Switch
                            id={`sidebar-${item}`}
                            checked={!disabled}
                            onCheckedChange={() => toggleSidebarItem(item)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          Section D: Mobile Bottom Navigation
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Mobile Bottom Navigation"
        description="Configure which tabs appear in the mobile navigation bar (2-5 tabs)"
        icon={<Smartphone className="h-5 w-5 text-orange-600" />}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {activeMobileTabs.length} / 5 tabs enabled
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetMobileTabs}
              className="text-xs h-7"
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Reset to Default
            </Button>
          </div>

          {/* Enabled tabs with reorder */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Active Tabs (drag order)
            </Label>
            {activeMobileTabs.map((tab, index) => (
              <div
                key={tab.key}
                className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-5 text-center">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{tab.key}</span>
                  <span className="text-xs text-muted-foreground">
                    {tab.href}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === 0}
                    onClick={() => moveMobileTab(index, "up")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === activeMobileTabs.length - 1}
                    onClick={() => moveMobileTab(index, "down")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => toggleMobileTab(tab)}
                    disabled={activeMobileTabs.length <= 2}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Available tabs pool */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Available Tabs
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOBILE_NAV_TAB_POOL.map((tab) => {
                const enabled = isMobileTabEnabled(tab.key);
                return (
                  <div
                    key={tab.key}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                      enabled ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{tab.key}</span>
                      <span className="text-xs text-muted-foreground">
                        {tab.href}
                      </span>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleMobileTab(tab)}
                      disabled={
                        enabled
                          ? activeMobileTabs.length <= 2
                          : activeMobileTabs.length >= 5
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          Section E: Default Landing Page
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Default Landing Page"
        description="Set the page users see after logging in"
        icon={<Home className="h-5 w-5 text-teal-600" />}
      >
        <div className="flex items-center gap-3">
          <Select
            value={config.defaultLandingPage ?? ""}
            onValueChange={(val) =>
              setConfig((prev) => ({
                ...prev,
                defaultLandingPage: val || null,
              }))
            }
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Default (Dashboard)" />
            </SelectTrigger>
            <SelectContent>
              {LANDING_PAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setConfig((prev) => ({ ...prev, defaultLandingPage: null }))
            }
            className="text-xs"
          >
            Clear
          </Button>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          Save / User-mode actions
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          {isUserMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyFromOrg}
                disabled={!orgConfig}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Copy from Org
              </Button>
              {hasUserOverrides && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResetToOrg}
                  disabled={resetting}
                >
                  {resetting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Reset to Org Defaults
                </Button>
              )}
            </>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
