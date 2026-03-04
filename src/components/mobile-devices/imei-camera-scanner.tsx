"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, ScanLine } from "lucide-react";

interface ImeiCameraScannerProps {
  onScan: (imei: string) => void;
  /** If false, hides the button entirely */
  show?: boolean;
}

// BarcodeDetector type — not in TS lib by default
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

function isBarcodeDetectorSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

/** Check if camera is available (mobile or desktop with camera) */
function isCameraAvailable() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function ImeiCameraScanner({ onScan, show = true }: ImeiCameraScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zxingReaderRef = useRef<any>(null);
  const zxingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (zxingIntervalRef.current) {
      clearInterval(zxingIntervalRef.current);
      zxingIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const closeScanner = useCallback(() => {
    stopCamera();
    setOpen(false);
    setError(null);
    setDetected(null);
    setScanning(false);
  }, [stopCamera]);

  // Native BarcodeDetector scan loop (Chrome/Android)
  const scanLoopNative = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoopNative);
      return;
    }

    detector
      .detect(video)
      .then((barcodes) => {
        if (!mountedRef.current) return;
        for (const barcode of barcodes) {
          const digits = barcode.rawValue.replace(/\D/g, "");
          if (digits.length === 15) {
            setDetected(digits);
            stopCamera();
            setScanning(false);
            setTimeout(() => {
              onScan(digits);
              closeScanner();
            }, 800);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(scanLoopNative);
      })
      .catch(() => {
        rafRef.current = requestAnimationFrame(scanLoopNative);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScan, stopCamera, closeScanner]);

  // ZXing-based scan loop (Safari/iOS fallback)
  const startZxingScanLoop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (reader: any) => {
      const video = videoRef.current;
      if (!video) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      zxingIntervalRef.current = setInterval(() => {
        if (!video || video.readyState < 2 || !ctx || !mountedRef.current) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { BrowserMultiFormatReader } = require("@zxing/browser");
          const luminance = BrowserMultiFormatReader.createCanvasFromMediaElement
            ? undefined
            : undefined;
          void luminance;

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = reader.decode(imageData, canvas.width, canvas.height);

          if (result) {
            const text = result.getText ? result.getText() : String(result);
            const digits = text.replace(/\D/g, "");
            if (digits.length === 15) {
              setDetected(digits);
              stopCamera();
              setScanning(false);
              setTimeout(() => {
                onScan(digits);
                closeScanner();
              }, 800);
            }
          }
        } catch {
          // No barcode found in this frame — continue scanning
        }
      }, 250); // Scan every 250ms for performance
    },
    [onScan, stopCamera, closeScanner]
  );

  const startCamera = useCallback(async () => {
    setError(null);
    setDetected(null);
    setScanning(false);

    const useNative = isBarcodeDetectorSupported();

    try {
      // Initialize the appropriate decoder
      if (useNative) {
        if (!detectorRef.current) {
          detectorRef.current = new BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code"],
          });
        }
      } else {
        // Load ZXing for Safari/iOS
        if (!zxingReaderRef.current) {
          const { MultiFormatReader, BarcodeFormat, DecodeHintType, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } =
            await import("@zxing/library");

          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new MultiFormatReader();
          reader.setHints(hints);

          // Wrap with a decode helper
          zxingReaderRef.current = {
            decode: (imageData: ImageData, width: number, height: number) => {
              const { data } = imageData;
              // Convert RGBA to RGB
              const rgbData = new Uint8ClampedArray((width * height * 3));
              for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
                rgbData[j] = data[i];
                rgbData[j + 1] = data[i + 1];
                rgbData[j + 2] = data[i + 2];
              }
              const luminanceSource = new RGBLuminanceSource(rgbData, width, height);
              const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
              return reader.decode(binaryBitmap);
            },
          };
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);

        if (useNative) {
          scanLoopNative();
        } else {
          startZxingScanLoop(zxingReaderRef.current);
        }
      }
    } catch (err) {
      const e = err as Error;
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access and try again.");
      } else if (e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera: " + e.message);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanLoopNative, startZxingScanLoop]);

  // Start camera when overlay opens
  useEffect(() => {
    if (open) startCamera();
    return () => { if (!open) stopCamera(); };
  }, [open, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  if (!show || !isCameraAvailable()) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={() => setOpen(true)}
        title="Scan IMEI with camera"
      >
        <Camera className="h-4 w-4" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-medium">Scan IMEI Barcode</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={closeScanner}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Camera feed */}
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />

            {/* Viewfinder overlay */}
            {scanning && !detected && (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Dark surround */}
                <div className="absolute inset-0 bg-black/40" />
                {/* Scan window */}
                <div className="relative z-10 h-24 w-[min(320px,85vw)] rounded-lg border-2 border-white shadow-lg">
                  {/* Corner accents */}
                  <span className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-tl-lg border-l-4 border-t-4 border-emerald-400" />
                  <span className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-tr-lg border-r-4 border-t-4 border-emerald-400" />
                  <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-lg border-b-4 border-l-4 border-emerald-400" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-lg border-b-4 border-r-4 border-emerald-400" />
                  {/* Scan line animation */}
                  <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 animate-scan-line bg-emerald-400/80" />
                </div>
                <p className="absolute bottom-24 z-10 text-center text-sm text-white/80">
                  Point at the IMEI barcode on the device or box
                </p>
              </div>
            )}

            {/* Loading state */}
            {!scanning && !error && !detected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}

            {/* Detected state */}
            {detected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-600 px-8 py-6 text-white">
                  <ScanLine className="h-8 w-8" />
                  <p className="text-sm font-medium">IMEI Detected</p>
                  <p className="font-mono text-xl font-bold tracking-wider">{detected}</p>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                <div className="rounded-xl bg-white p-6 text-center">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                  <Button className="mt-4" onClick={closeScanner}>Close</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
