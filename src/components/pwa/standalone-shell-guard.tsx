"use client";

import { useEffect, useState } from "react";

const BASE_VIEWPORT_CONTENT = "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
const STANDALONE_VIEWPORT_CONTENT = `${BASE_VIEWPORT_CONTENT}, maximum-scale=1, user-scalable=no`;

type MediaQueryListener = () => void;
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait") => Promise<void>;
};

function ensureViewportMetaTag() {
  let viewportMeta = document.querySelector('meta[name="viewport"]');

  if (!viewportMeta) {
    viewportMeta = document.createElement("meta");
    viewportMeta.setAttribute("name", "viewport");
    document.head.prepend(viewportMeta);
  }

  return viewportMeta;
}

function bindMediaQuery(mediaQueryList: MediaQueryList, listener: MediaQueryListener) {
  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", listener);
    return () => mediaQueryList.removeEventListener("change", listener);
  }

  mediaQueryList.addListener(listener);
  return () => mediaQueryList.removeListener(listener);
}

function detectStandaloneMode() {
  // Capacitor WebView should be treated as standalone
  if (
    typeof (window as any).Capacitor !== "undefined" &&
    (window as any).Capacitor.isNativePlatform?.()
  ) {
    return true;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectLandscapeMode() {
  return window.matchMedia("(orientation: landscape)").matches;
}

function syncShellState(isStandalone: boolean, isLandscape: boolean) {
  const viewportMeta = ensureViewportMetaTag();
  const viewportContent = isStandalone ? STANDALONE_VIEWPORT_CONTENT : BASE_VIEWPORT_CONTENT;

  viewportMeta.setAttribute("content", viewportContent);
  document.documentElement.dataset.appDisplayMode = isStandalone ? "standalone" : "browser";
  document.documentElement.dataset.appOrientation = isLandscape ? "landscape" : "portrait";
  document.body.dataset.appDisplayMode = isStandalone ? "standalone" : "browser";
  document.body.dataset.appOrientation = isLandscape ? "landscape" : "portrait";
}

export function StandaloneShellGuard() {
  const [showLandscapeBlocker, setShowLandscapeBlocker] = useState(false);

  useEffect(() => {
    const standaloneDisplayMode = window.matchMedia("(display-mode: standalone)");
    const fullscreenDisplayMode = window.matchMedia("(display-mode: fullscreen)");
    const orientationQuery = window.matchMedia("(orientation: landscape)");

    const applyShellMode = () => {
      const isStandalone = detectStandaloneMode();
      const isLandscape = detectLandscapeMode();
      const orientation = screen.orientation as LockableScreenOrientation | undefined;

      syncShellState(isStandalone, isLandscape);

      const isMobileDevice = Math.min(screen.width, screen.height) < 768;
      setShowLandscapeBlocker(isStandalone && isLandscape && isMobileDevice);

      if (isStandalone && isMobileDevice && orientation?.lock) {
        orientation.lock("portrait").catch(() => {
          // iOS Safari ignores orientation locking for home-screen web apps, so we keep the overlay fallback.
        });
      }
    };

    applyShellMode();

    const unbindStandalone = bindMediaQuery(standaloneDisplayMode, applyShellMode);
    const unbindFullscreen = bindMediaQuery(fullscreenDisplayMode, applyShellMode);
    const unbindOrientation = bindMediaQuery(orientationQuery, applyShellMode);

    window.addEventListener("orientationchange", applyShellMode);
    window.addEventListener("resize", applyShellMode);
    document.addEventListener("visibilitychange", applyShellMode);

    return () => {
      unbindStandalone();
      unbindFullscreen();
      unbindOrientation();
      window.removeEventListener("orientationchange", applyShellMode);
      window.removeEventListener("resize", applyShellMode);
      document.removeEventListener("visibilitychange", applyShellMode);
      syncShellState(false, false);
      setShowLandscapeBlocker(false);
    };
  }, []);

  if (!showLandscapeBlocker) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-xs space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Portrait Only
        </p>
        <h2 className="font-heading text-2xl font-semibold">Rotate your phone</h2>
        <p className="text-sm leading-6 text-slate-300">
          The installed BizArch app is locked to portrait mode for safer data entry and more predictable layouts.
        </p>
      </div>
    </div>
  );
}
