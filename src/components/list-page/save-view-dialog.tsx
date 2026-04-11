"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useComboboxEntities } from "@/hooks/use-combobox-entities";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Trash2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdvancedSearchField,
  ComboboxField,
} from "@/types/advanced-search";
import type { CustomViewData } from "@/components/list-page/views-dropdown";

// ---------- configs registry for field lookup ----------
import { INVOICE_SEARCH_FIELDS, PURCHASE_INVOICE_SEARCH_FIELDS, QUOTATION_SEARCH_FIELDS, CREDIT_NOTE_SEARCH_FIELDS, DEBIT_NOTE_SEARCH_FIELDS, PAYMENT_SEARCH_FIELDS, SUPPLIER_PAYMENT_SEARCH_FIELDS, EXPENSE_SEARCH_FIELDS, JOURNAL_ENTRY_SEARCH_FIELDS } from "@/lib/advanced-search-configs";

const SEARCH_FIELDS_BY_MODULE: Record<string, AdvancedSearchField[]> = {
  invoices: INVOICE_SEARCH_FIELDS,
  "purchase-invoices": PURCHASE_INVOICE_SEARCH_FIELDS,
  quotations: QUOTATION_SEARCH_FIELDS,
  "credit-notes": CREDIT_NOTE_SEARCH_FIELDS,
  "debit-notes": DEBIT_NOTE_SEARCH_FIELDS,
  payments: PAYMENT_SEARCH_FIELDS,
  "supplier-payments": SUPPLIER_PAYMENT_SEARCH_FIELDS,
  expenses: EXPENSE_SEARCH_FIELDS,
  "journal-entries": JOURNAL_ENTRY_SEARCH_FIELDS,
};

// ---------- Comparators by field type ----------
function getComparators(fieldType: AdvancedSearchField["type"], t: (k: string) => string) {
  switch (fieldType) {
    case "text":
      return [
        { value: "is", label: t("views.is") || "is" },
        { value: "contains", label: t("views.contains") || "contains" },
        { value: "is_empty", label: t("views.isEmpty") || "is empty" },
      ];
    case "select":
      return [
        { value: "is", label: t("views.is") || "is" },
      ];
    case "combobox":
      return [
        { value: "is", label: t("views.is") || "is" },
      ];
    case "dateRange":
      return [
        { value: "is", label: t("views.is") || "is" },
        { value: "after", label: t("views.after") || "after" },
        { value: "before", label: t("views.before") || "before" },
        { value: "between", label: t("views.between") || "between" },
        { value: "is_empty", label: t("views.isEmpty") || "is empty" },
      ];
    case "numberRange":
      return [
        { value: "is", label: t("views.is") || "is" },
        { value: "greater_than", label: t("views.greaterThan") || "greater than" },
        { value: "less_than", label: t("views.lessThan") || "less than" },
        { value: "between", label: t("views.between") || "between" },
        { value: "is_empty", label: t("views.isEmpty") || "is empty" },
      ];
    default:
      return [{ value: "is", label: "is" }];
  }
}

// ---------- Criterion type ----------
interface Criterion {
  id: string;
  fieldKey: string;
  comparator: string;
  value: string;
  valueTo?: string; // for "between" comparator
}

let _criterionId = 0;
function newCriterion(): Criterion {
  return { id: `c_${Date.now()}_${++_criterionId}`, fieldKey: "", comparator: "", value: "" };
}

// Convert criteria rows to flat filter params for the API
function criteriaToFilters(criteria: Criterion[], fields: AdvancedSearchField[]): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const c of criteria) {
    if (!c.fieldKey || !c.comparator) continue;
    const field = fields.find((f) => f.key === c.fieldKey);
    if (!field) continue;

    if (c.comparator === "is_empty") {
      // Skip — no value needed, API handles empty filter logic
      continue;
    }

    if (c.comparator === "between" && (field.type === "dateRange" || field.type === "numberRange")) {
      const fromKey = field.type === "dateRange" ? field.fromKey : field.fromKey;
      const toKey = field.type === "dateRange" ? field.toKey : field.toKey;
      if (c.value) filters[fromKey] = c.value;
      if (c.valueTo) filters[toKey] = c.valueTo;
    } else if (field.type === "dateRange") {
      // For "is", "after", "before" on date fields
      if (c.comparator === "is") {
        filters[field.fromKey] = c.value;
        filters[field.toKey] = c.value;
      } else if (c.comparator === "after") {
        filters[field.fromKey] = c.value;
      } else if (c.comparator === "before") {
        filters[field.toKey] = c.value;
      }
    } else if (field.type === "numberRange") {
      if (c.comparator === "is") {
        filters[field.fromKey] = c.value;
        filters[field.toKey] = c.value;
      } else if (c.comparator === "greater_than") {
        filters[field.fromKey] = c.value;
      } else if (c.comparator === "less_than") {
        filters[field.toKey] = c.value;
      }
    } else {
      // text, select, combobox — simple key=value
      if (c.value) filters[field.key] = c.value;
    }
  }
  return filters;
}

