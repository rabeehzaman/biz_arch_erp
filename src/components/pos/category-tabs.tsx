"use client";

import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface CategoryTabsProps {
  categories: Category[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          selected === null
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-100 border"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors border",
            selected === cat.id
              ? "text-white border-transparent"
              : "bg-white text-slate-600 hover:bg-slate-100"
          )}
          style={
            selected === cat.id
              ? { backgroundColor: cat.color || "#6366f1" }
              : undefined
          }
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
