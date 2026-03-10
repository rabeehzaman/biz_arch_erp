import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[4px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[linear-gradient(135deg,hsl(194_88%_43%),hsl(162_73%_42%))] text-primary-foreground shadow-[0_20px_38px_-20px_rgba(14,165,233,0.75)] hover:brightness-105",
        destructive:
          "border-transparent bg-[linear-gradient(135deg,hsl(0_72%_55%),hsl(12_80%_54%))] text-white shadow-[0_18px_30px_-18px_rgba(239,68,68,0.65)] hover:brightness-105 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-slate-200 bg-white text-foreground shadow-[0_16px_32px_-26px_rgba(15,23,42,0.18)] hover:border-slate-300 hover:bg-white",
        secondary:
          "border border-slate-200 bg-white text-slate-700 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.18)] hover:border-slate-300 hover:text-slate-900",
        ghost:
          "border-transparent bg-transparent text-foreground/75 hover:bg-slate-100 hover:text-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-9 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
