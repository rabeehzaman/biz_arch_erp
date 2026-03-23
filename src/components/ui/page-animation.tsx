"use client";

import { useNavigationDirection } from "@/components/mobile/navigation-direction-provider";
import { useIsMobile } from "@/hooks/use-is-mobile";

const directionClass = {
  forward: "animate-nav-forward",
  back: "animate-nav-back",
  tab: "animate-nav-tab",
} as const;

export function PageAnimation({ children, className }: { children: React.ReactNode; className?: string }) {
    const isMobile = useIsMobile();
    const direction = useNavigationDirection();

    const animClass = isMobile ? directionClass[direction] : "animate-page-in";

    return <div className={`${animClass} ${className ?? ""}`}>{children}</div>;
}

export function StaggerContainer({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`stagger-children ${className ?? ""}`}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}
