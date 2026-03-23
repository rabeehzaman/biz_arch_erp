"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useHaptics } from "@/hooks/use-haptics"
import { useLanguage } from "@/lib/i18n"

interface MobilePageHeaderProps {
  backHref: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function MobilePageHeader({
  backHref,
  title,
  subtitle,
  actions,
}: MobilePageHeaderProps) {
  const { selectionChanged } = useHaptics()
  const { dir } = useLanguage()
  const isRTL = dir === "rtl"
  const ChevronIcon = isRTL ? ChevronRight : ChevronLeft

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-slate-200/80 bg-white/95 px-2 py-2.5 backdrop-blur-sm sm:hidden">
      <Link
        href={backHref}
        onPointerDown={() => selectionChanged()}
        className="touch-ripple flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
      >
        <ChevronIcon className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}
