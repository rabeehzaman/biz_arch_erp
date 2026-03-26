import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)] [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[4px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,background-color]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[linear-gradient(135deg,hsl(194_88%_43%),hsl(162_73%_42%))] text-primary-foreground [a&]:hover:brightness-105",
        secondary:
          "border-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(219,234,254,0.95))] text-slate-700 [a&]:hover:bg-white",
        destructive:
          "border-transparent bg-[linear-gradient(135deg,hsl(0_72%_55%),hsl(12_80%_54%))] text-white [a&]:hover:brightness-105 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-white/65 bg-white/72 text-foreground [a&]:hover:bg-white [a&]:hover:text-accent-foreground",
        success:
          "border-transparent bg-emerald-50 text-emerald-700 shadow-none",
        warning:
          "border-transparent bg-amber-50 text-amber-700 shadow-none",
        danger:
          "border-transparent bg-red-50 text-red-700 shadow-none",
        info:
          "border-transparent bg-blue-50 text-blue-700 shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
