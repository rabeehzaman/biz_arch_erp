"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

type NavDirection = "forward" | "back" | "tab"

const NavigationDirectionContext = React.createContext<NavDirection>("forward")

export function useNavigationDirection() {
  return React.useContext(NavigationDirectionContext)
}

// Root tab paths — switching between these is a "tab" transition
const ROOT_TABS = new Set(["/", "/invoices", "/pos", "/products", "/more"])

function getDepth(pathname: string) {
  return pathname === "/" ? 0 : pathname.split("/").filter(Boolean).length
}

export function NavigationDirectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const prevPathRef = React.useRef(pathname)
  const [direction, setDirection] = React.useState<NavDirection>("forward")

  React.useEffect(() => {
    const prev = prevPathRef.current
    if (prev === pathname) return
    prevPathRef.current = pathname

    // Tab-to-tab switch
    if (ROOT_TABS.has(prev) && ROOT_TABS.has(pathname)) {
      setDirection("tab")
      return
    }

    const prevDepth = getDepth(prev)
    const nextDepth = getDepth(pathname)

    if (nextDepth > prevDepth) {
      setDirection("forward")
    } else if (nextDepth < prevDepth) {
      setDirection("back")
    } else {
      // Same depth — likely a sibling navigation, treat as tab
      setDirection("tab")
    }
  }, [pathname])

  return (
    <NavigationDirectionContext.Provider value={direction}>
      {children}
    </NavigationDirectionContext.Provider>
  )
}
