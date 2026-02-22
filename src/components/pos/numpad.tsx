"use client";

import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface NumpadProps {
  onInput: (value: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}

export function Numpad({ onInput, onClear, onBackspace }: NumpadProps) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "."];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <Button
          key={key}
          variant="outline"
          className="h-12 text-lg font-medium"
          onClick={() => onInput(key)}
        >
          {key}
        </Button>
      ))}
      <Button
        variant="outline"
        className="h-12"
        onClick={onClear}
      >
        C
      </Button>
      <Button
        variant="outline"
        className="h-12 col-span-2"
        onClick={onBackspace}
      >
        <Delete className="h-5 w-5" />
      </Button>
    </div>
  );
}
