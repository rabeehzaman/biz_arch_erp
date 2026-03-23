"use client"

import { X, Trash2, CheckSquare } from "lucide-react"
import { useLanguage } from "@/lib/i18n"
import { useHaptics } from "@/hooks/use-haptics"

interface SelectionToolbarProps {
  count: number
  total: number
  onSelectAll: () => void
  onDelete: () => void
  onCancel: () => void
}

export function SelectionToolbar({
  count,
  total,
  onSelectAll,
  onDelete,
  onCancel,
}: SelectionToolbarProps) {
  const { t } = useLanguage()
  const { selectionChanged } = useHaptics()

  if (count === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+var(--app-safe-area-bottom))] z-40 mx-4 sm:hidden">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={() => {
            selectionChanged()
            onCancel()
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>

        <span className="flex-1 text-sm font-semibold text-slate-900">
          {count} {t("common.selected") || "selected"}
        </span>

        {count < total && (
          <button
            type="button"
            onClick={() => {
              selectionChanged()
              onSelectAll()
            }}
            className="touch-ripple flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 active:bg-slate-50"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {t("common.selectAll") || "All"}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            selectionChanged()
            onDelete()
          }}
          className="touch-ripple flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-medium text-white active:bg-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  )
}
