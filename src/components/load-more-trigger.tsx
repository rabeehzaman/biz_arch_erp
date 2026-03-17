"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface LoadMoreTriggerProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export function LoadMoreTrigger({
  hasMore,
  isLoadingMore,
  onLoadMore,
}: LoadMoreTriggerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex items-center justify-center py-4">
      {isLoadingMore && (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      )}
    </div>
  );
}
