"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
}

export function UnitSelect({
  value,
  onValueChange,
  required = false,
  label = "Unit",
  error,
}: UnitSelectProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
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
  };

  const selectedUnit = units.find((u) => u.id === value);
  const displayValue = selectedUnit
    ? `${selectedUnit.name} (${selectedUnit.code.toUpperCase()})`
    : undefined;

  return (
    <div className="grid gap-2">
      {label && (
        <Label htmlFor="unit">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger id="unit" className={error ? "border-red-500" : ""}>
          <SelectValue placeholder={loading ? "Loading..." : "Select a unit"}>
            {displayValue}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {units.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>
              {unit.name} ({unit.code.toUpperCase()})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
