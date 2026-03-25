"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, Loader2, ScanLine, Edit, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getCameraAvailability } from "@/lib/camera-support";
import { useLanguage } from "@/lib/i18n";

async function getBarcodeDetector(formats: string[]) {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        return new (window as any).BarcodeDetector({ formats });
    }
    const { BarcodeDetector } = await import("barcode-detector/ponyfill");
    return new BarcodeDetector({ formats: formats as any });
}

export function GlobalScanner() {
    const router = useRouter();
    const { t } = useLanguage();
    const [isMounted, setIsMounted] = useState(false);
    const [cameraAvailable, setCameraAvailable] = useState(false);
    const [cameraUnavailableReason, setCameraUnavailableReason] = useState<string | null>(null);
    const [hasBlockingOverlay, setHasBlockingOverlay] = useState(false);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [detected, setDetected] = useState<string | null>(null);

    // Lookup states
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupResult, setLookupResult] = useState<any>(null);
    const [showResultSheet, setShowResultSheet] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const detectorRef = useRef<any>(null);
    const mountedRef = useRef(true);

    const stopCamera = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
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

    const handleLookup = useCallback(async (code: string) => {
        setIsLookingUp(true);
        setLookupResult(null);
        setShowResultSheet(true); // Open sheet immediately to show loading

        try {
            const res = await fetch(`/api/scanner/lookup?code=${encodeURIComponent(code)}`);
            if (!res.ok) {
                if (res.status === 404) {
                    setLookupResult({ type: "not_found", code });
                } else {
                    setLookupResult({ type: "error", message: t("scanner.fetchFailed") });
                }
            } else {
                const data = await res.json();
                setLookupResult(data);
            }
        } catch (_err) {
            setLookupResult({ type: "error", message: t("scanner.errorOccurred") });
        } finally {
            setIsLookingUp(false);
        }
    }, []);

    const scanLoop = useCallback(function scanFrame() {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(scanFrame);
            return;
        }

        detector
            .detect(video)
            .then((barcodes: Array<{ rawValue: string }>) => {
                if (!mountedRef.current) return;
                if (barcodes.length > 0) {
                    const barcode = barcodes[0].rawValue;
                    setDetected(barcode);
                    stopCamera();
                    setScanning(false);

                    setTimeout(() => {
                        closeScanner();
                        handleLookup(barcode);
                    }, 600);
                    return;
                }
                rafRef.current = requestAnimationFrame(scanFrame);
            })
            .catch(() => {
                rafRef.current = requestAnimationFrame(scanFrame);
            });
    }, [handleLookup, stopCamera, closeScanner]);

    useEffect(() => {
        setIsMounted(true);

        const syncCameraSupport = () => {
            const availability = getCameraAvailability();
            setCameraAvailable(availability.available);
            setCameraUnavailableReason(availability.reason);
        };

        syncCameraSupport();
        window.addEventListener("focus", syncCameraSupport);
        document.addEventListener("visibilitychange", syncCameraSupport);

        return () => {
            window.removeEventListener("focus", syncCameraSupport);
            document.removeEventListener("visibilitychange", syncCameraSupport);
        };
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const syncOverlayState = () => {
            setHasBlockingOverlay(
                Boolean(
                    document.querySelector(
                        '[data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="alert-dialog-content"]'
                    )
                )
            );
        };

        syncOverlayState();

        const observer = new MutationObserver(syncOverlayState);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-state", "open"],
        });

        return () => observer.disconnect();
    }, [isMounted]);

    const startCamera = useCallback(async () => {
        setError(null);
        setDetected(null);
        setScanning(false);

        try {
            const availability = getCameraAvailability();
            setCameraAvailable(availability.available);
            setCameraUnavailableReason(availability.reason);

            if (!availability.available) {
                setError(availability.reason || "Camera scanning is unavailable on this device.");
                return;
            }

            if (!detectorRef.current) {
                detectorRef.current = await getBarcodeDetector([
                    "code_128", "code_39", "ean_13", "ean_8", "qr_code", "itf",
                ]);
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
                scanLoop();
            }
        } catch (err) {
            const e = err as Error;
            if (e.name === "NotAllowedError") {
                setError(t("scanner.cameraPermissionDenied"));
            } else if (e.name === "NotFoundError") {
                setError(t("scanner.noCameraFound"));
            } else {
                setError(t("scanner.couldNotStartCamera") + ": " + e.message);
            }
        }
    }, [scanLoop]);

    useEffect(() => {
        if (open) startCamera();
        return () => { if (!open) stopCamera(); };
    }, [open, startCamera, stopCamera]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopCamera();
        };
    }, [stopCamera]);

    if (!isMounted) return null;

    return (
        <>
            {!open && !hasBlockingOverlay && (
                <div className="fixed bottom-[7.5rem] right-4 z-[60]">
                    <button
                        onClick={() => setOpen(true)}
                        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform active:scale-95 ${
                            cameraAvailable ? "bg-emerald-600" : "bg-slate-700"
                        }`}
                        aria-label="Scanner"
                        title={cameraAvailable ? "Scanner" : "Scanner setup"}
                    >
                        <ScanLine className="h-6 w-6" />
                    </button>
                </div>
            )}

            {open && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black">
                    <div className="flex items-center justify-between px-4 py-3 text-white">
                        <span className="text-sm font-medium">{t("scanner.scanBarcodeQR")}</span>
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

                    <div className="relative flex-1 overflow-hidden">
                        <video
                            ref={videoRef}
                            className="h-full w-full object-cover"
                            autoPlay
                            playsInline
                            muted
                        />

                        {scanning && !detected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="absolute inset-0 bg-black/40" />
                                <div className="relative z-10 h-32 w-[min(320px,85vw)] rounded-lg border-2 border-white shadow-lg">
                                    <span className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-tl-lg border-l-4 border-t-4 border-emerald-400" />
                                    <span className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-tr-lg border-r-4 border-t-4 border-emerald-400" />
                                    <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-lg border-b-4 border-l-4 border-emerald-400" />
                                    <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-lg border-b-4 border-r-4 border-emerald-400" />
                                    <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 animate-scan-line bg-emerald-400/80" />
                                </div>
                                <p className="absolute bottom-24 z-10 text-center text-sm text-white/80">
                                    {t("scanner.pointAtBarcodeQR")}
                                </p>
                            </div>
                        )}

                        {!scanning && !error && !detected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                            </div>
                        )}

                        {detected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                                <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-600 px-8 py-6 text-white">
                                    <ScanLine className="h-8 w-8" />
                                    <p className="text-sm font-medium">{t("scanner.detected")}</p>
                                    <p className="font-mono text-xl font-bold tracking-wider">{detected}</p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                                <div className="max-w-sm rounded-xl bg-white p-6 text-center">
                                    <p className="text-sm font-medium text-slate-800">{error}</p>
                                    {!cameraAvailable && cameraUnavailableReason && (
                                        <p className="mt-3 text-xs leading-5 text-slate-500">
                                            {t("scanner.secureContextWarning")}
                                        </p>
                                    )}
                                    <Button className="mt-4" onClick={closeScanner}>{t("common.close")}</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Sheet open={showResultSheet} onOpenChange={setShowResultSheet}>
                <SheetContent side="bottom" className="rounded-t-2xl px-6 py-8">
                    {isLookingUp ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
                            <p className="text-gray-500 font-medium">{t("scanner.lookingUpDetails")}</p>
                        </div>
                    ) : lookupResult ? (
                        <div className="space-y-6">
                            {lookupResult.type === "product" && (
                                <>
                                    <SheetHeader>
                                        <SheetTitle>{lookupResult.data.name}</SheetTitle>
                                        <SheetDescription className="break-all font-mono">
                                            {lookupResult.data.barcode || lookupResult.data.sku || t("scanner.noCode")}
                                        </SheetDescription>
                                    </SheetHeader>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-semibold">{t("scanner.price")}</p>
                                            <p className="text-lg font-bold mt-1 text-emerald-700">
                                                {Number(lookupResult.data.price).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className={`p-4 rounded-xl ${lookupResult.data.availableStock > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
                                            <p className="text-xs uppercase font-semibold opacity-80">{t("scanner.stock")}</p>
                                            <p className="text-lg font-bold mt-1">
                                                {lookupResult.data.availableStock} {lookupResult.data.unit?.code}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 text-base font-medium"
                                        onClick={() => {
                                            setShowResultSheet(false);
                                            router.push(`/products?action=edit&id=${lookupResult.data.id}`);
                                        }}
                                    >
                                        <Edit className="h-4 w-4 mr-2" />
                                        {t("scanner.editProduct")}
                                    </Button>
                                </>
                            )}

                            {lookupResult.type === "mobile_device" && (
                                <>
                                    <SheetHeader>
                                        <SheetTitle>{lookupResult.data.model} ({lookupResult.data.brand})</SheetTitle>
                                        <SheetDescription className="break-all font-mono">
                                            IMEI: {lookupResult.data.imei1}
                                        </SheetDescription>
                                    </SheetHeader>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-semibold">{t("scanner.status")}</p>
                                            <p className="text-lg font-bold mt-1 text-emerald-700">
                                                {lookupResult.data.currentStatus}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-semibold">{t("scanner.costPrice")}</p>
                                            <p className="text-lg font-bold mt-1">
                                                {Number(lookupResult.data.costPrice).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 text-base font-medium"
                                        onClick={() => {
                                            setShowResultSheet(false);
                                            // Depending on mobile device details page
                                            router.push(`/mobile-devices/${lookupResult.data.id}`);
                                        }}
                                    >
                                        <Search className="h-4 w-4 mr-2" />
                                        {t("scanner.viewDevice")}
                                    </Button>
                                </>
                            )}

                            {lookupResult.type === "not_found" && (
                                <div className="text-center py-6">
                                    <div className="bg-orange-100 text-orange-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                                        <ScanLine className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">{t("scanner.itemNotFound")}</h3>
                                    <p className="text-gray-500 mb-6 font-mono break-all">{lookupResult.code}</p>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => setShowResultSheet(false)}
                                        >
                                            {t("common.close")}
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={() => {
                                                setShowResultSheet(false);
                                                router.push(`/products?action=new&barcode=${encodeURIComponent(lookupResult.code)}`);
                                            }}
                                        >
                                            {t("scanner.createNew")}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {lookupResult.type === "error" && (
                                <div className="text-center py-6 text-red-600">
                                    <p className="font-semibold">{lookupResult.message}</p>
                                    <Button
                                        className="mt-4"
                                        variant="outline"
                                        onClick={() => setShowResultSheet(false)}
                                    >
                                        {t("common.close")}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </SheetContent>
            </Sheet>
        </>
    );
}
