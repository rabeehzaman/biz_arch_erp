"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function CategorySelect({
  value,
  onValueChange,
  label,
  className,
}: CategorySelectProps) {
  const { t } = useLanguage();
  const displayLabel = label ?? t("products.category");
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/product-categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div className={`grid gap-2 ${className || ""}`}>
      {displayLabel && <Label htmlFor="category">{displayLabel}</Label>}
      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger id="category" className="w-full min-w-0">
          <SelectValue placeholder={loading ? t("common.loading") : t("products.selectCategory")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("common.none")}</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
