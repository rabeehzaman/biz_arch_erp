"use client";

import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumpadProps {
  onInput: (value: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  compact?: boolean;
  className?: string;
}

export function Numpad({
  onInput,
  onClear,
  onBackspace,
  compact = false,
  className,
}: NumpadProps) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "."];

  return (
    <div
      className={cn(
        "grid grid-cols-3",
        compact ? "gap-1.5" : "gap-2",
        className,
      )}
    >
      {keys.map((key) => (
        <Button
          key={key}
          variant="outline"
          type="button"
          className={cn(
            "font-semibold shadow-none",
            compact
              ? "h-9 rounded-xl border-slate-200 bg-slate-50 text-sm hover:bg-white sm:h-9"
              : "h-12 text-lg",
          )}
          onClick={() => onInput(key)}
        >
          {key}
        </Button>
      ))}
      <Button
        variant="outline"
        type="button"
        className={cn(
          compact
            ? "h-9 rounded-xl border-slate-200 bg-slate-50 text-sm font-semibold shadow-none hover:bg-white sm:h-9"
            : "h-12",
        )}
        onClick={onClear}
      >
        C
      </Button>
      <Button
        variant="outline"
        type="button"
        className={cn(
          compact
            ? "h-9 rounded-xl border-slate-200 bg-slate-50 shadow-none hover:bg-white sm:h-9"
            : "h-12",
          "col-span-2",
        )}
        onClick={onBackspace}
      >
        <Delete className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
      </Button>
    </div>
  );
}
