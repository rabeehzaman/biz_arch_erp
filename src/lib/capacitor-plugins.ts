"use client";

import { Capacitor } from "@capacitor/core";

export function isCapacitorEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  );
}

export async function initCapacitorPlugins() {
  if (!isCapacitorEnvironment()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch {}

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {}

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {}

  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", ({ canGoBack }) => {
      // Dispatch custom event — components use useAndroidBackButton hook to handle
      const event = new Event("capacitor-back-button", { cancelable: true });
      const consumed = !window.dispatchEvent(event); // returns false if preventDefault was called

      if (!consumed) {
        // No component handled it — use default behavior
        if (canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp();
        }
      }
    });
  } catch {}
}

export async function getHaptics() {
  if (!isCapacitorEnvironment()) return null;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    return Haptics;
  } catch {
    return null;
  }
}

export async function getKeyboard() {
  if (!isCapacitorEnvironment()) return null;
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    return Keyboard;
  } catch {
    return null;
  }
}

export async function getStatusBar() {
  if (!isCapacitorEnvironment()) return null;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    return StatusBar;
  } catch {
    return null;
  }
}

export async function getShare() {
  if (!isCapacitorEnvironment()) return null;
  try {
    const { Share } = await import("@capacitor/share");
    return Share;
  } catch {
    return null;
  }
}
