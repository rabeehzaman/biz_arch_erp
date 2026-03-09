import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-white/70 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-20 w-full rounded-2xl border bg-white/72 px-3.5 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_14px_28px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-[border-color,box-shadow,background-color] outline-none hover:border-primary/25 focus-visible:bg-white/86 focus-visible:ring-[4px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
