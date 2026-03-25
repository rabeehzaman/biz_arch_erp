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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANDING_PAGE_OPTIONS } from "@/lib/form-config/types";
import { toast } from "sonner";

interface UserDefaultsDialogProps {
  orgId: string;
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE_VALUE = "__none__";

export function UserDefaultsDialog({
  orgId,
  userId,
  userName,
  open,
  onOpenChange,
}: UserDefaultsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [landingPage, setLandingPage] = useState<string>(NONE_VALUE);

  // Fetch current user defaults when the dialog opens
  useEffect(() => {
    if (!open) return;

    async function fetchDefaults() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/user-defaults/${userId}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch user defaults");
        }
        const data = await res.json();

        // Extract branchId and warehouseId from formDefaults
        const salesDefaults = data.formDefaults?.salesInvoice ?? {};
        setBranchId(salesDefaults.branchId ?? "");
        setWarehouseId(salesDefaults.warehouseId ?? "");
        setLandingPage(data.landingPage ?? NONE_VALUE);
      } catch {
        toast.error("Failed to load user defaults");
      } finally {
        setLoading(false);
      }
    }

    fetchDefaults();
  }, [open, orgId, userId]);

  async function handleSave() {
    setSaving(true);
    try {
      // Build formDefaults — apply branchId/warehouseId to all transaction forms
      const sharedDefaults: Record<string, string> = {};
      if (branchId.trim()) sharedDefaults.branchId = branchId.trim();
      if (warehouseId.trim()) sharedDefaults.warehouseId = warehouseId.trim();

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
            formDefaults,
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
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            {/* Default Branch ID */}
            <div className="grid gap-2">
              <Label htmlFor="branchId">Default Branch ID</Label>
              <Input
                id="branchId"
                placeholder="Paste branch ID"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Applied to sales invoices, purchases, credit notes, and
                quotations.
              </p>
            </div>

            {/* Default Warehouse ID */}
            <div className="grid gap-2">
              <Label htmlFor="warehouseId">Default Warehouse ID</Label>
              <Input
                id="warehouseId"
                placeholder="Paste warehouse ID"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              />
            </div>

            {/* Default Landing Page */}
            <div className="grid gap-2">
              <Label htmlFor="landingPage">Default Landing Page</Label>
              <Select value={landingPage} onValueChange={setLandingPage}>
                <SelectTrigger id="landingPage">
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
            {saving ? "Saving..." : "Save Defaults"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
