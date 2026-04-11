/**
 * Shared mobile viewport utilities used by Dialog, AlertDialog, ActionSheet, etc.
 */

export function isMobileDialogViewport() {
  if (typeof window === "undefined") return false

  return (
    window.matchMedia("(max-width: 767px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  )
}

/**
 * Scroll target that useMobileFixedUi reads during recovery.
 * Stored on window to guarantee a single shared location across
 * bundled chunks and HMR boundaries.
 */
export function setPreserveScrollY(y: number) {
  ;(window as any).__bizarch_preserveScrollY = y
}

export function clearPreserveScrollY() {
  ;(window as any).__bizarch_preserveScrollY = undefined
}

export function getPreserveScrollY(): number | null {
  return (window as any).__bizarch_preserveScrollY ?? null
}

/**
 * Reset viewport state after a mobile dialog/sheet closes.
 *
 * @param preserveScroll — when true, restore the user's scroll position
 *   instead of scrolling to top. Use this for inline pickers (combobox,
 *   select) where the user is mid-form and shouldn't lose their place.
 */
export function resetMobileDialogViewport({ preserveScroll = false, scrollY }: { preserveScroll?: boolean; scrollY?: number } = {}) {
  if (!isMobileDialogViewport()) return

  const savedScrollY = scrollY ?? window.scrollY

  // Was the keyboard open? Check if viewport height is significantly
  // smaller than window height (keyboard takes > 120px).
  const viewport = window.visualViewport
  const keyboardWasOpen =
    viewport && window.innerHeight - viewport.height > 120

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

  document.body.style.removeProperty("pointer-events")
  document.documentElement.style.setProperty("--mobile-fixed-ui-offset", "0px")

  // Only do the aggressive scroll-to-top dance when the keyboard was open,
  // which is the scenario where iOS Safari needs the viewport nudge.
  // Otherwise, just fire the resize event and preserve scroll position.
  if (keyboardWasOpen && !preserveScroll) {
    window.scrollTo(0, 0)
    window.scrollTo(0, 1)
    window.scrollTo(0, 0)

    const RESET_DELAYS = [0, 50, 150, 300, 500, 800]

    const fireScroll = () => {
      window.scrollTo(0, 0)
      window.dispatchEvent(new Event("resize"))
    }

    requestAnimationFrame(() => {
      fireScroll()
      RESET_DELAYS.forEach((delay, i) => {
        setTimeout(() => {
          fireScroll()
          // Only trigger recovery schedule once, on the last pass
          if (i === RESET_DELAYS.length - 1) {
            window.dispatchEvent(new Event("mobile-dialog-viewport-reset"))
          }
        }, delay)
      })
    })
  } else {
    if (preserveScroll) {
      setPreserveScrollY(savedScrollY)
    }
    window.dispatchEvent(new Event("resize"))
    window.dispatchEvent(new Event("mobile-dialog-viewport-reset"))
  }
}
