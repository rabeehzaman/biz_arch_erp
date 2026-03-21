"use client";

import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { useHaptics } from "@/hooks/use-haptics";

interface SwipeableCardProps {
  children: ReactNode;
  actions: ReactNode;
  actionWidth?: number;
}

const SWIPE_EVENT = "swipeable-card-open";

export function SwipeableCard({ children, actions, actionWidth = 140 }: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const directionLockedRef = useRef(false);
  const isHorizontalRef = useRef(false);
  const hapticFiredRef = useRef(false);
  const idRef = useRef(Math.random().toString(36).slice(2));

  const { impactLight } = useHaptics();

  const isRtl = typeof document !== "undefined" && document.dir === "rtl";
  const sign = isRtl ? 1 : -1;

  const snapOpen = useCallback(() => {
    setOffsetX(sign * actionWidth);
    currentOffsetRef.current = sign * actionWidth;
    setIsOpen(true);
    window.dispatchEvent(new CustomEvent(SWIPE_EVENT, { detail: idRef.current }));
  }, [sign, actionWidth]);

  const snapClosed = useCallback(() => {
    setOffsetX(0);
    currentOffsetRef.current = 0;
    setIsOpen(false);
  }, []);

  // Close when another card opens
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== idRef.current) {
        snapClosed();
      }
    };
    window.addEventListener(SWIPE_EVENT, handler);
    return () => window.removeEventListener(SWIPE_EVENT, handler);
  }, [snapClosed]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    directionLockedRef.current = false;
    isHorizontalRef.current = false;
    hapticFiredRef.current = false;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (!directionLockedRef.current) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        directionLockedRef.current = true;
        isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }

    if (!isHorizontalRef.current) return;

    e.preventDefault();

    const rawOffset = currentOffsetRef.current + deltaX;

    // Clamp: only allow swiping to reveal actions
    let clamped: number;
    if (isRtl) {
      clamped = Math.max(0, Math.min(rawOffset, actionWidth));
    } else {
      clamped = Math.min(0, Math.max(rawOffset, -actionWidth));
    }

    // Haptic feedback at snap threshold
    const progress = Math.abs(clamped) / actionWidth;
    if (progress >= 0.4 && !hapticFiredRef.current) {
      hapticFiredRef.current = true;
      impactLight();
    }

    setOffsetX(clamped);
  }, [actionWidth, impactLight, isRtl]);

  const onTouchEnd = useCallback(() => {
    setIsDragging(false);

    if (!isHorizontalRef.current) return;

    const progress = Math.abs(offsetX) / actionWidth;
    if (progress >= 0.4) {
      snapOpen();
    } else {
      snapClosed();
    }
  }, [offsetX, actionWidth, snapOpen, snapClosed]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind the card */}
      <div
        className={`absolute inset-y-0 flex items-stretch ${
          isRtl ? "left-0" : "right-0"
        }`}
        style={{ width: actionWidth }}
      >
        {actions}
      </div>

      {/* Swipeable content */}
      <div
        className="relative bg-white"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease-out",
          willChange: "transform",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>

      {/* Tap overlay to close when open */}
      {isOpen && (
        <div
          className="absolute inset-0 z-10"
          onTouchStart={(e) => {
            e.stopPropagation();
            snapClosed();
          }}
          onClick={snapClosed}
        />
      )}
    </div>
  );
}
