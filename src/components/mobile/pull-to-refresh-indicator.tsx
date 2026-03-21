"use client";

import { Loader2 } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
}

const THRESHOLD = 60;

export function PullToRefreshIndicator({ pullDistance, isRefreshing }: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = pullDistance * 3.6;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out sm:hidden"
      style={{ height: isRefreshing ? 48 : pullDistance > 0 ? Math.min(pullDistance, 48) : 0 }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md"
        style={{
          opacity: isRefreshing ? 1 : progress,
          transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
        }}
      >
        <Loader2
          className={`h-4 w-4 text-primary ${isRefreshing ? "animate-spin" : ""}`}
        />
      </div>
    </div>
  );
}
