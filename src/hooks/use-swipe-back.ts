"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useHaptics } from "@/hooks/use-haptics"

const EDGE_THRESHOLD = 20 // px from screen edge to start tracking
const COMMIT_RATIO = 0.35 // swipe 35% of screen width to commit
const MIN_SWIPE = 60 // minimum px to consider a swipe

interface SwipeBackOptions {
  /** Disable the gesture (e.g., on root tab pages) */
  disabled?: boolean
}

export function useSwipeBack({ disabled = false }: SwipeBackOptions = {}) {
  const router = useRouter()
  const { impactLight } = useHaptics()
  const [offset, setOffset] = useState(0)
  const tracking = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const committed = useRef(false)
  const isRTL = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const touch = e.touches[0]
      isRTL.current = document.dir === "rtl"

      // Check if touch started near the correct edge
      const fromStart = isRTL.current
        ? window.innerWidth - touch.clientX
        : touch.clientX

      if (fromStart > EDGE_THRESHOLD) return

      tracking.current = true
      committed.current = false
      startX.current = touch.clientX
      startY.current = touch.clientY
    },
    [disabled]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current) return
      const touch = e.touches[0]
      const deltaX = touch.clientX - startX.current
      const deltaY = touch.clientY - startY.current

      // If vertical movement is dominant, cancel tracking
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        tracking.current = false
        setOffset(0)
        return
      }

      // Calculate directional offset (positive = swiping toward inline-end)
      const directionalDelta = isRTL.current ? -deltaX : deltaX
      const clamped = Math.max(0, Math.min(directionalDelta, window.innerWidth))
      setOffset(clamped)

      // Haptic at commit threshold
      if (clamped >= window.innerWidth * COMMIT_RATIO && !committed.current) {
        committed.current = true
        impactLight()
      } else if (clamped < window.innerWidth * COMMIT_RATIO) {
        committed.current = false
      }
    },
    [impactLight]
  )

  const onTouchEnd = useCallback(() => {
    if (!tracking.current) return
    tracking.current = false

    if (offset >= window.innerWidth * COMMIT_RATIO && offset >= MIN_SWIPE) {
      router.back()
    }
    setOffset(0)
  }, [offset, router])

  const style: React.CSSProperties | undefined =
    offset > 0
      ? {
          transform: `translateX(${isRTL.current ? -offset : offset}px)`,
          willChange: "transform",
          transition: tracking.current ? "none" : "transform 0.2s ease-out",
        }
      : undefined

  return {
    swipeBackHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    swipeBackStyle: style,
    isSwiping: offset > 0,
  }
}
