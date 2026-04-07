"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { resetMobileDialogViewport, setPreserveScrollY } from "@/lib/mobile-viewport"
import { useHaptics } from "@/hooks/use-haptics"

interface MobileSelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

interface MobileSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  options: MobileSelectOption[]
  className?: string
  size?: "sm" | "default"
}

export function MobileSelect({
  value,
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  options,
  className,
  size = "default",
}: MobileSelectProps) {
  const [open, setOpen] = React.useState(false)
  const scrollYBeforeOpenRef = React.useRef(0)
  const { selectionChanged } = useHaptics()
  const [keyboardInset, setKeyboardInset] = React.useState(0)

  React.useEffect(() => {
    if (!open) {
      setKeyboardInset(0)
      return
    }
    const viewport = window.visualViewport
    if (!viewport) return
    const onViewportChange = () => {
      const diff = window.innerHeight - viewport.height
      setKeyboardInset(diff > 120 ? diff : 0)
    }
    onViewportChange()
    viewport.addEventListener("resize", onViewportChange)
    viewport.addEventListener("scroll", onViewportChange)
    return () => {
      viewport.removeEventListener("resize", onViewportChange)
      viewport.removeEventListener("scroll", onViewportChange)
      setKeyboardInset(0)
    }
  }, [open])

  const selectedOption = options.find((o) => o.value === value)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          scrollYBeforeOpenRef.current = window.scrollY
          setOpen(true)
        }}
        className={cn(
          "flex w-fit items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm whitespace-nowrap shadow-[0_14px_30px_-26px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow,background-color] outline-none hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50",
          size === "default" ? "h-10" : "h-9",
          className
        )}
      >
        <span className={cn(!selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon className="size-4 opacity-50" />
      </button>

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) resetMobileDialogViewport({ preserveScroll: true, scrollY: scrollYBeforeOpenRef.current })
          setOpen(nextOpen)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[linear-gradient(180deg,rgba(2,6,23,0.62),rgba(2,6,23,0.82))] backdrop-blur-sm" />
          <DialogPrimitive.Content
            data-slot="dialog-content"
            className="glass-panel-strong fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-slate-200 outline-none overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
            style={keyboardInset > 0 ? { maxHeight: `calc(100dvh - ${keyboardInset}px)` } : undefined}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="mx-auto mt-3 mb-1 h-1.5 w-14 shrink-0 rounded-full bg-slate-300/70" />
            <DialogPrimitive.Title className="sr-only">
              {placeholder}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{placeholder}</DialogPrimitive.Description>
            <div className="flex-1 overflow-y-auto p-2 pb-[calc(0.5rem+var(--app-safe-area-bottom))]">
              {options.map((option) => {
                const isSelected = value === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    className={cn(
                      "touch-ripple relative flex min-h-[52px] w-full items-center gap-3 rounded-xl px-4 text-start text-sm transition-colors active:bg-slate-50 disabled:opacity-50",
                      isSelected && "bg-slate-50 font-medium"
                    )}
                    onClick={() => {
                      selectionChanged()
                      onValueChange?.(option.value)
                      setPreserveScrollY(scrollYBeforeOpenRef.current)
                      setOpen(false)
                    }}
                  >
                    <span className="flex-1">{option.label}</span>
                    {isSelected && (
                      <CheckIcon className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
