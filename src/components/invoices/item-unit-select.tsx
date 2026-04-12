"use client";

import React, { useRef, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";

interface UnitOption {
    id: string;
    name: string;
    conversionFactor: number;
    price?: number | null;
}

interface ItemUnitSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    options: UnitOption[];
    required?: boolean;
    disabled?: boolean;
    className?: string;
    onSelectFocusNext?: (triggerRef: React.RefObject<HTMLButtonElement | null>) => void;
}

export function ItemUnitSelect({
    value,
    onValueChange,
    options,
    disabled = false,
    className,
    onSelectFocusNext,
}: ItemUnitSelectProps) {
    const { t } = useLanguage();
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Determine the effective value: use the passed value if it's valid in options,
    // otherwise fall back to the first option (default unit when set).
    const effectiveValue = (value && options.some(opt => opt.id === value))
        ? value
        : options[0]?.id || "";

    // Sync parent state when effectiveValue diverges from passed value,
    // but ONLY when parent has no value (blank → first option auto-select).
    // If parent already has a non-empty unitId that isn't in the current options
    // (e.g. a stale unit after product edit), keep parent state unchanged to
    // avoid silently resetting the line item price to the catalog default.
    useEffect(() => {
        if (effectiveValue && effectiveValue !== value && !value) {
            onValueChange(effectiveValue);
        }
    }, [effectiveValue, value, onValueChange]);

    const handleValueChange = (newValue: string) => {
        onValueChange(newValue);
        if (onSelectFocusNext) {
            setTimeout(() => {
                onSelectFocusNext(triggerRef);
            }, 10);
        }
    };

    return (
        <div className={`w-full ${className || ""}`}>
            <Select value={effectiveValue} onValueChange={handleValueChange} disabled={disabled || options.length === 0}>
                <SelectTrigger
                    ref={triggerRef}
                    className="w-full h-10 border-0 bg-transparent hover:bg-slate-100 focus:ring-1 focus:ring-slate-950 rounded-sm"
                >
                    <SelectValue placeholder={options.length === 0 ? t("units.noUnits") : t("common.unit")} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                            {opt.name} {opt.conversionFactor !== 1 ? `(x${opt.conversionFactor})` : ""}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
