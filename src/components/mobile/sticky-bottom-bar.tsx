"use client";

import { useMobileFixedUi } from "@/hooks/use-mobile-fixed-ui";

interface StickyBottomBarProps {
  children: React.ReactNode;
}

export function StickyBottomBar({ children }: StickyBottomBarProps) {
  const { hideFixedUi } = useMobileFixedUi();

  if (hideFixedUi) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,var(--app-safe-area-bottom))] shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)] sm:hidden"
    >
      <div className="flex gap-3">{children}</div>
    </div>
  );
}