// Convert flat filter params back to criteria rows (for editing existing views)
function filtersToCriteria(filters: Record<string, string>, fields: AdvancedSearchField[]): Criterion[] {
  const criteria: Criterion[] = [];
  const used = new Set<string>();

  for (const field of fields) {
    if (field.type === "dateRange" || field.type === "numberRange") {
      const fromKey = field.fromKey;
      const toKey = field.toKey;
      const hasFrom = filters[fromKey];
      const hasTo = filters[toKey];
      if (hasFrom && hasTo && hasFrom === hasTo) {
        criteria.push({ id: `c_${Date.now()}_${++_criterionId}`, fieldKey: field.key, comparator: "is", value: hasFrom });
        used.add(fromKey);
        used.add(toKey);
      } else if (hasFrom && hasTo) {
        criteria.push({ id: `c_${Date.now()}_${++_criterionId}`, fieldKey: field.key, comparator: "between", value: hasFrom, valueTo: hasTo });
        used.add(fromKey);
        used.add(toKey);
      } else if (hasFrom) {
        criteria.push({ id: `c_${Date.now()}_${++_criterionId}`, fieldKey: field.key, comparator: field.type === "dateRange" ? "after" : "greater_than", value: hasFrom });
        used.add(fromKey);
      } else if (hasTo) {
        criteria.push({ id: `c_${Date.now()}_${++_criterionId}`, fieldKey: field.key, comparator: field.type === "dateRange" ? "before" : "less_than", value: hasTo });
        used.add(toKey);
      }
    } else {
      if (filters[field.key]) {
        criteria.push({ id: `c_${Date.now()}_${++_criterionId}`, fieldKey: field.key, comparator: "is", value: filters[field.key] });
        used.add(field.key);
      }
    }
  }

  return criteria.length > 0 ? criteria : [newCriterion()];
}

// ---------- Combobox value renderer ----------
function ComboboxValueInput({ field, value, onChange }: { field: ComboboxField; value: string; onChange: (v: string) => void }) {
  const { items } = useComboboxEntities(field.entityUrl, true);
  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={onChange}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      filterFn={(item, query) => item.name.toLowerCase().includes(query.toLowerCase())}
      placeholder="Select..."
      emptyText="No results"
      autoOpenOnFocus={false}
    />
  );
}

