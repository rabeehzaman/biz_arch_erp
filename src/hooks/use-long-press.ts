"use client"

import { useCallback, useRef } from "react"
import { useHaptics } from "@/hooks/use-haptics"

const LONG_PRESS_DURATION = 500 // ms
const MOVE_TOLERANCE = 10 // px

interface UseLongPressOptions {
  onLongPress: () => void
  disabled?: boolean
}

export function useLongPress({ onLongPress, disabled = false }: UseLongPressOptions) {
  const { impactMedium } = useHaptics()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      firedRef.current = false
      const touch = e.touches[0]
      startPos.current = { x: touch.clientX, y: touch.clientY }

      timerRef.current = setTimeout(() => {
        firedRef.current = true
        impactMedium()
        onLongPress()
      }, LONG_PRESS_DURATION)
    },
    [disabled, impactMedium, onLongPress]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!timerRef.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - startPos.current.x
      const dy = touch.clientY - startPos.current.y
      if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) {
        clear()
      }
    },
    [clear]
  )

  const onTouchEnd = useCallback(() => {
    clear()
  }, [clear])

  // Prevent context menu if long-press fired (avoids double action on Android)
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (firedRef.current) {
        e.preventDefault()
      }
    },
    []
  )

  return {
    longPressHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onContextMenu,
    },
  }
}
