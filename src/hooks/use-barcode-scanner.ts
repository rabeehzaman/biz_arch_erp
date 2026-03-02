import { useEffect, useRef } from "react";

const BUFFER_TIMEOUT_MS = 50;
const MIN_SCAN_LENGTH = 6;

/**
 * Listens for rapid keystrokes at the document level (barcode scanners send
 * characters < 50 ms apart and terminate with Enter). Fires onScan(barcode)
 * when a complete scan is detected.
 *
 * When enabled=false the hook is a no-op.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  enabled: boolean
) {
  const bufferRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);

  // Keep onScanRef fresh without re-registering the event listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when focus is in an editable field — user is typing manually
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Enter") {
        const barcode = bufferRef.current;
        bufferRef.current = "";
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (barcode.length >= MIN_SCAN_LENGTH) {
          onScanRef.current(barcode);
        }
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
          timerRef.current = null;
        }, BUFFER_TIMEOUT_MS);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
      bufferRef.current = "";
    };
  }, [enabled]);
}