// ---------- Value input per field+comparator ----------
function ValueInput({ field, comparator, value, valueTo, onChange, onChangeTo }: {
  field: AdvancedSearchField;
  comparator: string;
  value: string;
  valueTo?: string;
  onChange: (v: string) => void;
  onChangeTo: (v: string) => void;
}) {
  if (comparator === "is_empty") return null;

  if (field.type === "select") {
    return (
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" disabled>Select...</SelectItem>
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "combobox") {
    return <ComboboxValueInput field={field} value={value} onChange={onChange} />;
  }

  if (field.type === "dateRange") {
    if (comparator === "between") {
      return (
        <div className="flex items-center gap-1.5">
          <DateInput value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-9 text-sm" />
          <span className="text-xs text-slate-400">-</span>
          <DateInput value={valueTo || ""} onChange={(e) => onChangeTo(e.target.value)} className="flex-1 h-9 text-sm" />
        </div>
      );
    }
    return <DateInput value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />;
  }

  if (field.type === "numberRange") {
    if (comparator === "between") {
      return (
        <div className="flex items-center gap-1.5">
          <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Min" className="flex-1 h-9 text-sm" />
          <span className="text-xs text-slate-400">-</span>
          <Input type="number" value={valueTo || ""} onChange={(e) => onChangeTo(e.target.value)} placeholder="Max" className="flex-1 h-9 text-sm" />
        </div>
      );
    }
    return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter value" className="h-9 text-sm" />;
  }

  // text
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter value" className="h-9 text-sm" />;
}

// ==================== MAIN COMPONENT ====================

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: string;
  /** Current filter state (used to pre-populate criteria when creating new view) */
  filters: Record<string, string>;
  sortField?: string | null;
  sortDirection?: string | null;
  /** Called after successful save */
  onSaved: () => void;
  /** If provided, we're editing an existing view */
  editingView?: CustomViewData;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  module,
  filters,
  sortField,
  sortDirection,
  onSaved,
  editingView,
}: SaveViewDialogProps) {
  const { t } = useLanguage();
  const fields = SEARCH_FIELDS_BY_MODULE[module] || [];

  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([newCriterion()]);
  const [saving, setSaving] = useState(false);

  // Initialize form when sheet opens
  useEffect(() => {
    if (!open) return;
    if (editingView) {
      setName(editingView.name);
      setIsDefault(editingView.isDefault);
      setCriteria(filtersToCriteria(editingView.filters, fields));
    } else {
      setName("");
      setIsDefault(false);
      // Pre-populate from current active filters
      const hasFilters = Object.keys(filters).filter((k) => !k.startsWith("_") && filters[k]).length > 0;
      setCriteria(hasFilters ? filtersToCriteria(filters, fields) : [newCriterion()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateCriterion = (id: string, patch: Partial<Criterion>) => {
    setCriteria((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        // Reset value when field or comparator changes
        if (patch.fieldKey !== undefined) {
          updated.comparator = "";
          updated.value = "";
          updated.valueTo = "";
        }
        if (patch.comparator !== undefined && patch.comparator !== c.comparator) {
          updated.value = "";
          updated.valueTo = "";
        }
        return updated;
      })
    );
  };

  const addCriterion = () => {
    setCriteria((prev) => [...prev, newCriterion()]);
  };

  const removeCriterion = (id: string) => {
    setCriteria((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.length === 0 ? [newCriterion()] : next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const builtFilters = criteriaToFilters(criteria, fields);
      const url = editingView ? `/api/custom-views/${editingView.id}` : "/api/custom-views";
      const method = editingView ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          module,
          filters: builtFilters,
          sortField: sortField || null,
          sortDirection: sortDirection || null,
          isDefault,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      toast.success(t("views.viewSaved"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingView) return;
    try {
      const res = await fetch(`/api/custom-views/${editingView.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("views.viewDeleted"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto p-6" side="right">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">{editingView ? t("views.editCustomView") || "Edit Custom View" : t("views.newCustomView")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Name + Default */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-red-600">
                {t("views.viewName")} <span>*</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("views.viewNamePlaceholder")}
                  autoFocus
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setIsDefault(!isDefault)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                    isDefault ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                  title={isDefault ? t("views.removeDefault") : t("views.setAsDefault")}
                >
                  <Star className={cn("h-4 w-4", isDefault && "fill-amber-400 text-amber-400")} />
                  {isDefault ? t("views.removeDefault") || "Default" : t("views.setAsDefault")}
                </button>
              </div>
            </div>
          </div>

          {/* Criteria Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {t("views.defineCriteria") || "Define the criteria (if any)"}
            </h3>

            <div className="space-y-2">
              {criteria.map((criterion, idx) => {
                const selectedField = fields.find((f) => f.key === criterion.fieldKey);
                const comparators = selectedField ? getComparators(selectedField.type, t) : [];

                return (
                  <div key={criterion.id}>
                    {idx > 0 && (
                      <div className="flex items-center gap-2 py-1">
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-[11px] font-semibold uppercase text-slate-400">AND</span>
                        <div className="h-px flex-1 bg-slate-100" />
                      </div>
                    )}
                    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                      <span className="mt-2 text-xs font-medium text-slate-400 w-4 shrink-0">{idx + 1}</span>

                      {/* Field selector */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={criterion.fieldKey || "__none__"}
                            onValueChange={(v) => updateCriterion(criterion.id, { fieldKey: v === "__none__" ? "" : v })}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={t("views.selectField") || "Select a field"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" disabled>{t("views.selectField") || "Select a field"}</SelectItem>
                              {fields.map((f) => (
                                <SelectItem key={f.key} value={f.key}>{t(f.labelKey)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Comparator selector */}
                          <Select
                            value={criterion.comparator || "__none__"}
                            onValueChange={(v) => updateCriterion(criterion.id, { comparator: v === "__none__" ? "" : v })}
                            disabled={!selectedField}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={t("views.selectComparator") || "Select comparator"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" disabled>{t("views.selectComparator") || "Select comparator"}</SelectItem>
                              {comparators.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Value input */}
                        {selectedField && criterion.comparator && criterion.comparator !== "is_empty" && (
                          <ValueInput
                            field={selectedField}
                            comparator={criterion.comparator}
                            value={criterion.value}
                            valueTo={criterion.valueTo}
                            onChange={(v) => updateCriterion(criterion.id, { value: v })}
                            onChangeTo={(v) => updateCriterion(criterion.id, { valueTo: v })}
                          />
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeCriterion(criterion.id)}
                        className="mt-1.5 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addCriterion}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("views.addCriterion") || "Add Criterion"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="mt-8 flex-row gap-2">
          {editingView && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
