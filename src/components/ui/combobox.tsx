"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Search, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const inputRef = React.useRef<HTMLInputElement>(null);

  const safeItems = Array.isArray(items) ? items : [];
  const selectedItem = safeItems.find((item) => getId(item) === value);

  const filteredItems = React.useMemo(() => {
    let result = safeItems;
    if (searchQuery) {
      result = safeItems.filter((item) => filterFn(item, searchQuery.toLowerCase()));
    }

    const capped = result.slice(0, 100);

    // Always keep selected item visible
    if (value && !capped.some((item) => getId(item) === value)) {
      const sel = result.find((item) => getId(item) === value);
      if (sel) {
        capped.unshift(sel);
        if (capped.length > 100) capped.pop();
      }
    }

    return capped;
  }, [safeItems, searchQuery, filterFn, value, getId]);

  const openDropdown = () => {
    if (!disabled) {
      setOpen(true);
      // Focus the search input after open
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const closeDropdown = () => {
    setOpen(false);
    setSearchQuery("");
  };

  const handleItemClick = (itemId: string) => {
    onValueChange(itemId);
    closeDropdown();

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
    }, 10);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
    setSearchQuery("");
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeDropdown();
      triggerRef.current?.focus();
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { if (!o) closeDropdown(); }}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          onClick={() => (open ? closeDropdown() : openDropdown())}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("truncate", !selectedItem && "text-slate-500")}>
            {selectedItem ? getLabel(selectedItem) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && !disabled && (
              <X
                className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => handleClear(e)}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-[200] w-[var(--radix-popover-trigger-width)] rounded-md border border-slate-200 bg-white shadow-md outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-slate-200 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-500"
              // CRITICAL: prevent mousedown from stealing focus away from the input
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          {/* Items list */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">{emptyText}</div>
            ) : (
              filteredItems.map((item) => {
                const itemId = getId(item);
                const isSelected = value === itemId;

                return (
                  <div
                    key={itemId}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100",
                      isSelected && "bg-slate-100"
                    )}
                    // preventDefault on mousedown keeps the input focused so the popover stays open
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleItemClick(itemId)}
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
                  </div>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
