"use client";

export function PageAnimation({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}

export function StaggerContainer({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}
