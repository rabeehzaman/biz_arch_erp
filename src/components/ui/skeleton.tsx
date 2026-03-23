import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgba(226,232,240,0.7),rgba(191,219,254,0.8),rgba(226,232,240,0.7))] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
