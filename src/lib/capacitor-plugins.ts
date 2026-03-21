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
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
    await StatusBar.setStyle({ style: Style.Light });
  } catch {}

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
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
