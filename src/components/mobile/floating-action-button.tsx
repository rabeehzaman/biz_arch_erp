"use client";

import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";
import { useHaptics } from "@/hooks/use-haptics";
import { useMobileFixedUi } from "@/hooks/use-mobile-fixed-ui";

interface FloatingActionButtonProps {
  href?: string;
  icon?: LucideIcon;
  label?: string;
  onClick?: () => void;
}

export function FloatingActionButton({
  href,
  icon: Icon = Plus,
  label,
  onClick,
}: FloatingActionButtonProps) {
  const { hideFixedUi, scrolledDown } = useMobileFixedUi();
  const { impactLight } = useHaptics();

  if (hideFixedUi) return null;

  const className =
    "fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 active:scale-95 sm:hidden " +
    "end-4 bottom-[calc(5.5rem+var(--app-safe-area-bottom))] " +
    (!scrolledDown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none");

  const handlePointerDown = () => {
    impactLight();
  };

  const content = (
    <>
      <Icon className="h-6 w-6" />
      {label && <span className="sr-only">{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onPointerDown={handlePointerDown}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onPointerDown={handlePointerDown}
    >
      {content}
    </button>
  );
}
