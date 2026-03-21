"use client";

import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

export async function shareContent(options: ShareOptions): Promise<boolean> {
  // Native share via Capacitor
  if (isCapacitorEnvironment()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.title,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Web Share API
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Clipboard fallback
  if (typeof navigator !== "undefined" && navigator.clipboard && options.url) {
    try {
      await navigator.clipboard.writeText(options.url);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
