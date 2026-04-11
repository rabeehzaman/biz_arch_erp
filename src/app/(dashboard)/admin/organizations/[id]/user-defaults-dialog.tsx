"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANDING_PAGE_OPTIONS } from "@/lib/form-config/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface UserDefaultsDialogProps {
  orgId: string;
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE_VALUE = "__none__";

interface BranchOption {
  id: string;
  name: string;
  code: string | null;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string | null;
  branchId: string;
}

export function UserDefaultsDialog({
  orgId,
  userId,
  userName,
  open,
  onOpenChange,
}: UserDefaultsDialogProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState<string>(NONE_VALUE);
  const [warehouseId, setWarehouseId] = useState<string>(NONE_VALUE);
  const [landingPage, setLandingPage] = useState<string>(NONE_VALUE);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  useEffect(() => {
    if (!open) return;

    async function fetchDefaults() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/user-defaults/${userId}`
        );
        if (!res.ok) throw new Error("Failed to fetch user defaults");
        const data = await res.json();

        const salesDefaults = data.formDefaults?.salesInvoice ?? {};
        setBranchId(salesDefaults.branchId || NONE_VALUE);
        setWarehouseId(salesDefaults.warehouseId || NONE_VALUE);
        setLandingPage(data.landingPage ?? NONE_VALUE);
        setBranches(data.branches ?? []);
        setWarehouses(data.warehouses ?? []);
      } catch {
        toast.error(t("admin.failedToLoadUserDefaults"));
      } finally {
        setLoading(false);
      }
    }

    fetchDefaults();
  }, [open, orgId, userId]);

  async function handleSave() {
    setSaving(true);
    try {
      const sharedDefaults: Record<string, string> = {};
      if (branchId !== NONE_VALUE) sharedDefaults.branchId = branchId;
      if (warehouseId !== NONE_VALUE) sharedDefaults.warehouseId = warehouseId;

      const formDefaults: Record<string, Record<string, string>> = {};
      const transactionForms = [
        "salesInvoice",
        "purchaseInvoice",
        "creditNote",
        "quotation",
      ];
      for (const form of transactionForms) {
        if (Object.keys(sharedDefaults).length > 0) {
          formDefaults[form] = { ...sharedDefaults };
        }
      }

      const res = await fetch(
        `/api/admin/organizations/${orgId}/user-defaults/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formDefaults: Object.keys(formDefaults).length > 0 ? formDefaults : null,
            landingPage: landingPage === NONE_VALUE ? null : landingPage,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save user defaults");
      }

      toast.success(`Defaults saved for ${userName}`);
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save user defaults";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Defaults — {userName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            {/* Default Branch */}
            <div className="grid gap-2">
              <Label>Default Branch</Label>
              {branches.length > 0 ? (
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.code ? ` (${b.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No branches configured for this organization
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Applied to invoices, purchases, credit notes, and quotations.
              </p>
            </div>

            {/* Default Warehouse */}
            <div className="grid gap-2">
              <Label>Default Warehouse</Label>
              {warehouses.length > 0 ? (
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}{w.code ? ` (${w.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No warehouses configured for this organization
                </p>
              )}
            </div>

            {/* Default Landing Page */}
            <div className="grid gap-2">
              <Label>Default Landing Page</Label>
              <Select value={landingPage} onValueChange={setLandingPage}>
                <SelectTrigger>
                  <SelectValue placeholder="Use org default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Use org default</SelectItem>
                  {LANDING_PAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Defaults
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
