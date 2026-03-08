"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps<T> {
  items: T[];
  value: string;
  onValueChange: (value: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  filterFn: (item: T, query: string) => boolean;
  renderItem?: (item: T) => React.ReactNode;
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect?: () => void;
  onSelectFocusNext?: (triggerRef: React.RefObject<HTMLButtonElement | null>) => void;
  autoOpenOnFocus?: boolean;
  autoFocus?: boolean;
}

export function Combobox<T>({
  items,
  value,
  onValueChange,
  getId,
  getLabel,
  filterFn,
  renderItem,
  placeholder = "Select an item...",
  emptyText = "No items found.",
  required = false,
  disabled = false,
  className,
  onSelect,
  onSelectFocusNext,
  autoOpenOnFocus = true,
  autoFocus = false,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // Track whether we just made a selection so we don't re-open on the focus-back
  const justSelectedRef = React.useRef(false);

  const safeItems = Array.isArray(items) ? items : [];
  const selectedItem = safeItems.find((item) => getId(item) === value);

  // Filter items using custom filtering logic, caps to 100 for high performance rendering
  const filteredItems = React.useMemo(() => {
    let result = safeItems;
    if (searchQuery) {
      result = safeItems.filter((item) => filterFn(item, searchQuery));
    }
    const capped = result.slice(0, 100);

    // Keep the selected item in the list even if scroll limit hits
    if (value && !capped.some((item) => getId(item) === value)) {
      const selectedMatch = result.find((item) => getId(item) === value);
      if (selectedMatch) {
        capped.unshift(selectedMatch);
        if (capped.length > 100) capped.pop();
      }
    }

    return capped;
  }, [safeItems, searchQuery, filterFn, value, getId]);

  const handleSelect = React.useCallback(
    (selectedValue: string) => {
      justSelectedRef.current = true;
      onValueChange(selectedValue);
      setOpen(false);
      setSearchQuery("");

      setTimeout(() => {
        let focusHandled = false;
        if (onSelect) {
          onSelect();
          focusHandled = true;
        }
        if (onSelectFocusNext) {
          onSelectFocusNext(triggerRef);
          focusHandled = true;
        }
        if (!focusHandled) {
          triggerRef.current?.focus();
        }
        // Reset the guard after focus settle
        setTimeout(() => {
          justSelectedRef.current = false;
        }, 200);
      }, 10);
    },
    [onSelect, onSelectFocusNext, onValueChange]
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    // When closing, reset search
    if (!nextOpen) {
      setSearchQuery("");
    }
    setOpen(nextOpen);
  }, []);

  const handleClear = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onValueChange("");
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          type="button"
          onFocus={() => {
            // Only auto-open if not just selected and flag is set
            if (autoOpenOnFocus && !disabled && !justSelectedRef.current) {
              setOpen(true);
            }
          }}
        >
          <span className={cn("truncate", !selectedItem && "text-slate-500")}>
            {selectedItem ? getLabel(selectedItem) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && !disabled && (
              <X
                className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                onPointerDown={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[100] shadow-md"
        onCloseAutoFocus={(e) => {
          // Prevent Radix from trying to restore focus automatically;
          // we handle focus ourselves in handleSelect
          e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-60 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                {emptyText}
              </div>
            ) : (
              <CommandGroup>
                {filteredItems.map((item) => {
                  const itemId = getId(item);
                  const isSelected = value === itemId;

                  return (
                    <CommandItem
                      key={itemId}
                      value={itemId}
                      onSelect={() => handleSelect(itemId)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 cursor-pointer w-full text-left outline-none",
                        isSelected && "bg-slate-100 font-medium"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 overflow-hidden">
                        {renderItem ? renderItem(item) : getLabel(item)}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
