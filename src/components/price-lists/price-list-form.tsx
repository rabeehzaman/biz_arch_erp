"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useEdition } from "@/hooks/use-edition";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { PriceListLineItems, type PriceListLineItem } from "./price-list-line-items";
import { PriceListAssignments, type SimpleEntity } from "./price-list-assignments";

interface CompactProduct {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  barcode?: string;
}

interface PriceListFormProps {
  priceListId?: string;
  duplicateId?: string;
}

let nextItemId = 1;
function genId() {
  return `new_${nextItemId++}`;
}

export function PriceListForm({ priceListId, duplicateId }: PriceListFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { data: session } = useSession();
  const { config: editionConfig } = useEdition();
  const currencySymbol = editionConfig?.currencySymbol ?? "\u20B9";
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();

  const isEditMode = !!priceListId;
  const saveAndNew = useRef(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    defaultDiscountPercent: 0,
    isActive: true,
  });
  const [lineItems, setLineItems] = useState<PriceListLineItem[]>([
    { id: genId(), productId: "", overrideType: "FIXED", fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false },
  ]);
  const [assignedUsers, setAssignedUsers] = useState<SimpleEntity[]>([]);
  const [assignedCustomers, setAssignedCustomers] = useState<SimpleEntity[]>([]);
  const [products, setProducts] = useState<CompactProduct[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleEntity[]>([]);
  const [allCustomers, setAllCustomers] = useState<SimpleEntity[]>([]);
  const [isLoading, setIsLoading] = useState(!!priceListId || !!duplicateId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Track original items for edit diffing
  const originalItems = useRef<PriceListLineItem[]>([]);
  const originalAssignedUserIds = useRef<Set<string>>(new Set());
  const originalAssignedCustomerIds = useRef<Set<string>>(new Set());

  useUnsavedChanges(isDirty);

  // Fetch products, users, customers
  useEffect(() => {
    fetch("/api/products?compact=true")
      .then((r) => r.json())
      .then((data) => {
        setProducts(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: Number(p.basePrice ?? p.price),
            barcode: p.barcode,
          }))
        );
      })
      .catch(() => {});
    fetch("/api/users").then((r) => r.json()).then(setAllUsers).catch(() => {});
    fetch("/api/customers?compact=true")
      .then((r) => r.json())
      .then((data) => setAllCustomers(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => {});
  }, []);

  // Load existing price list (edit or duplicate)
  const loadId = priceListId || duplicateId;
  useEffect(() => {
    if (!loadId) return;
    (async () => {
      try {
        const res = await fetch(`/api/price-lists/${loadId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        setFormData({
          name: duplicateId ? `${data.name} (Copy)` : data.name,
          description: data.description || "",
          defaultDiscountPercent: Number(data.defaultDiscountPercent),
          isActive: duplicateId ? true : data.isActive,
        });

        // Load items
        const itemsRes = await fetch(`/api/price-lists/${loadId}/items`);
        const itemsData = itemsRes.ok ? await itemsRes.json() : [];
        const loadedItems: PriceListLineItem[] = itemsData.map((i: any) => ({
          id: duplicateId ? genId() : i.id,
          productId: i.productId,
          overrideType: i.overrideType as "FIXED" | "PERCENTAGE",
          fixedPrice: i.fixedPrice !== null ? Number(i.fixedPrice) : null,
          percentOffset: i.percentOffset !== null ? Number(i.percentOffset) : null,
          isNew: !!duplicateId,
          isDeleted: false,
          product: {
            id: i.product.id,
            name: i.product.name,
            sku: i.product.sku,
            price: Number(i.product.price),
          },
        }));

        // Add an empty row at the end
        loadedItems.push({
          id: genId(), productId: "", overrideType: "FIXED", fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false,
        });
        setLineItems(loadedItems);

        if (!duplicateId) {
          originalItems.current = loadedItems.filter((i) => i.productId);
        }

        // Load assignments
        const users = (data.assignments || [])
          .filter((a: any) => a.user)
          .map((a: any) => ({ id: a.user.id, name: a.user.name }));
        const customers = (data.assignments || [])
          .filter((a: any) => a.customer)
          .map((a: any) => ({ id: a.customer.id, name: a.customer.name }));
        setAssignedUsers(users);
        setAssignedCustomers(customers);

        if (!duplicateId) {
          originalAssignedUserIds.current = new Set(users.map((u: SimpleEntity) => u.id));
          originalAssignedCustomerIds.current = new Set(customers.map((c: SimpleEntity) => c.id));
        }
      } catch {
        toast.error(t("priceLists.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadId, duplicateId, t]);

  // Line item handlers
  const handleAddItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      { id: genId(), productId: "", overrideType: "FIXED", fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false },
    ]);
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDeleted: true } : item
      )
    );
    setIsDirty(true);
  }, []);

  const handleUpdateItem = useCallback((id: string, field: string, value: string | number | null) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
    setIsDirty(true);
  }, []);

  const handleProductSelect = useCallback((itemId: string, productId: string) => {
    // Check for duplicate
    const existingProductIds = new Set(
      lineItems.filter((i) => !i.isDeleted && i.productId && i.id !== itemId).map((i) => i.productId)
    );
    if (existingProductIds.has(productId)) {
      toast.error(t("priceLists.productAlreadyAdded"));
      return;
    }

    const product = products.find((p) => p.id === productId);
    setLineItems((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId,
              fixedPrice: product?.price ?? 0,
              percentOffset: null,
              overrideType: "FIXED" as const,
              product: product ? { id: product.id, name: product.name, sku: product.sku ?? null, price: product.price } : undefined,
            }
          : item
      );

      // Auto-add empty row if last visible item now has a product
      const visible = updated.filter((i) => !i.isDeleted);
      const lastVisible = visible[visible.length - 1];
      if (lastVisible && lastVisible.productId) {
        updated.push({
          id: genId(), productId: "", overrideType: "FIXED", fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false,
        });
      }
      return updated;
    });
    setIsDirty(true);
  }, [lineItems, products, t]);

  const handleBulkAdd = useCallback((percentOffset: number) => {
    const existingProductIds = new Set(
      lineItems.filter((i) => !i.isDeleted && i.productId).map((i) => i.productId)
    );
    const newProducts = products.filter((p) => !existingProductIds.has(p.id));
    if (newProducts.length === 0) {
      toast.info(t("priceLists.noProducts"));
      return;
    }

    const newItems: PriceListLineItem[] = newProducts.map((p) => ({
      id: genId(),
      productId: p.id,
      overrideType: "PERCENTAGE" as const,
      fixedPrice: null,
      percentOffset,
      isNew: true,
      isDeleted: false,
      product: { id: p.id, name: p.name, sku: p.sku ?? null, price: p.price },
    }));

    setLineItems((prev) => {
      // Remove trailing empty row, add new items, then add empty row
      const withoutTrailingEmpty = prev.filter((i) => i.productId || i.isDeleted);
      return [
        ...withoutTrailingEmpty,
        ...newItems,
        { id: genId(), productId: "", overrideType: "FIXED", fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false },
      ];
    });
    toast.success(`Added ${newProducts.length} products`);
    setIsDirty(true);
  }, [lineItems, products, t]);

  const handleRemoveAll = useCallback(() => {
    if (!confirm(t("priceLists.removeAllConfirm"))) return;
    setLineItems((prev) => [
      ...prev.map((item) => (item.productId ? { ...item, isDeleted: true } : item)),
      { id: genId(), productId: "", overrideType: "FIXED" as const, fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false },
    ]);
    setIsDirty(true);
  }, [t]);

  // Assignment handlers
  const handleAssignUser = useCallback((userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (user && !assignedUsers.some((u) => u.id === userId)) {
      setAssignedUsers((prev) => [...prev, user]);
      setIsDirty(true);
    }
  }, [allUsers, assignedUsers]);

  const handleUnassignUser = useCallback((userId: string) => {
    setAssignedUsers((prev) => prev.filter((u) => u.id !== userId));
    setIsDirty(true);
  }, []);

  const handleAssignCustomer = useCallback((customerId: string) => {
    const customer = allCustomers.find((c) => c.id === customerId);
    if (customer && !assignedCustomers.some((c) => c.id === customerId)) {
      setAssignedCustomers((prev) => [...prev, customer]);
      setIsDirty(true);
    }
  }, [allCustomers, assignedCustomers]);

  const handleUnassignCustomer = useCallback((customerId: string) => {
    setAssignedCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setIsDirty(true);
  }, []);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = lineItems.filter((i) => !i.isDeleted && i.productId);
    if (!formData.name.trim()) {
      toast.error(t("common.requiredField"));
      return;
    }

    setIsSubmitting(true);
    try {
      let plId = priceListId;

      if (isEditMode) {
        // Update header
        const res = await fetch(`/api/price-lists/${plId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            defaultDiscountPercent: formData.defaultDiscountPercent,
            isActive: formData.isActive,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update");
        }

        // Diff items
        const originalIds = new Set(originalItems.current.map((i) => i.id));
        const currentValid = lineItems.filter((i) => i.productId);

        // Items to delete (in original but now isDeleted or missing)
        const toDelete = originalItems.current.filter(
          (orig) => !currentValid.some((c) => c.id === orig.id && !c.isDeleted)
        );
        // Items to create (isNew and has product)
        const toCreate = currentValid.filter((i) => i.isNew && !i.isDeleted);
        // Items to update (not new, not deleted, exists in original)
        const toUpdate = currentValid.filter(
          (i) => !i.isNew && !i.isDeleted && originalIds.has(i.id)
        );

        await Promise.all(
          toDelete.map((item) =>
            fetch(`/api/price-lists/${plId}/items/${item.id}`, { method: "DELETE" })
          )
        );

        if (toCreate.length > 0) {
          await fetch(`/api/price-lists/${plId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              toCreate.map((i) => ({
                productId: i.productId,
                overrideType: i.overrideType,
                fixedPrice: i.overrideType === "FIXED" ? i.fixedPrice : undefined,
                percentOffset: i.overrideType === "PERCENTAGE" ? i.percentOffset : undefined,
              }))
            ),
          });
        }

        await Promise.all(
          toUpdate.map((item) =>
            fetch(`/api/price-lists/${plId}/items/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                overrideType: item.overrideType,
                fixedPrice: item.overrideType === "FIXED" ? item.fixedPrice : undefined,
                percentOffset: item.overrideType === "PERCENTAGE" ? item.percentOffset : undefined,
              }),
            })
          )
        );

        // Diff assignments
        const currentUserIds = new Set(assignedUsers.map((u) => u.id));
        const currentCustomerIds = new Set(assignedCustomers.map((c) => c.id));

        // Remove users no longer assigned
        for (const userId of originalAssignedUserIds.current) {
          if (!currentUserIds.has(userId)) {
            await fetch(`/api/price-lists/${plId}/assign`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
          }
        }
        // Add new user assignments
        for (const userId of currentUserIds) {
          if (!originalAssignedUserIds.current.has(userId)) {
            await fetch(`/api/price-lists/${plId}/assign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
          }
        }
        // Remove customers no longer assigned
        for (const customerId of originalAssignedCustomerIds.current) {
          if (!currentCustomerIds.has(customerId)) {
            await fetch(`/api/price-lists/${plId}/assign`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customerId }),
            });
          }
        }
        // Add new customer assignments
        for (const customerId of currentCustomerIds) {
          if (!originalAssignedCustomerIds.current.has(customerId)) {
            await fetch(`/api/price-lists/${plId}/assign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customerId }),
            });
          }
        }

        toast.success(t("priceLists.updated"));
      } else {
        // Create new
        const res = await fetch("/api/price-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            defaultDiscountPercent: formData.defaultDiscountPercent,
            isActive: formData.isActive,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create");
        }
        const created = await res.json();
        plId = created.id;

        // Add items
        if (validItems.length > 0) {
          await fetch(`/api/price-lists/${plId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              validItems.map((i) => ({
                productId: i.productId,
                overrideType: i.overrideType,
                fixedPrice: i.overrideType === "FIXED" ? i.fixedPrice : undefined,
                percentOffset: i.overrideType === "PERCENTAGE" ? i.percentOffset : undefined,
              }))
            ),
          });
        }

        // Add assignments
        for (const user of assignedUsers) {
          await fetch(`/api/price-lists/${plId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          });
        }
        for (const customer of assignedCustomers) {
          await fetch(`/api/price-lists/${plId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId: customer.id }),
          });
        }

        toast.success(t("priceLists.created"));
      }

      setIsDirty(false);
      if (saveAndNew.current) {
        saveAndNew.current = false;
        // Reset form
        setFormData({ name: "", description: "", defaultDiscountPercent: 0, isActive: true });
        setLineItems([
          { id: genId(), productId: "", overrideType: "FIXED", fixedPrice: null, percentOffset: null, isNew: true, isDeleted: false },
        ]);
        setAssignedUsers([]);
        setAssignedCustomers([]);
        originalItems.current = [];
        originalAssignedUserIds.current = new Set();
        originalAssignedCustomerIds.current = new Set();
      } else {
        router.push(`/price-lists/${plId}`);
      }
    } catch (err: any) {
      toast.error(err.message || t("priceLists.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageAnimation>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </PageAnimation>
    );
  }

  const canSubmit = formData.name.trim().length > 0 && !isSubmitting;

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/price-lists">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {isEditMode ? t("priceLists.editPriceList") : duplicateId ? t("priceLists.duplicate") : t("priceLists.newPriceList")}
            </h2>
            <p className="text-slate-500">{t("priceLists.subtitle")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)} className="sm:pb-0 pb-16">
          <div className="space-y-6">
            {/* Details section */}
            <Card>
              <CardHeader>
                <CardTitle>{t("priceLists.details")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t("priceLists.name")} *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={t("priceLists.namePlaceholder")}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">{t("priceLists.description")}</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder={t("priceLists.descriptionPlaceholder")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="discount">{t("priceLists.defaultDiscount")} %</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      max="100"
                      step="0.001"
                      value={formData.defaultDiscountPercent}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          defaultDiscountPercent: parseFloat(e.target.value) || 0,
                        }))
                      }
                      onFocus={(e) => e.target.select()}
                    />
                    <p className="text-xs text-slate-500">{t("priceLists.defaultDiscountHint")}</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("priceLists.status")}</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, isActive: checked }))
                        }
                      />
                      <span className="text-sm">
                        {formData.isActive ? t("priceLists.active") : t("priceLists.inactive")}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items section */}
            <Card>
              <CardHeader>
                <CardTitle>{t("priceLists.lineItems")}</CardTitle>
                <CardAction>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    {t("priceLists.addProduct")}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <PriceListLineItems
                  lineItems={lineItems}
                  products={products}
                  currencySymbol={currencySymbol}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                  onUpdateItem={handleUpdateItem}
                  onProductSelect={handleProductSelect}
                  onBulkAdd={handleBulkAdd}
                  onRemoveAll={handleRemoveAll}
                  focusNextFocusable={focusNextFocusable}
                  bulkLoading={bulkLoading}
                />
              </CardContent>
            </Card>

            {/* Assignments section */}
            <Card>
              <CardHeader>
                <CardTitle>{t("priceLists.assignments")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PriceListAssignments
                  assignedUsers={assignedUsers}
                  assignedCustomers={assignedCustomers}
                  allUsers={allUsers}
                  allCustomers={allCustomers}
                  onAssignUser={handleAssignUser}
                  onUnassignUser={handleUnassignUser}
                  onAssignCustomer={handleAssignCustomer}
                  onUnassignCustomer={handleUnassignCustomer}
                />
              </CardContent>
            </Card>

            {/* Desktop submit buttons */}
            <Card className="hidden sm:block">
              <CardContent className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canSubmit}
                  onClick={() => {
                    saveAndNew.current = true;
                    formRef.current?.requestSubmit();
                  }}
                >
                  {isSubmitting && saveAndNew.current && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("priceLists.saveAndNew")}
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting && !saveAndNew.current && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>

        {/* Mobile submit buttons */}
        <StickyBottomBar>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => {
              saveAndNew.current = true;
              formRef.current?.requestSubmit();
            }}
          >
            {t("priceLists.saveAndNew")}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => {
              saveAndNew.current = false;
              formRef.current?.requestSubmit();
            }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </StickyBottomBar>
      </div>
    </PageAnimation>
  );
}
