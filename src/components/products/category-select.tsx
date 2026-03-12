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
  label = "Category",
  className,
}: CategorySelectProps) {
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
      {label && <Label htmlFor="category">{label}</Label>}
      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger id="category" className="w-full min-w-0">
          <SelectValue placeholder={loading ? "Loading..." : "Select a category"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
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
