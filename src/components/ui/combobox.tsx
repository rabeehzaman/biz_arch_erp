"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, Check, ChevronsUpDown, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { resetMobileDialogViewport, setPreserveScrollY } from "@/lib/mobile-viewport";

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
  /** Render as full-screen overlay on mobile instead of bottom sheet */
  mobileFullScreen?: boolean;
}

export function Combobox<T>({
  items,
  value,
  onValueChange,
  getId,
  getLabel,
  filterFn,
  renderItem,
  placeholder: placeholderProp,
  emptyText: emptyTextProp,
  required = false,
  disabled = false,
  className,
  onSelect,
  onSelectFocusNext,
  autoOpenOnFocus = true,
  autoFocus = false,
  mobileFullScreen = false,
}: ComboboxProps<T>) {
  const { t } = useLanguage();
  const placeholder = placeholderProp ?? t("common.selectAnItem");
  const emptyText = emptyTextProp ?? t("common.noItemsFound");
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const justClosedRef = React.useRef(false);
  const isPointerDownRef = React.useRef(false);
  const scrollYBeforeOpenRef = React.useRef(0);
  const listboxId = React.useId();
  const isMobile = useIsMobile();
  const isMobileRef = React.useRef(isMobile);
  isMobileRef.current = isMobile;

  // Programmatic autoFocus — delayed so isMobile has settled after hydration
  React.useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => {
      if (!isMobileRef.current) {
        triggerRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [autoFocus]);


  // Ensure items is always an array
  const safeItems = React.useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  const selectedLabel = React.useMemo(() => {
    if (!value) return "";
    const selectedItem = safeItems.find((item) => getId(item) === value);
    return selectedItem ? getLabel(selectedItem) : "";
  }, [safeItems, value, getId, getLabel]);

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return safeItems;
    return safeItems.filter((item) => filterFn(item, searchQuery.toLowerCase()));
  }, [safeItems, searchQuery, filterFn]);

  // Reset highlighted index when filtered items change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems]);

  const handleSelect = React.useCallback((selectedValue: string) => {
    onValueChange(selectedValue);
    justClosedRef.current = true;

    // On mobile, signal scroll preservation BEFORE closing the dialog.
    // setOpen(false) bypasses onOpenChange, so resetMobileDialogViewport
    // won't fire — we set the shared variable directly.
    if (isMobile) {
      setPreserveScrollY(scrollYBeforeOpenRef.current);
    }

    setOpen(false);
    setSearchQuery("");

    // Manage focus uniformly after a selection is made.
    // Use preventScroll on mobile to avoid clobbering the restored scroll position.
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
        triggerRef.current?.focus({ preventScroll: true });
      }
    }, 10);
  }, [isMobile, onSelect, onSelectFocusNext, onValueChange]);

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
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        // Return focus to trigger button
        triggerRef.current?.focus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (filteredItems[highlightedIndex]) {
          handleSelect(getId(filteredItems[highlightedIndex]));
        } else {
          setOpen(false);
          setSearchQuery("");
          triggerRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, getId, handleSelect, highlightedIndex, open]);

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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
    setSearchQuery("");
  };

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-controls={listboxId}
      aria-expanded={open}
      aria-required={required}
      disabled={disabled}
      onPointerDown={() => {
        isPointerDownRef.current = true;
      }}
      onFocus={() => {
        if (isPointerDownRef.current) {
          isPointerDownRef.current = false;
          return;
        }
        if (justClosedRef.current) {
          justClosedRef.current = false;
          return;
        }
        if (autoOpenOnFocus && !disabled) {
          scrollYBeforeOpenRef.current = window.scrollY;
          setOpen(true);
        }
      }}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.18)] ring-offset-white transition-[border-color,box-shadow,background-color] placeholder:text-slate-500 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-200/60 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        key={value || "__placeholder"}
        className={cn("line-clamp-1", !selectedLabel && "text-slate-500")}
      >
        {selectedLabel || placeholder}
      </span>
      <div className="flex items-center gap-1">
        {value && !disabled && (
          <X
            className="h-4 w-4 text-slate-400 transition-colors hover:text-slate-600"
            onClick={handleClear}
          />
        )}
        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );

  const searchInput = (
    <div className="flex items-center border-b border-slate-200 px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        placeholder={t("common.search")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-500"
      />
    </div>
  );

  const itemsList = (
    <div
      id={listboxId}
      ref={listRef}
      role="listbox"
      className={cn("overflow-y-auto p-2", isMobile ? "max-h-[70dvh]" : "max-h-60")}
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
                "relative flex cursor-pointer select-none items-center rounded-xl px-3 text-sm outline-none transition-colors",
                isMobile ? "min-h-[52px] py-3" : "py-2.5",
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
  );

  // ── Mobile: full-screen overlay or bottom sheet ──
  if (isMobile) {
    return (
      <>
        <div onClick={() => {
          if (!disabled) {
            scrollYBeforeOpenRef.current = window.scrollY;
            setOpen(true);
          }
        }}>
          {triggerButton}
        </div>
        <DialogPrimitive.Root
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              resetMobileDialogViewport({ preserveScroll: true, scrollY: scrollYBeforeOpenRef.current });
              setSearchQuery("");
            }
            setOpen(nextOpen);
          }}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={cn(
              "fixed inset-0 z-50",
              mobileFullScreen
                ? "bg-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                : "bg-[linear-gradient(180deg,rgba(2,6,23,0.62),rgba(2,6,23,0.82))] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            )} />
            <DialogPrimitive.Content
              data-slot="dialog-content"
              className={cn(
                mobileFullScreen
                  ? "fixed inset-0 z-50 flex flex-col bg-white outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-200"
                  : "glass-panel-strong fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-slate-200 outline-none overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
              )}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                if (mobileFullScreen) {
                  // Focus immediately to stay within user gesture context (iOS keyboard)
                  requestAnimationFrame(() => inputRef.current?.focus());
                } else {
                  setTimeout(() => inputRef.current?.focus(), 50);
                }
              }}
            >
              {mobileFullScreen ? (
                <>
                  <div className="flex items-center gap-3 border-b border-slate-200 px-3 pt-[var(--app-safe-area-top)]">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="shrink-0 rounded-full p-2 transition-colors hover:bg-slate-100"
                    >
                      <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      autoFocus
                      placeholder={placeholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex h-12 w-full bg-transparent py-3 text-base outline-none placeholder:text-slate-500"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 p-1">
                        <X className="h-4 w-4 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <DialogPrimitive.Title className="sr-only">{placeholder}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">{placeholder}</DialogPrimitive.Description>
                  <div className="flex-1 overflow-y-auto p-2 pb-[var(--app-safe-area-bottom)]">
                    {filteredItems.length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-500">{emptyText}</div>
                    ) : (
                      filteredItems.map((item, index) => {
                        const itemId = getId(item);
                        const isSelected = value === itemId;
                        return (
                          <div
                            key={itemId}
                            role="option"
                            aria-selected={isSelected}
                            className={cn(
                              "relative flex cursor-pointer select-none items-center rounded-xl px-3 min-h-[52px] py-3 text-sm outline-none transition-colors active:bg-slate-100",
                              isSelected && "bg-slate-50"
                            )}
                            onClick={() => handleSelect(itemId)}
                          >
                            {isSelected && <Check className="mr-2 h-4 w-4 shrink-0" />}
                            <div className={cn(!isSelected && "ml-6", "flex-1")}>
                              {renderItem ? renderItem(item) : getLabel(item)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto mt-3 mb-1 h-1.5 w-14 shrink-0 rounded-full bg-slate-300/70" />
                  <DialogPrimitive.Title className="sr-only">{placeholder}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">{placeholder}</DialogPrimitive.Description>
                  <div className="sticky top-0 z-10 bg-white">
                    {searchInput}
                  </div>
                  {itemsList}
                  <div className="h-[var(--app-safe-area-bottom)]" />
                </>
              )}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </>
    );
  }

  // ── Desktop: popover dropdown ──
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        {triggerButton}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-[1.5rem] border border-slate-200 bg-white p-0 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.24)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          {searchInput}
          {itemsList}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
