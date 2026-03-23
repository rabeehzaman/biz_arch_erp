"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Date input with mobile-optimized touch target sizing.
 * Wraps <Input type="date"> with min-h-[44px] for accessibility.
 */
function DateInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  return (
    <Input
      type="date"
      className={cn("min-h-[44px]", className)}
      {...props}
    />
  )
}

export { DateInput }
