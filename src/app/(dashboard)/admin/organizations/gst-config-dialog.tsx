"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { INDIAN_STATES } from "@/lib/gst/constants";

interface GSTConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
}

export function OrgSettingsDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
}: GSTConfigDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [gstEnabled, setGstEnabled] = useState(false);
  const [eInvoicingEnabled, setEInvoicingEnabled] = useState(false);
  const [multiUnitEnabled, setMultiUnitEnabled] = useState(false);
  const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
  const [gstin, setGstin] = useState("");
  const [gstStateCode, setGstStateCode] = useState("");

  useEffect(() => {
    if (open && orgId) {
      setLoading(true);
      setError("");
      fetch(`/api/admin/organizations/${orgId}`)
        .then((res) => res.json())
        .then((data) => {
          setGstEnabled(data.gstEnabled || false);
          setEInvoicingEnabled(data.eInvoicingEnabled || false);
          setMultiUnitEnabled(data.multiUnitEnabled || false);
          setMultiBranchEnabled(data.multiBranchEnabled || false);
          setGstin(data.gstin || "");
          setGstStateCode(data.gstStateCode || "");
        })
        .catch(() => setError("Failed to load organization"))
        .finally(() => setLoading(false));
    }
  }, [open, orgId]);

  const handleGstinChange = (value: string) => {
    const upper = value.toUpperCase();
    setGstin(upper);
    if (upper.length >= 2) {
      const code = upper.substring(0, 2);
      if (INDIAN_STATES[code]) {
        setGstStateCode(code);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    if (gstEnabled && !gstin) {
      setError("GSTIN is required when GST is enabled");
      setSaving(false);
      return;
    }

    if (gstEnabled && gstin) {
      const gstinRegex =
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        setError("Invalid GSTIN format");
        setSaving(false);
        return;
      }
    }

    if (eInvoicingEnabled && !gstEnabled) {
      setError("GST must be enabled before enabling e-invoicing");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gstEnabled,
          eInvoicingEnabled: gstEnabled ? eInvoicingEnabled : false,
          multiUnitEnabled,
          multiBranchEnabled,
          gstin: gstEnabled ? gstin : null,
          gstStateCode: gstEnabled ? gstStateCode : null,
        }),
      });

      if (res.ok) {
        onOpenChange(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save organization settings");
      }
    } catch {
      setError("Failed to save organization settings");
    } finally {
      setSaving(false);
    }
  };

  const stateName = gstStateCode ? INDIAN_STATES[gstStateCode] : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
          <DialogDescription>
            Configure settings for <strong>{orgName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="gstEnabled">Enable GST</Label>
                <p className="text-xs text-muted-foreground">
                  Enable Indian GST tax system for this organization
                </p>
              </div>
              <Switch
                id="gstEnabled"
                checked={gstEnabled}
                onCheckedChange={(checked) => {
                  setGstEnabled(checked);
                  if (!checked) setEInvoicingEnabled(false);
                }}
              />
            </div>

            {gstEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="27AAAAA0000A1Z5"
                    maxLength={15}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    15-digit GST Identification Number
                  </p>
                </div>

                {gstStateCode && stateName && (
                  <div className="space-y-2">
                    <Label>State (auto-derived)</Label>
                    <p className="text-sm font-medium">
                      {gstStateCode} - {stateName}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="eInvoicingEnabled">Enable E-Invoicing</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable NIC e-invoicing for B2B transactions
                    </p>
                  </div>
                  <Switch
                    id="eInvoicingEnabled"
                    checked={eInvoicingEnabled}
                    onCheckedChange={setEInvoicingEnabled}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="multiUnitEnabled">Enable Alternate Units</Label>
                <p className="text-xs text-muted-foreground">
                  Allow defining products with multiple units of measurement (e.g. Cartons vs Pieces)
                </p>
              </div>
              <Switch
                id="multiUnitEnabled"
                checked={multiUnitEnabled}
                onCheckedChange={setMultiUnitEnabled}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="multiBranchEnabled">Enable Multi-Branch</Label>
                <p className="text-xs text-muted-foreground">
                  Manage multiple branches, warehouses, and stock transfers across locations
                </p>
              </div>
              <Switch
                id="multiBranchEnabled"
                checked={multiBranchEnabled}
                onCheckedChange={setMultiBranchEnabled}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
