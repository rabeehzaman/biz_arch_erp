"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

interface UnitOption {
    id: string;
    name: string;
    conversionFactor: number;
    price?: number;
}

interface ItemUnitSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    options: UnitOption[];
    required?: boolean;
    disabled?: boolean;
    className?: string; // Add className prop for flexibility
    onSelectFocusNext?: () => void;
}

export function ItemUnitSelect({
    value,
    onValueChange,
    options,
    required = false,
    disabled = false,
    className,
    onSelectFocusNext,
}: ItemUnitSelectProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);

    // If there's only one option and no value is selected, auto-select it
    useEffect(() => {
        if (options.length > 0 && !value && !disabled) {
            onValueChange(options[0].id);
        }
    }, [options, value, onValueChange, disabled]);

    const handleValueChange = (newValue: string) => {
        onValueChange(newValue);
        if (onSelectFocusNext) {
            setTimeout(() => {
                onSelectFocusNext();
            }, 10);
        }
    };

    return (
        <div className={`w-full ${className || ""}`}>
            <Select value={value} onValueChange={handleValueChange} disabled={disabled || options.length === 0}>
                <SelectTrigger
                    ref={triggerRef}
                    className="w-full h-10 border-0 bg-transparent hover:bg-slate-100 focus:ring-1 focus:ring-slate-950 rounded-sm"
                >
                    <SelectValue placeholder={options.length === 0 ? "No units" : "Unit"} />
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
