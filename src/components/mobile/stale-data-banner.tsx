"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"
import { useLanguage } from "@/lib/i18n"

interface StaleDataBannerProps {
  isStale: boolean
}

export function StaleDataBanner({ isStale }: StaleDataBannerProps) {
  const { t } = useLanguage()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener("offline", goOffline)
    window.addEventListener("online", goOnline)
    return () => {
      window.removeEventListener("offline", goOffline)
      window.removeEventListener("online", goOnline)
    }
  }, [])

  if (!isStale && !offline) return null

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 sm:hidden">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        {t("common.showingCachedData") || "Showing cached data — you appear to be offline"}
      </span>
    </div>
  )
}
