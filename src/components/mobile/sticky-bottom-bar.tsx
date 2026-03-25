"use client";

import { useMobileFixedUi } from "@/hooks/use-mobile-fixed-ui";

interface StickyBottomBarProps {
  children: React.ReactNode;
}

export function StickyBottomBar({ children }: StickyBottomBarProps) {
  const { hideFixedUi, scrolledDown } = useMobileFixedUi();

  if (hideFixedUi) return null;

  const bottomValue = scrolledDown
    ? "var(--app-safe-area-bottom)"
    : "calc(5.25rem + var(--app-safe-area-bottom))";

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)] transition-[bottom] duration-300 ease-out sm:hidden"
      style={{ bottom: bottomValue }}
    >
      <div className="flex gap-3">{children}</div>
    </div>
  );
}
