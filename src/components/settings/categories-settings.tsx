"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Pencil, XCircle, Tag } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    products: number;
  };
}

export function CategoriesSettings() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6366f1",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/product-categories?includeInactive=true");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      toast.error(t("categories.loadFailed"));
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const payload = {
      name: formData.name,
      color: formData.color,
    };

    try {
      const response = editingCategory
        ? await fetch(`/api/product-categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        : await fetch("/api/product-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
      toast.success(editingCategory ? t("categories.updated") : t("categories.added"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category");
      console.error("Failed to save category:", error);
    }
  };

  const handleEdit = (category: ProductCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      color: category.color || "#6366f1",
    });
    setIsDialogOpen(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm(t("categories.deactivateConfirm"))) return;

    try {
      const response = await fetch(`/api/product-categories/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to deactivate");
      fetchCategories();
      toast.success(t("categories.deactivated"));
    } catch (error) {
      toast.error(t("categories.deactivateFailed"));
      console.error("Failed to deactivate category:", error);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const response = await fetch(`/api/product-categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) throw new Error("Failed to activate");
      fetchCategories();
      toast.success(t("categories.activated"));
    } catch (error) {
      toast.error(t("categories.activateFailed"));
      console.error("Failed to activate category:", error);
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      color: "#6366f1",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("categories.addCategory")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form className="contents" onSubmit={handleSubmit}>
              <DialogHeader className="pr-12">
                <DialogTitle>
                  {editingCategory ? t("categories.editCategory") : t("categories.addNewCategory")}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory
                    ? t("categories.editDesc")
                    : t("categories.addDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2 sm:py-4">
                <div className="grid gap-2">
                  <Label htmlFor="cat-settings-name">{t("common.nameRequired")}</Label>
                  <Input
                    id="cat-settings-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t("categories.namePlaceholder")}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    {t("categories.nameDescription")}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cat-settings-color">{t("categories.colorLabel")}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="cat-settings-color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                    />
                    <span className="text-sm text-slate-500">{formData.color}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {t("categories.colorDescription")}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingCategory ? t("categories.updateCategory") : t("categories.addCategory")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600">
            {t("categories.categoriesDescription")}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={5} rows={5} />
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Tag className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">{t("categories.noCategoriesFoundList")}</h3>
              <p className="text-sm text-slate-500">
                {t("categories.noCategoriesHint")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("categories.colorLabel")}</TableHead>
                  <TableHead>{t("common.products")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">
                      {cat.name}
                    </TableCell>
                    <TableCell>
                      <div
                        className="h-6 w-6 rounded-full border border-slate-200"
                        style={{ backgroundColor: cat.color || "#6366f1" }}
                      />
                    </TableCell>
                    <TableCell>
                      {cat._count?.products || 0} product(s)
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cat.isActive ? "default" : "secondary"}
                      >
                        {cat.isActive ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {cat.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(cat.id)}
                        >
                          <XCircle className="h-4 w-4 text-orange-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleActivate(cat.id)}
                          title={t("categories.activateCategory")}
                        >
                          <Plus className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
