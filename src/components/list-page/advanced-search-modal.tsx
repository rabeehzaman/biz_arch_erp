"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type {
  AdvancedSearchField,
  AdvancedSearchValues,
  ComboboxField,
} from "@/types/advanced-search";

interface AdvancedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: AdvancedSearchField[];
  values: AdvancedSearchValues;
  onSearch: (values: AdvancedSearchValues) => void;
  onReset: () => void;
  title?: string;
}

function ComboboxFieldRenderer({
  field,
  value,
  onChange,
  enabled,
}: {
  field: ComboboxField;
  value: string;
  onChange: (val: string) => void;
  enabled: boolean;
}) {
  const { items } = useComboboxEntities(field.entityUrl, enabled);
  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={onChange}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      filterFn={(item, query) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      }
      placeholder="Select..."
      emptyText="No results"
      autoOpenOnFocus={false}
    />
  );
}

export function AdvancedSearchModal({
  open,
  onOpenChange,
  fields,
  values,
  onSearch,
  onReset,
  title,
}: AdvancedSearchModalProps) {
  const { t } = useLanguage();
  const [localValues, setLocalValues] = useState<AdvancedSearchValues>({});

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setLocalValues({ ...values });
    }
  }, [open, values]);

  const setValue = (key: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSearch = () => {
    // Remove empty values
    const cleaned: AdvancedSearchValues = {};
    Object.entries(localValues).forEach(([k, v]) => {
      if (v && v.trim()) cleaned[k] = v.trim();
    });
    onSearch(cleaned);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalValues({});
    onReset();
    onOpenChange(false);
  };

  const activeCount = useMemo(
    () => Object.values(values).filter((v) => v && v.trim()).length,
    [values]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {title || t("common.advancedSearch") || "Advanced Search"}
            {activeCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white">
                {activeCount}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              localValues={localValues}
              setValue={setValue}
              modalOpen={open}
              t={t}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleReset} type="button">
            {t("common.reset") || "Reset"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSearch} type="button">
            {t("common.search") || "Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRenderer({
  field,
  localValues,
  setValue,
  modalOpen,
  t,
}: {
  field: AdvancedSearchField;
  localValues: AdvancedSearchValues;
  setValue: (key: string, val: string) => void;
  modalOpen: boolean;
  t: (key: string) => string;
}) {
  const label = t(field.labelKey) || field.key;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <Input
            value={localValues[field.key] || ""}
            onChange={(e) => setValue(field.key, e.target.value)}
            placeholder={label}
          />
        </div>
      );

    case "dateRange":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <div className="flex items-center gap-2">
            <DateInput
              value={localValues[field.fromKey] || ""}
              onChange={(e) => setValue(field.fromKey, e.target.value)}
              className="flex-1"
            />
            <span className="text-xs text-slate-400">-</span>
            <DateInput
              value={localValues[field.toKey] || ""}
              onChange={(e) => setValue(field.toKey, e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      );

    case "numberRange":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={localValues[field.fromKey] || ""}
              onChange={(e) => setValue(field.fromKey, e.target.value)}
              placeholder={t("common.minimum") || "Min"}
              className="flex-1"
            />
            <span className="text-xs text-slate-400">-</span>
            <Input
              type="number"
              value={localValues[field.toKey] || ""}
              onChange={(e) => setValue(field.toKey, e.target.value)}
              placeholder={t("common.maximum") || "Max"}
              className="flex-1"
            />
          </div>
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <Select
            value={localValues[field.key] || "__all__"}
            onValueChange={(val) => setValue(field.key, val === "__all__" ? "" : val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.all") || "All"}</SelectItem>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey) || opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "combobox":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <ComboboxFieldRenderer
            field={field}
            value={localValues[field.key] || ""}
            onChange={(val) => setValue(field.key, val)}
            enabled={modalOpen}
          />
        </div>
      );

    default:
      return null;
  }
}

export { type AdvancedSearchValues };
