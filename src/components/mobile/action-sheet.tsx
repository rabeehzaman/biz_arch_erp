"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { resetMobileDialogViewport } from "@/lib/mobile-viewport"
import { useHaptics } from "@/hooks/use-haptics"

export interface ActionSheetAction {
  label: string
  icon?: LucideIcon
  variant?: "default" | "destructive"
  onSelect: () => void
}

interface ActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  actions: ActionSheetAction[]
  cancelLabel?: string
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  cancelLabel = "Cancel",
}: ActionSheetProps) {
  const { selectionChanged } = useHaptics()

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetMobileDialogViewport()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[linear-gradient(180deg,rgba(2,6,23,0.62),rgba(2,6,23,0.82))] backdrop-blur-sm"
        />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 p-3 pb-[calc(0.75rem+var(--app-safe-area-bottom))] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Actions group */}
          <div className="overflow-hidden rounded-2xl bg-white">
            {/* Drag handle */}
            <div className="mx-auto mt-2.5 mb-1 h-1.5 w-14 shrink-0 rounded-full bg-slate-300/70" />

            {(title || description) && (
              <div className="border-b border-slate-100 px-5 pb-3 pt-1 text-center">
                {title && (
                  <DialogPrimitive.Title className="text-sm font-semibold text-slate-900">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-xs text-slate-500">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            )}

            {/* Hide title from a11y tree if not provided */}
            {!title && (
              <DialogPrimitive.Title className="sr-only">
                Actions
              </DialogPrimitive.Title>
            )}

            <div className="flex flex-col">
              {actions.map((action, index) => {
                const Icon = action.icon
                return (
                  <button
                    key={index}
                    className={cn(
                      "touch-ripple flex min-h-[52px] items-center justify-center gap-3 px-5 text-base font-medium transition-colors active:bg-slate-50",
                      index < actions.length - 1 && "border-b border-slate-100",
                      action.variant === "destructive"
                        ? "text-red-600"
                        : "text-slate-900"
                    )}
                    onClick={() => {
                      selectionChanged()
                      action.onSelect()
                      onOpenChange(false)
                    }}
                  >
                    {Icon && <Icon className="size-5" />}
                    {action.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cancel button — separated */}
          <button
            className="touch-ripple flex min-h-[52px] items-center justify-center rounded-2xl bg-white text-base font-semibold text-primary transition-colors active:bg-slate-50"
            onClick={() => {
              selectionChanged()
              onOpenChange(false)
            }}
          >
            {cancelLabel}
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
