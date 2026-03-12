"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function isMobileDialogViewport() {
  if (typeof window === "undefined") return false

  return (
    window.matchMedia("(max-width: 767px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  )
}

function resetMobileDialogViewport() {
  if (!isMobileDialogViewport()) return

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

  document.body.style.removeProperty("pointer-events")
  document.documentElement.style.setProperty("--mobile-fixed-ui-offset", "0px")

  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"))
    window.dispatchEvent(new Event("mobile-dialog-viewport-reset"))

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"))
      window.dispatchEvent(new Event("mobile-dialog-viewport-reset"))
    })
  })
}

function Dialog({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      onOpenChange={(open) => {
        if (!open) {
          resetMobileDialogViewport()
        }

        onOpenChange?.(open)
      }}
      {...props}
    />
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[linear-gradient(180deg,rgba(2,6,23,0.62),rgba(2,6,23,0.82))] backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        ref={contentRef}
        className={cn(
          // Mobile: bottom sheet
          "glass-panel-strong fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-2.5rem)] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-slate-200 outline-none overscroll-contain",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300",
          // Desktop: centered dialog
          "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:border",
          "sm:data-[state=closed]:slide-out-to-bottom-[0%] sm:data-[state=open]:slide-in-from-bottom-[0%] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0",
          className
        )}
        onOpenAutoFocus={(event) => {
          if (isMobileDialogViewport()) {
            event.preventDefault()
            contentRef.current?.focus({ preventScroll: true })
          }

          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={(event) => {
          if (isMobileDialogViewport()) {
            event.preventDefault()
          }

          onCloseAutoFocus?.(event)
        }}
        {...props}
      >
        {/* Drag handle — mobile only */}
        <div className="mx-auto mt-3 mb-1 h-1.5 w-14 shrink-0 rounded-full bg-slate-300/70 sm:hidden" />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain p-5 pb-[calc(1rem+var(--app-safe-area-bottom))] pt-3 sm:gap-4 sm:p-6 sm:pt-6">
          {children}
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-white data-[state=open]:text-muted-foreground absolute top-4 right-4 z-50 rounded-full border border-slate-200 bg-white p-2 opacity-80 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.22)] transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("sticky top-0 z-10 flex flex-col gap-1.5 bg-white/95 pb-2 text-center backdrop-blur-sm sm:static sm:bg-transparent sm:pb-0 sm:text-left sm:backdrop-blur-0", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 pb-[calc(0.25rem+var(--app-safe-area-bottom))] pt-3 backdrop-blur-sm sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:pb-0 sm:pt-0 sm:backdrop-blur-0",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
