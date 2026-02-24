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
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const justClosedRef = React.useRef(false);

  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];

  // Get the selected item
  const selectedItem = React.useMemo(
    () => safeItems.find((item) => getId(item) === value),
    [safeItems, value, getId]
  );

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return safeItems;
    return safeItems.filter((item) => filterFn(item, searchQuery.toLowerCase()));
  }, [safeItems, searchQuery, filterFn]);

  // Reset highlighted index when filtered items change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[highlightedIndex]) {
          handleSelect(getId(filteredItems[highlightedIndex]));
          // When selected via Enter, request moving focus forward
          if (onSelectFocusNext) {
            setTimeout(() => {
              onSelectFocusNext(triggerRef);
            }, 10);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        // Return focus to trigger button
        triggerRef.current?.focus();
      } else if (e.key === "Tab") {
        // Close the combobox and let Tab naturally move focus
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredItems, highlightedIndex]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const highlightedElement = listRef.current.children[
      highlightedIndex
    ] as HTMLElement;
    if (highlightedElement) {
      highlightedElement.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    justClosedRef.current = true;
    setOpen(false);
    setSearchQuery("");
    // Call onSelect callback after a microtask to ensure state updates are applied
    if (onSelect) {
      setTimeout(() => onSelect(), 0);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
    setSearchQuery("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          // Using onFocus allows standard tab cycling. 
          // However, autoFocus will trigger this on mount, which is generally desired for the first field.
          onFocus={() => {
            if (justClosedRef.current) {
              justClosedRef.current = false;
              return;
            }
            if (autoOpenOnFocus && !disabled) {
              setOpen(true);
            }
          }}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn(!selectedItem && "text-slate-500")}>
            {selectedItem ? getLabel(selectedItem) : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && !disabled && (
              <X
                className="h-4 w-4 text-slate-400 hover:text-slate-600"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-slate-400" />
          </div>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-slate-200 bg-white p-0 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="flex items-center border-b border-slate-200 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-500"
            />
          </div>
          <div
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto p-1"
          >
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                {emptyText}
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const itemId = getId(item);
                const isSelected = value === itemId;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={itemId}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none",
                      isHighlighted && "bg-slate-100",
                      isSelected && "bg-slate-100"
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(itemId)}
                  >
                    {isSelected && (
                      <Check className="mr-2 h-4 w-4 shrink-0" />
                    )}
                    <div className={cn(!isSelected && "ml-6", "flex-1")}>
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
