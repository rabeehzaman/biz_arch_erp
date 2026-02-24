"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UnitFormDialog } from "@/components/units/unit-form-dialog";

interface Unit {
  id: string;
  code: string;
  name: string;
}

interface UnitSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  label?: string;
  error?: string;
  className?: string; // Add className prop for flexibility
}

export function UnitSelect({
  value,
  onValueChange,
  required = false,
  label = "Unit",
  error,
  className,
}: UnitSelectProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/units");
      if (response.ok) {
        const data = await response.json();
        setUnits(data);
      }
    } catch (error) {
      console.error("Failed to fetch units:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleUnitCreated = (newUnit: Unit) => {
    // Optionally fetch all units to ensure list is perfectly up to date
    fetchUnits();
    // Auto-select the newly created unit
    onValueChange(newUnit.id);
  };
  const selectedUnit = units.find((u) => u.id === value);
  const displayValue = selectedUnit
    ? `${selectedUnit.name} (${selectedUnit.code.toUpperCase()})`
    : undefined;

  return (
    <div className={`grid gap-2 ${className || ""}`}>
      {label && (
        <Label htmlFor="unit">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onValueChange} disabled={loading}>
          <SelectTrigger id="unit" className={error ? "border-red-500 flex-1" : "flex-1"}>
            <SelectValue placeholder={loading ? "Loading..." : "Select a unit"}>
              {displayValue}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {units.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No units found. Click + to add one.
              </div>
            ) : (
              units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.code.toUpperCase()})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsUnitDialogOpen(true)}
          title="Add new unit"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <UnitFormDialog
        open={isUnitDialogOpen}
        onOpenChange={setIsUnitDialogOpen}
        onSuccess={handleUnitCreated}
      />
    </div>
  );
}
